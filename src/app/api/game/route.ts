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

    const sendoff = await generateSendoff(state, state.winnerId);
    addMessage(state, "alien", sendoff);

    await setGame(roomCode, state);
    await triggerGameEvent(roomCode, "game-update", { gameState: state });
    return;
  }

  const roundType = getRoundType(nextRoundNum);

  const question = await generateQuestion(state, roundType);

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

  state.phase = "questioning";
  state.roundDeadline = Date.now() + ROUND_DURATION;
  state.readyPlayers = [];

  await setGame(roomCode, state);
  await triggerGameEvent(roomCode, "game-update", { gameState: state });
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
  await triggerGameEvent(roomCode, "game-update", { gameState: state });

  // Generate per-player reviews
  const { reviews } = await generateAnswerReviews(state, round.answers);
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

  // Move to reviewing phase — client will cycle through reviews
  state.phase = "reviewing";
  await setGame(roomCode, state);
  await triggerGameEvent(roomCode, "game-update", { gameState: state });
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

        await triggerGameEvent(roomCode, "player-joined", {
          gameState: state,
        });

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
        return NextResponse.json({ success: true, gameState: state });
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
        await triggerGameEvent(roomCode, "game-update", {
          gameState: state,
        });

        // Generate introduction
        const introduction = await generateIntroduction(state.players);
        addMessage(state, "alien", introduction);

        state.conversationContext.push({
          role: "assistant",
          content: `Introduction: ${introduction}. Players: ${state.players.map((p) => p.name).join(", ")}`,
        });

        // Move to intro phase — players must ready up
        state.phase = "intro";
        state.readyPlayers = [];
        await setGame(roomCode, state);
        await triggerGameEvent(roomCode, "game-update", {
          gameState: state,
        });

        return NextResponse.json({ success: true, gameState: state });
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

        // Only allow ready in intro or results phases
        if (state.phase !== "intro" && state.phase !== "results") {
          return NextResponse.json({ success: true, gameState: state });
        }

        // Add player to ready list (dedup)
        if (!state.readyPlayers.includes(playerId)) {
          state.readyPlayers.push(playerId);
        }

        await setGame(roomCode, state);

        // Broadcast ready count
        await triggerGameEvent(roomCode, "player-ready", {
          gameState: state,
          readyCount: state.readyPlayers.length,
          totalPlayers: state.players.length,
        });

        // Check if all players are ready
        if (state.readyPlayers.length >= state.players.length) {
          state.readyPlayers = [];

          if (state.phase === "intro" || state.phase === "results") {
            // Archive current round if coming from results
            if (state.phase === "results" && state.currentRound) {
              state.roundHistory.push({ ...state.currentRound });
            }
            // Start next question
            await setupNextQuestion(state, roomCode);
          }
        }

        return NextResponse.json({ success: true, gameState: state });
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
          return NextResponse.json({ success: true, gameState: state });
        }

        state.currentRound.answers[playerId] = answer;
        const player = state.players.find((p) => p.id === playerId);

        await setGame(roomCode, state);

        // Broadcast live answer
        await triggerGameEvent(roomCode, "answer-live", {
          playerId,
          playerName: player?.name || "Someone",
          answer: state.currentRound.roundType === "drawing" ? "[drawing]" : answer,
          answerCount: Object.keys(state.currentRound.answers).length,
          expectedAnswers: state.players.length,
        });

        // Check if all answers are in
        if (Object.keys(state.currentRound.answers).length >= state.players.length) {
          await processRound(state, roomCode);
        }

        return NextResponse.json({ success: true, gameState: state });
      }

      case "timer-expire": {
        const { roomCode } = body;
        const state = await getGame(roomCode);

        if (!state || state.phase !== "questioning" || !state.currentRound) {
          return NextResponse.json({
            success: true,
            gameState: state,
          });
        }

        // Process with whatever answers we have
        await processRound(state, roomCode);

        return NextResponse.json({ success: true, gameState: state });
      }

      // Client signals that reviewing phase is done (all reviews shown)
      case "reviewing-done": {
        const { roomCode } = body;
        const state = await getGame(roomCode);
        if (!state || state.phase !== "reviewing") {
          return NextResponse.json({ success: true, gameState: state });
        }

        // Move to results phase — show leaderboard, players ready up
        state.phase = "results";
        state.readyPlayers = [];
        await setGame(roomCode, state);
        await triggerGameEvent(roomCode, "game-update", { gameState: state });

        return NextResponse.json({ success: true, gameState: state });
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
