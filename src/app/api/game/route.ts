import { NextRequest, NextResponse } from "next/server";
import { triggerGameEvent } from "@/lib/pusher-server";
import { getGame, setGame } from "@/lib/game-store";
import {
  generateNicknames,
  generateIntroduction,
  generateQuestion,
  generateGroupReaction,
  generateDeliberation,
} from "@/lib/alien-ai";
import {
  GamePhase,
  GameState,
  Player,
  GameMessage,
  RoundState,
  createInitialGameState,
  generateRoomCode,
  generatePlayerId,
  getAvailableAvatar,
} from "@/lib/types";

const ROUND_DURATION = 60000; // 60 seconds

function addMessage(
  state: GameState,
  sender: string,
  text: string,
  targetPlayer?: string
): GameMessage {
  const msg: GameMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sender,
    text,
    timestamp: Date.now(),
    targetPlayer,
  };
  state.messages.push(msg);
  return msg;
}

// Determine next round info
function getNextRound(
  state: GameState
):
  | "deliberation"
  | {
      roundType: "group" | "spotlight" | "betrayal" | "final-plea";
      targetPlayer?: Player;
    } {
  const groupRounds = state.roundHistory.filter(
    (r) => r.roundType === "group"
  ).length;
  const spotlightRounds = state.roundHistory.filter(
    (r) => r.roundType === "spotlight"
  ).length;
  const betrayalRounds = state.roundHistory.filter(
    (r) => r.roundType === "betrayal"
  ).length;
  const pleaRounds = state.roundHistory.filter(
    (r) => r.roundType === "final-plea"
  ).length;

  if (groupRounds < 2) {
    return { roundType: "group" };
  }
  if (spotlightRounds < state.players.length) {
    const target =
      state.players[state.currentSpotlightIndex % state.players.length];
    return { roundType: "spotlight", targetPlayer: target };
  }
  if (betrayalRounds < 1) {
    return { roundType: "betrayal" };
  }
  if (pleaRounds < 1) {
    return { roundType: "final-plea" };
  }
  return "deliberation";
}

