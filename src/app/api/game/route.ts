import { NextRequest, NextResponse } from "next/server";
import { triggerGameEvent } from "@/lib/pusher-server";
import { getGame, setGame } from "@/lib/game-store";
import {
  generateIntroduction,
  generateQuestion,
  generateAnswerReviews,
  generateSendoff,
} from "@/lib/alien-ai";
import {
  GameState,
  Player,
  GameMessage,
  createInitialGameState,
  generateRoomCode,
  generatePlayerId,
  getAvailableAvatar,
} from "@/lib/types";

const ROUND_DURATION = 60000; // 60 seconds
const TOTAL_ROUNDS = 5;

function addMessage(
  state: GameState,
  sender: string,
  text: string
): GameMessage {
  const msg: GameMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sender,
    text,
    timestamp: Date.now(),
  };
  state.messages.push(msg);
  return msg;
}

// Sanitize game state for Pusher broadcast — strip large data (base64 drawings)
function sanitizeForBroadcast(state: GameState): GameState {
  const sanitized = JSON.parse(JSON.stringify(state)) as GameState;
  // Strip base64 image data from current round answers
  if (sanitized.currentRound?.answers) {
    for (const pid of Object.keys(sanitized.currentRound.answers)) {
      const answer = sanitized.currentRound.answers[pid];
      if (answer && answer.startsWith("data:image/")) {
        sanitized.currentRound.answers[pid] = "[drawing]";
      }
    }
  }
  // Strip from round history too
  for (const round of sanitized.roundHistory) {
    if (round.answers) {
      for (const pid of Object.keys(round.answers)) {
        const answer = round.answers[pid];
        if (answer && answer.startsWith("data:image/")) {
          round.answers[pid] = "[drawing]";
        }
      }
    }
  }
  return sanitized;
}

// Safe broadcast helper with retry
async function broadcast(roomCode: string, event: string, state: GameState, retries = 2) {
  const sanitized = sanitizeForBroadcast(state);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await triggerGameEvent(roomCode, event, { gameState: sanitized });
      return;
    } catch (err) {
      console.error(`Pusher broadcast attempt ${attempt + 1} failed for ${event}:`, err);
      if (attempt < retries) await new Promise(r => setTimeout(r, 500));
    }
  }
}

// Determine round type for a given round number (1-indexed)
function getRoundType(roundNumber: number): "group" | "drawing" | "final-plea" {
  if (roundNumber === 3) return "drawing";
  if (roundNumber === 5) return "final-plea";
  return "group";
}

// Set up a new question round
async function setupNextQuestion(
  state: GameState,
  roomCode: string
): Promise<void> {
  const nextRoundNum = state.roundHistory.length + 1;

  if (nextRoundNum > TOTAL_ROUNDS) {
    // All rounds complete — determine winner and go to final results
    const topPlayer = Object.entries(state.scores).sort(
      ([, a], [, b]) => b - a
    )[0];
    state.winnerId = topPlayer?.[0] || state.players[0]?.id;
    state.phase = "final-results";
    state.roundDeadline = null;

    try {
      const sendoff = await generateSendoff(state, state.winnerId);
      addMessage(state, "alien", sendoff);
    } catch {
      addMessage(state, "alien", "Get on the ship. NOW. We're leaving.");
    }

    await setGame(roomCode, state);
    await broadcast(roomCode, "game-update", state);
    return;
  }

  const roundType = getRoundType(nextRoundNum);

  let question: string;
  try {
    question = await generateQuestion(state, roundType);
  } catch {
    question = "Tell me something interesting. I'm running out of patience.";
  }

  state.currentRound = {
    roundNumber: nextRoundNum,
    roundType,
    question,
    answers: {},
    alienReaction: "",
    answerReviews: [],
    roundScores: {},
  };

  addMessage(state, "alien", question);

  state.conversationContext.push({
    role: "assistant",
    content: `Asked round ${nextRoundNum} ${roundType} question: "${question}"`,
  });

  // Show question prompt first — timer doesn't start yet
  state.phase = "question-prompt";
  state.roundDeadline = null;
  state.readyPlayers = [];

  await setGame(roomCode, state);
  await broadcast(roomCode, "game-update", state);
}

