import { NextRequest, NextResponse } from "next/server";
import { triggerGameEvent } from "@/lib/socket-server";
import { getGame, setGame } from "@/lib/game-store";
import {
  generateIntroduction,
  generateQuestion,
  generateAnswerReviews,
  generateSendoff,
  generateVoteReaction,
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
      console.error(`Broadcast attempt ${attempt + 1} failed for ${event}:`, err);
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
    if (!state.winnerId) {
      const topPlayer = Object.entries(state.scores).sort(
        ([, a], [, b]) => b - a
      )[0];
      state.winnerId = topPlayer?.[0] || state.players[0]?.id;
    }
    state.phase = "final-results";
    state.roundDeadline = null;

    const sendoff = state.cachedSendoff ?? await generateSendoff(state, state.winnerId!).catch(() => null);
    addMessage(state, "alien", sendoff ?? "Get on the ship. NOW. We're leaving.");
    state.cachedSendoff = null;

    await setGame(roomCode, state);
    await broadcast(roomCode, "game-update", state);
    return;
  }

  const roundType = getRoundType(nextRoundNum);

  let question: string;
  try {
    question = state.questionQueue[nextRoundNum] ?? await generateQuestion(state, roundType);
    delete state.questionQueue[nextRoundNum];
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
    votes: {},
    votingDeadline: null,
    voteReaction: "",
    voteBonus: {},
  };

  addMessage(state, "alien", question);

  state.conversationContext.push({
    role: "assistant",
    content: `Asked round ${nextRoundNum} ${roundType} question: "${question}"`,
  });

  // Go directly to questioning with timer
  state.phase = "questioning";
  state.roundDeadline = Date.now() + ROUND_DURATION;
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
    const { reviews, usedFallback } = await generateAnswerReviews(
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

    if (usedFallback) {
      state.aiOffline = true;
      round.alienReaction =
        "My review transmitter is experiencing interference from Earth's atmosphere. Pre-recorded assessments incoming.";
    } else {
      round.alienReaction = reactionSummary;
    }

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
    // Fallback: no AI scores — community vote is the only scoring mechanism
    state.aiOffline = true;
    for (const player of state.players) {
      round.roundScores[player.id] = 0;
      round.answerReviews.push({
        playerId: player.id,
        comment: "My systems are offline. The crowd will decide.",
        score: 0,
      });
    }
    round.alienReaction =
      "My review transmitter is experiencing interference from Earth's atmosphere. Pre-recorded assessments incoming.";
  }

  // Move to reviewing phase — client will cycle through reviews
  state.phase = "reviewing";
  await setGame(roomCode, state);
  await broadcast(roomCode, "game-update", state);

  // Pre-fetch next question(s) while clients watch reviews
  // state.roundHistory.length = rounds already archived (current not yet archived)
  // so next round after archiving = roundHistory.length + 2
  const prefetchRoundNum = state.roundHistory.length + 2;
  try {
    if (prefetchRoundNum === 3) {
      // Batch 2 of 2: R3 (drawing) + R4 (group) in parallel
      const [q3, q4] = await Promise.all([
        generateQuestion(state, "drawing", 3),
        generateQuestion(state, "group", 4),
      ]);
      state.questionQueue[3] = q3;
      state.questionQueue[4] = q4;
      await setGame(roomCode, state);
    } else if (prefetchRoundNum === 5) {
      // Final: R5 (final-plea)
      const q5 = await generateQuestion(state, "final-plea", 5);
      state.questionQueue[5] = q5;
      await setGame(roomCode, state);
    } else if (prefetchRoundNum > TOTAL_ROUNDS) {
      // Pre-cache sendoff so final Ready click is instant
      const topPlayer = Object.entries(state.scores).sort(([, a], [, b]) => b - a)[0];
      const winnerId = topPlayer?.[0] || state.players[0]?.id;
      state.winnerId = winnerId;
      const sendoff = await generateSendoff(state, winnerId);
      state.cachedSendoff = sendoff;
      await setGame(roomCode, state);
    }
  } catch (err) {
    console.error("Error pre-fetching next question:", err);
  }
}

const VOTE_DURATION = 20000; // 20 seconds