// Set up a new question round
async function setupNextQuestion(
  state: GameState,
  roomCode: string
): Promise<void> {
  const next = getNextRound(state);

  if (next === "deliberation") {
    // Deliberation phase
    state.phase = "deliberation";
    addMessage(state, "system", "ZYRAX is making a decision...");
    await setGame(roomCode, state);
    await triggerGameEvent(roomCode, "game-update", { gameState: state });

    try {
      const { deliberation, winnerId } = await generateDeliberation(state);
      state.phase = "result";
      state.winnerId = winnerId;
      state.roundDeadline = null;
      addMessage(state, "alien", deliberation);
    } catch (err) {
      console.error("Error generating deliberation:", err);
      const topPlayer = Object.entries(state.scores).sort(
        ([, a], [, b]) => b - a
      )[0];
      state.phase = "result";
      state.winnerId = topPlayer?.[0] || state.players[0]?.id;
      state.roundDeadline = null;
      addMessage(
        state,
        "alien",
        "This has been... really something. I've made my choice."
      );
    }
    await setGame(roomCode, state);
    await triggerGameEvent(roomCode, "game-update", { gameState: state });
    return;
  }

  // Generate next question
  const { roundType, targetPlayer } = next;

  try {
    const question = await generateQuestion(
      state,
      roundType,
      targetPlayer
    );

    state.currentRound = {
      roundNumber: state.roundHistory.length + 1,
      roundType,
      question,
      targetPlayerId: targetPlayer?.id,
      answers: {},
      alienReaction: "",
    };

    if (roundType === "spotlight" && targetPlayer) {
      addMessage(
        state,
        "alien",
        `${targetPlayer.alienNickname}, this one's for you: ${question}`,
        targetPlayer.id
      );
    } else {
      addMessage(state, "alien", question);
    }

    state.conversationContext.push({
      role: "assistant",
      content: `Asked ${roundType} question: "${question}"${targetPlayer ? ` to ${targetPlayer.alienNickname}` : ""}`,
    });

    state.phase = "questioning";
    state.roundDeadline = Date.now() + ROUND_DURATION;
  } catch (err) {
    console.error("Error generating question:", err);
    state.currentRound = {
      roundNumber: state.roundHistory.length + 1,
      roundType: "group",
      question: "Tell me something about yourselves that would surprise me.",
      answers: {},
      alienReaction: "",
    };
    addMessage(
      state,
      "alien",
      "Tell me something about yourselves that would surprise me."
    );
    state.phase = "questioning";
    state.roundDeadline = Date.now() + ROUND_DURATION;
  }

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

  // Show processing state briefly
  state.phase = "processing";
  state.roundDeadline = null;
  await setGame(roomCode, state);
  await triggerGameEvent(roomCode, "game-update", { gameState: state });

  // Generate group reaction
  try {
    const { reaction, scores } = await generateGroupReaction(
      state,
      round.answers
    );
    round.alienReaction = reaction;
    state.scores = { ...state.scores, ...scores };
    addMessage(state, "alien", reaction);
  } catch (err) {
    console.error("Error generating reaction:", err);
    round.alienReaction = "Interesting answers, everyone...";
    addMessage(state, "alien", round.alienReaction);
  }

  // Update conversation context
  state.conversationContext.push({
    role: "user",
    content: `Answers to "${round.question}": ${Object.entries(round.answers)
      .map(([pid, ans]) => {
        const p = state.players.find((pl) => pl.id === pid);
        return `${p?.alienNickname}: "${ans}"`;
      })
      .join(", ")}`,
  });
  state.conversationContext.push({
    role: "assistant",
    content: round.alienReaction,
  });

  // Archive round
  state.roundHistory.push({ ...round });

  // Advance spotlight index
  if (round.roundType === "spotlight") {
    state.currentSpotlightIndex++;
  }

  // Set up next question (or deliberation)
  await setupNextQuestion(state, roomCode);
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
          alienNickname: "",
          avatar: getAvailableAvatar([]),
          isHost: true,
          connected: true,
        };

        state.players.push(player);
        state.scores[playerId] = 50;
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
          alienNickname: "",
          avatar: getAvailableAvatar(state.players),
          isHost: false,
          connected: true,
        };

        state.players.push(player);
        state.scores[playerId] = 50;
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

        // Phase: Arrival (clients see animation while we generate)
        state.phase = "arrival";
        state.gameStartedAt = Date.now();
        await setGame(roomCode, state);
        await triggerGameEvent(roomCode, "game-update", {
          gameState: state,
        });

        // Generate nicknames + intro inline
        try {
          const nicknames = await generateNicknames(state.players);

          for (const player of state.players) {
            const nicknameData = nicknames[player.id];
            if (nicknameData && typeof nicknameData === "object") {
              player.alienNickname =
                (nicknameData as Record<string, string>).nickname ||
                `Friend ${player.name[0]}`;
            } else if (typeof nicknameData === "string") {
              player.alienNickname = nicknameData;
            } else {
              player.alienNickname = `Friend ${player.name[0]}`;
            }
          }

          const introduction = await generateIntroduction(state.players);
          addMessage(state, "alien", introduction);

          // Single group nickname announcement
          const nicknameList = state.players
            .map((p) => {
              const nd = nicknames[p.id];
              if (nd && typeof nd === "object") {
                return (nd as Record<string, string>).introduction || `${p.name} — I'll call you ${p.alienNickname}.`;
              }
              return `${p.name} — I'll call you ${p.alienNickname}.`;
            })
            .join(" ");
          addMessage(state, "alien", nicknameList);

          state.conversationContext.push({
            role: "assistant",
            content: `Introduction: ${introduction}. Nicknames: ${state.players.map((p) => `${p.name} -> ${p.alienNickname}`).join(", ")}`,
          });
        } catch (err) {
          console.error("Error generating intro:", err);
          addMessage(
            state,
            "alien",
            "Hey everyone. So... my people are going to destroy Earth. Not my call, I'm really sorry. But I can save ONE of you. Let's figure out who, yeah?"
          );
          state.players.forEach((p) => {
            p.alienNickname = `Friend ${p.name[0].toUpperCase()}`;
          });
        }

        // Immediately set up first question
        await setupNextQuestion(state, roomCode);

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

        // Ignore if already in processing/deliberation
        if (state.phase !== "questioning") {
          return NextResponse.json({ success: true, gameState: state });
        }

        state.currentRound.answers[playerId] = answer;
        const player = state.players.find((p) => p.id === playerId);

        // Save answer immediately
        await setGame(roomCode, state);

        // Broadcast live answer to all clients
        await triggerGameEvent(roomCode, "answer-live", {
          playerId,
          playerNickname: player?.alienNickname || player?.name || "Someone",
          answer,
          answerCount: Object.keys(state.currentRound.answers).length,
          expectedAnswers:
            state.currentRound.roundType === "spotlight"
              ? 1
              : state.players.length,
        });

        // Check if all expected answers are in
        const isIndividual = state.currentRound.roundType === "spotlight";
        const expectedAnswers = isIndividual ? 1 : state.players.length;
        const answerCount = Object.keys(state.currentRound.answers).length;

        if (answerCount >= expectedAnswers) {
          // All answers in — process the round
          await processRound(state, roomCode);
        }

        return NextResponse.json({ success: true, gameState: state });
      }

      case "timer-expire": {
        const { roomCode } = body;
        const state = await getGame(roomCode);

        // Only process if still in questioning phase (prevents duplicate processing)
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