// Process a completed round (all answers in or timer expired)
async function processRound(
  state: GameState,
  roomCode: string
): Promise<void> {
  if (!state.currentRound) return;

  const round = state.currentRound;

  // Show processing state
  state.phase = "processing";
  state.roundDeadline = null;
  await setGame(roomCode, state);
  await broadcast(roomCode, "game-update", state);

  try {
    // Get the full state from Redis (with drawings) for AI processing
    const fullState = await getGame(roomCode);
    const fullAnswers = fullState?.currentRound?.answers || round.answers;

    // Generate per-player reviews
    const { reviews } = await generateAnswerReviews(
      { ...state, currentRound: { ...round, answers: fullAnswers } },
      fullAnswers
    );
    round.answerReviews = reviews;

    // Calculate round scores from reviews and update cumulative scores
    for (const review of reviews) {
      round.roundScores[review.playerId] = review.score;
      state.scores[review.playerId] = (state.scores[review.playerId] || 0) + review.score;
    }

    // Build a combined reaction for conversation context
    const reactionSummary = reviews
      .map((r) => {
        const p = state.players.find((pl) => pl.id === r.playerId);
        return `${p?.name}: ${r.score} pts — "${r.comment}"`;
      })
      .join("; ");
    round.alienReaction = reactionSummary;

    // Update conversation context
    state.conversationContext.push({
      role: "user",
      content: `Answers to "${round.question}": ${Object.entries(round.answers)
        .map(([pid, ans]) => {
          const p = state.players.find((pl) => pl.id === pid);
          return `${p?.name}: "${round.roundType === "drawing" ? "[drawing]" : ans}"`;
        })
        .join(", ")}`,
    });
    state.conversationContext.push({
      role: "assistant",
      content: `Reviews: ${reactionSummary}`,
    });
  } catch (err) {
    console.error("Error in processRound AI:", err);
    // Fallback: give everyone random scores
    const maxScore = round.roundType === "final-plea" ? 2000 : 1000;
    for (const player of state.players) {
      const score = Math.floor(Math.random() * maxScore * 0.4) + Math.floor(maxScore * 0.3);
      round.roundScores[player.id] = score;
      state.scores[player.id] = (state.scores[player.id] || 0) + score;
      round.answerReviews.push({
        playerId: player.id,
        comment: "Hmm. I've seen worse. Moving on.",
        score,
      });
    }
    round.alienReaction = "Let's just move on.";
  }

  // Move to reviewing phase — client will cycle through reviews
  state.phase = "reviewing";
  await setGame(roomCode, state);
  await broadcast(roomCode, "game-update", state);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "create": {
        const { playerName } = body;
        const roomCode = generateRoomCode();
        const playerId = generatePlayerId();
        const state = createInitialGameState(roomCode);

        const player: Player = {
          id: playerId,
          name: playerName,
          avatar: getAvailableAvatar([]),
          isHost: true,
          connected: true,
        };

        state.players.push(player);
        state.scores[playerId] = 0;
        await setGame(roomCode, state);

        return NextResponse.json({
          success: true,
          gameState: state,
          playerId,
          roomCode,
        });
      }

      case "join": {
        const { roomCode, playerName } = body;
        const state = await getGame(roomCode.toUpperCase());

        if (!state) {
          return NextResponse.json({
            success: false,
            error: "Room not found. Check the code and try again.",
          });
        }

        if (state.phase !== "lobby") {
          return NextResponse.json({
            success: false,
            error: "Game already in progress!",
          });
        }

        if (state.players.length >= 8) {
          return NextResponse.json({
            success: false,
            error: "Room is full!",
          });
        }

        const playerId = generatePlayerId();
        const player: Player = {
          id: playerId,
          name: playerName,
          avatar: getAvailableAvatar(state.players),
          isHost: false,
          connected: true,
        };

        state.players.push(player);
        state.scores[playerId] = 0;
        await setGame(roomCode.toUpperCase(), state);

        await broadcast(roomCode, "player-joined", state);

        return NextResponse.json({
          success: true,
          gameState: state,
          playerId,
          roomCode: roomCode.toUpperCase(),
        });
      }

      case "get-state": {
        const { roomCode } = body;
        const state = await getGame(roomCode?.toUpperCase());
        if (!state) {
          return NextResponse.json({
            success: false,
            error: "Room not found",
          });
        }
        // Return sanitized state (no base64)
        return NextResponse.json({ success: true, gameState: sanitizeForBroadcast(state) });
      }

      // Fetch drawings for the current round (called by clients during reviewing phase)
      case "get-drawings": {
        const { roomCode } = body;
        const state = await getGame(roomCode);
        if (!state || !state.currentRound) {
          return NextResponse.json({ success: false, error: "No active round" });
        }
        // Return only drawing answers (base64 data)
        const drawings: Record<string, string> = {};
        for (const [pid, answer] of Object.entries(state.currentRound.answers)) {
          if (answer && answer.startsWith("data:image/")) {
            drawings[pid] = answer;
          }
        }
        // Also check round history for the most recent drawing round
        for (const round of state.roundHistory) {
          if (round.roundType === "drawing") {
            for (const [pid, answer] of Object.entries(round.answers)) {
              if (answer && answer.startsWith("data:image/")) {
                drawings[pid] = answer;
              }
            }
          }
        }
        return NextResponse.json({ success: true, drawings });
      }

      case "start": {
        const { roomCode } = body;
        const state = await getGame(roomCode);
        if (!state) {
          return NextResponse.json({
            success: false,
            error: "Room not found",
          });
        }

        if (state.players.length < 2) {
          return NextResponse.json({
            success: false,
            error: "Need at least 2 players to start!",
          });
        }

        // Phase: Arrival animation
        state.phase = "arrival";
        state.gameStartedAt = Date.now();
        await setGame(roomCode, state);
        await broadcast(roomCode, "game-update", state);

        // Generate introduction
        let introduction: string;
        try {
          introduction = await generateIntroduction(state.players);
        } catch {
          introduction = "I'm ZYRAX. Your planet's doomed. I can save one of you. Let's make this quick.";
        }
        addMessage(state, "alien", introduction);

        state.conversationContext.push({
          role: "assistant",
          content: `Introduction: ${introduction}. Players: ${state.players.map((p) => p.name).join(", ")}`,
        });

        // Move to intro phase — players must ready up
        state.phase = "intro";
        state.readyPlayers = [];
        await setGame(roomCode, state);
        await broadcast(roomCode, "game-update", state);

        return NextResponse.json({ success: true, gameState: sanitizeForBroadcast(state) });
      }

      case "ready": {
        const { roomCode, playerId } = body;
        const state = await getGame(roomCode);
        if (!state) {
          return NextResponse.json({
            success: false,
            error: "Room not found",
          });
        }

        // Only allow ready in intro, question-prompt, or results phases
        if (state.phase !== "intro" && state.phase !== "results" && state.phase !== "question-prompt") {
          return NextResponse.json({ success: true, gameState: sanitizeForBroadcast(state) });
        }

        // Add player to ready list (dedup)
        if (!state.readyPlayers.includes(playerId)) {
          state.readyPlayers.push(playerId);
        }

        await setGame(roomCode, state);

        // Broadcast ready count
        await broadcast(roomCode, "player-ready", state);

        // Check if all players are ready
        if (state.readyPlayers.length >= state.players.length) {
          state.readyPlayers = [];

          if (state.phase === "question-prompt") {
            // Everyone has read the question — start the timer
            state.phase = "questioning";
            state.roundDeadline = Date.now() + ROUND_DURATION;
            await setGame(roomCode, state);
            await broadcast(roomCode, "game-update", state);
          } else if (state.phase === "intro") {
            // Start first question
            await setupNextQuestion(state, roomCode);
          } else if (state.phase === "results") {
            // Archive current round and move to next
            if (state.currentRound) {
              state.roundHistory.push({ ...state.currentRound });
            }
            await setupNextQuestion(state, roomCode);
          }
        }

        return NextResponse.json({ success: true, gameState: sanitizeForBroadcast(state) });
      }

      case "submit-answer": {
        const { roomCode, playerId, answer } = body;
        const state = await getGame(roomCode);
        if (!state || !state.currentRound) {
          return NextResponse.json({
            success: false,
            error: "No active round",
          });
        }

        if (state.phase !== "questioning") {
          return NextResponse.json({ success: true, gameState: sanitizeForBroadcast(state) });
        }

        state.currentRound.answers[playerId] = answer;
        const player = state.players.find((p) => p.id === playerId);

        await setGame(roomCode, state);

        // Broadcast live answer (sanitized — no base64 in broadcast)
        try {
          await triggerGameEvent(roomCode, "answer-live", {
            playerId,
            playerName: player?.name || "Someone",
            answer: answer.startsWith("data:image/") ? "[drawing]" : answer,
            answerCount: Object.keys(state.currentRound.answers).length,
            expectedAnswers: state.players.length,
          });
        } catch (err) {
          console.error("Failed to broadcast answer-live:", err);
        }

        // Check if all answers are in
        if (Object.keys(state.currentRound.answers).length >= state.players.length) {
          await processRound(state, roomCode);
        }

        return NextResponse.json({ success: true, gameState: sanitizeForBroadcast(state) });
      }

      case "timer-expire": {
        const { roomCode } = body;
        const state = await getGame(roomCode);

        if (!state || state.phase !== "questioning" || !state.currentRound) {
          return NextResponse.json({
            success: true,
            gameState: state ? sanitizeForBroadcast(state) : undefined,
          });
        }

        // Process with whatever answers we have
        await processRound(state, roomCode);

        return NextResponse.json({ success: true, gameState: sanitizeForBroadcast(state) });
      }

      // Client signals that reviewing phase is done (all reviews shown)
      case "reviewing-done": {
        const { roomCode } = body;
        const state = await getGame(roomCode);
        if (!state || state.phase !== "reviewing") {
          return NextResponse.json({ success: true, gameState: state ? sanitizeForBroadcast(state) : undefined });
        }

        // Move to results phase — show leaderboard, players ready up
        state.phase = "results";
        state.readyPlayers = [];
        await setGame(roomCode, state);
        await broadcast(roomCode, "game-update", state);

        return NextResponse.json({ success: true, gameState: sanitizeForBroadcast(state) });
      }

      default:
        return NextResponse.json({
          success: false,
          error: "Unknown action",
        });
    }
  } catch (error) {
    console.error("Game API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