// Tally votes, apply bonuses, generate ZYRAX reaction, advance to results
async function processVotes(state: GameState, roomCode: string): Promise<void> {
  if (!state.currentRound) return;
  const round = state.currentRound;

  // Count votes per player
  const voteCounts: Record<string, number> = {};
  for (const votedForId of Object.values(round.votes)) {
    voteCounts[votedForId] = (voteCounts[votedForId] || 0) + 1;
  }

  // Find the highest vote count
  const maxVotes = Math.max(0, ...Object.values(voteCounts));
  const winners = maxVotes > 0
    ? Object.entries(voteCounts).filter(([, count]) => count === maxVotes).map(([pid]) => pid)
    : [];

  // Apply bonuses: sole winner = +200, tied winners = +100 each
  const bonus = winners.length === 1 ? 200 : 100;
  for (const winnerId of winners) {
    round.voteBonus[winnerId] = bonus;
    round.roundScores[winnerId] = (round.roundScores[winnerId] || 0) + bonus;
    state.scores[winnerId] = (state.scores[winnerId] || 0) + bonus;
  }

  // Determine ZYRAX's top AI scorer for the reaction
  const aiTopEntry = Object.entries(round.roundScores)
    .map(([pid, score]) => ({ pid, score: score - (round.voteBonus[pid] || 0) }))
    .sort((a, b) => b.score - a.score)[0];

  const crowdWinnerId = winners[0] || "";
  const crowdWinner = state.players.find((p) => p.id === crowdWinnerId);
  const aiTopPlayer = state.players.find((p) => p.id === aiTopEntry?.pid);
  const agreed = crowdWinnerId === aiTopEntry?.pid;
  const crowdWinnerAnswer = round.roundType === "drawing" ? "[a drawing]" : (round.answers[crowdWinnerId] || "");

  round.voteReaction = await generateVoteReaction(
    crowdWinner?.name || "someone",
    crowdWinnerAnswer,
    aiTopPlayer?.name || "someone",
    agreed
  ).catch(() => agreed
    ? "Finally, you agree with me. Mark this date in history."
    : "Questionable taste, humans. But noted."
  );

  round.votingDeadline = null;

  // Stay in "voting" phase — client detects voteReaction is set, runs reveal
  // animation, then calls "voting-done" to advance to results.
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

        // Batch 1 of 2: R1 + R2 in parallel while players read the intro
        try {
          const [q1, q2] = await Promise.all([
            generateQuestion(state, getRoundType(1), 1),
            generateQuestion(state, getRoundType(2), 2),
          ]);
          state.questionQueue[1] = q1;
          state.questionQueue[2] = q2;
        } catch (err) {
          console.error("Error pre-fetching R1/R2:", err);
        }

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

        // Only allow ready in intro or results phases
        if (state.phase !== "intro" && state.phase !== "results") {
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

          if (state.phase === "intro") {
            // Show processing state immediately, then generate question
            state.phase = "processing";
            await setGame(roomCode, state);
            await broadcast(roomCode, "game-update", state);
            await setupNextQuestion(state, roomCode);
          } else if (state.phase === "results") {
            // Archive current round and show processing immediately
            if (state.currentRound) {
              state.roundHistory.push({ ...state.currentRound });
            }
            state.phase = "processing";
            await setGame(roomCode, state);
            await broadcast(roomCode, "game-update", state);
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

        // Skip voting for single-player games (can't vote for yourself)
        if (state.players.length <= 1) {
          state.phase = "results";
          state.readyPlayers = [];
          await setGame(roomCode, state);
          await broadcast(roomCode, "game-update", state);
          return NextResponse.json({ success: true, gameState: sanitizeForBroadcast(state) });
        }

        // Move to voting phase
        if (state.currentRound) {
          state.currentRound.votes = {};
          state.currentRound.votingDeadline = Date.now() + VOTE_DURATION;
          state.currentRound.voteReaction = "";
          state.currentRound.voteBonus = {};
        }
        state.phase = "voting";
        state.readyPlayers = [];
        await setGame(roomCode, state);
        await broadcast(roomCode, "game-update", state);

        return NextResponse.json({ success: true, gameState: sanitizeForBroadcast(state) });
      }

      case "submit-vote": {
        const { roomCode, playerId, votedForId } = body;
        const state = await getGame(roomCode);
        if (!state || !state.currentRound || state.phase !== "voting") {
          return NextResponse.json({ success: true, gameState: state ? sanitizeForBroadcast(state) : undefined });
        }

        // Can't vote for yourself
        if (votedForId === playerId) {
          return NextResponse.json({ success: false, error: "Can't vote for yourself" });
        }

        // Record vote (one per player, overwrite if resubmitted before timer)
        state.currentRound.votes[playerId] = votedForId;
        await setGame(roomCode, state);
        await broadcast(roomCode, "game-update", state);

        // Advance early if all eligible voters have voted (players minus bots/missing)
        const eligibleVoters = state.players.length;
        if (Object.keys(state.currentRound.votes).length >= eligibleVoters) {
          await processVotes(state, roomCode);
        }

        return NextResponse.json({ success: true, gameState: sanitizeForBroadcast(state) });
      }

      case "vote-timer-expire": {
        const { roomCode } = body;
        const state = await getGame(roomCode);
        if (!state || state.phase !== "voting" || !state.currentRound) {
          return NextResponse.json({ success: true, gameState: state ? sanitizeForBroadcast(state) : undefined });
        }
        // Only process if not already done (voteReaction empty = not yet processed)
        if (!state.currentRound.voteReaction) {
          await processVotes(state, roomCode);
        }
        return NextResponse.json({ success: true, gameState: sanitizeForBroadcast(state) });
      }

      // Client signals vote reveal animation is done → advance to results
      case "voting-done": {
        const { roomCode } = body;
        const state = await getGame(roomCode);
        if (!state || state.phase !== "voting") {
          return NextResponse.json({ success: true, gameState: state ? sanitizeForBroadcast(state) : undefined });
        }
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
