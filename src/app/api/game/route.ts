import { NextRequest, NextResponse } from "next/server";
import { triggerGameEvent } from "@/lib/pusher-server";
import {
  generateNicknames,
  generateIntroduction,
  generateQuestion,
  generateReactions,
  generateDeliberation,
} from "@/lib/alien-ai";
import {
  GamePhase,
  GameState,
  Player,
  GameMessage,
  createInitialGameState,
  generateRoomCode,
  generatePlayerId,
  getAvailableAvatar,
} from "@/lib/types";

// In-memory game store (works on Vercel when lambda stays warm)
const games = new Map<string, GameState>();

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
        games.set(roomCode, state);

        return NextResponse.json({
          success: true,
          gameState: state,
          playerId,
          roomCode,
        });
      }

      case "join": {
        const { roomCode, playerName } = body;
        const state = games.get(roomCode.toUpperCase());

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
        const state = games.get(roomCode?.toUpperCase());
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
        const state = games.get(roomCode);
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

        // Phase: Arrival
        state.phase = "arrival";
        state.gameStartedAt = Date.now();

        await triggerGameEvent(roomCode, "game-update", {
          gameState: state,
        });

        // Generate intro inline (no setTimeout — Vercel freezes lambdas after response)
        // Clients already see the arrival animation via the Pusher event above
        try {
          // Generate nicknames
          const nicknames = await generateNicknames(state.players);

          // Apply nicknames
          for (const player of state.players) {
            const nicknameData = nicknames[player.id];
            if (nicknameData && typeof nicknameData === "object") {
              player.alienNickname = (nicknameData as Record<string, string>).nickname || `Specimen ${player.name[0]}`;
            } else if (typeof nicknameData === "string") {
              player.alienNickname = nicknameData;
            } else {
              player.alienNickname = `Specimen ${player.name[0]}`;
            }
          }

          // Generate intro
          const introduction = await generateIntroduction(state.players);

          state.phase = "intro";
          addMessage(state, "alien", introduction);

          // Add nickname introductions
          for (const player of state.players) {
            const nicknameData = nicknames[player.id];
            let introText = `${player.name}... I'm going to call you ${player.alienNickname}.`;
            if (nicknameData && typeof nicknameData === "object") {
              introText = (nicknameData as Record<string, string>).introduction || introText;
            }
            addMessage(state, "alien", introText, player.id);
          }

          // Store conversation context
          state.conversationContext.push({
            role: "assistant",
            content: `Introduction: ${introduction}. Players nicknamed: ${state.players.map((p) => `${p.name} -> ${p.alienNickname}`).join(", ")}`,
          });

          await triggerGameEvent(roomCode, "game-update", {
            gameState: state,
          });
        } catch (err) {
          console.error("Error generating intro:", err);
          state.phase = "intro";
          addMessage(state, "alien", "I am ZYRAX. Your planet ends tonight. One of you gets to live. Impress me.");
          state.players.forEach((p) => {
            p.alienNickname = `Specimen ${p.name[0].toUpperCase()}`;
          });
          await triggerGameEvent(roomCode, "game-update", { gameState: state });
        }

        return NextResponse.json({ success: true, gameState: state });
      }

      case "advance": {
        const { roomCode, gameState: clientState } = body;
        let state = games.get(roomCode);
        if (!state) {
          return NextResponse.json({
            success: false,
            error: "Room not found",
          });
        }

        // Determine next phase
        const nextPhase = getNextPhase(state);

        if (!nextPhase) {
          return NextResponse.json({
            success: false,
            error: "Game is over",
          });
        }

        state.phase = nextPhase;

        if (
          nextPhase === "group-question" ||
          nextPhase === "hot-seat" ||
          nextPhase === "espionage" ||
          nextPhase === "final-plea"
        ) {
          let roundType = nextPhase === "group-question" ? "group" as const : nextPhase as "hot-seat" | "espionage" | "final-plea";

          let targetPlayer: Player | undefined;
          let aboutPlayer: Player | undefined;

          if (nextPhase === "hot-seat") {
            targetPlayer = state.players[state.currentHotSeatIndex % state.players.length];
          } else if (nextPhase === "espionage") {
            targetPlayer = state.players[state.currentEspionageIndex % state.players.length];
            // Pick someone else to ask about
            const others = state.players.filter((p) => p.id !== targetPlayer!.id);
            aboutPlayer = others[Math.floor(Math.random() * others.length)];
          } else if (nextPhase === "final-plea") {
            targetPlayer = state.players[state.currentFinalPleaIndex % state.players.length];
          }

          try {
            const question = await generateQuestion(
              state,
              roundType,
              targetPlayer,
              aboutPlayer
            );

            state.currentRound = {
              roundNumber: state.roundHistory.length + 1,
              roundType: roundType,
              question,
              targetPlayerId: targetPlayer?.id,
              aboutPlayerId: aboutPlayer?.id,
              answers: {},
              revealed: false,
              alienReactions: {},
            };

            const questionPrefix =
              nextPhase === "hot-seat"
                ? `*turns to ${targetPlayer?.alienNickname}* `
                : nextPhase === "espionage"
                  ? `*eyes ${targetPlayer?.alienNickname} with a knowing grin* `
                  : nextPhase === "final-plea"
                    ? `*gestures to ${targetPlayer?.alienNickname}* `
                    : "";

            addMessage(
              state,
              "alien",
              questionPrefix + question,
              targetPlayer?.id
            );

            state.conversationContext.push({
              role: "assistant",
              content: `Asked ${nextPhase} question: "${question}"${targetPlayer ? ` to ${targetPlayer.alienNickname}` : ""}${aboutPlayer ? ` about ${aboutPlayer.alienNickname}` : ""}`,
            });
          } catch (err) {
            console.error("Error generating question:", err);
            const fallback = "Tell me something that makes you worthy of salvation.";
            state.currentRound = {
              roundNumber: state.roundHistory.length + 1,
              roundType: roundType,
              question: fallback,
              targetPlayerId: targetPlayer?.id,
              aboutPlayerId: aboutPlayer?.id,
              answers: {},
              revealed: false,
              alienReactions: {},
            };
            addMessage(state, "alien", fallback, targetPlayer?.id);
          }
        } else if (nextPhase === "deliberation") {
          addMessage(
            state,
            "alien",
            "*leans back and strokes chin thoughtfully* Hmmm... Let me think about this..."
          );

          // Send deliberation message to clients immediately
          await triggerGameEvent(roomCode, "game-update", {
            gameState: state,
          });

          // Generate deliberation inline (no setTimeout — Vercel freezes lambdas after response)
          try {
            const { deliberation, winnerId } =
              await generateDeliberation(state);
            state.phase = "result";
            state.winnerId = winnerId;
            addMessage(state, "alien", deliberation);

            await triggerGameEvent(roomCode, "game-update", {
              gameState: state,
            });
          } catch (err) {
            console.error("Error generating deliberation:", err);
            const topPlayer = Object.entries(state.scores).sort(
              ([, a], [, b]) => b - a
            )[0];
            state.phase = "result";
            state.winnerId = topPlayer?.[0] || state.players[0]?.id;
            addMessage(
              state,
              "alien",
              "I've made my decision. One of you has proven... adequate."
            );
            await triggerGameEvent(roomCode, "game-update", {
              gameState: state,
            });
          }
        }

        await triggerGameEvent(roomCode, "game-update", {
          gameState: state,
        });

        return NextResponse.json({ success: true, gameState: state });
      }

      case "submit-answer": {
        const { roomCode, playerId, answer } = body;
        const state = games.get(roomCode);
        if (!state || !state.currentRound) {
          return NextResponse.json({
            success: false,
            error: "No active round",
          });
        }

        state.currentRound.answers[playerId] = answer;
        const player = state.players.find((p) => p.id === playerId);

        // Check if all expected players have answered
        const isGroupRound = state.currentRound.roundType === "group";
        const expectedAnswers = isGroupRound
          ? state.players.length
          : 1; // Individual rounds only need 1 answer

        const answerCount = Object.keys(state.currentRound.answers).length;

        // Notify others that someone submitted
        await triggerGameEvent(roomCode, "answer-submitted", {
          playerId,
          playerNickname: player?.alienNickname,
          answerCount,
          expectedAnswers,
        });

        if (answerCount >= expectedAnswers) {
          // All answers in — reveal and get alien reactions
          state.currentRound.revealed = true;
          state.phase = "answer-reveal";

          await triggerGameEvent(roomCode, "game-update", {
            gameState: state,
          });

          // Get alien reactions
          try {
            const { reactions, scores, alienSummary } =
              await generateReactions(state, state.currentRound.answers);

            state.currentRound.alienReactions = reactions;
            state.scores = scores;
            state.phase = "alien-react";

            // Add reaction messages
            for (const [pid, reaction] of Object.entries(reactions)) {
              const p = state.players.find((pl) => pl.id === pid);
              addMessage(
                state,
                "alien",
                `*looks at ${p?.alienNickname}* ${reaction}`,
                pid
              );
            }

            addMessage(state, "alien", alienSummary);

            // Update conversation context
            state.conversationContext.push({
              role: "user",
              content: `Player answers: ${Object.entries(state.currentRound.answers)
                .map(([pid, ans]) => {
                  const p = state.players.find((pl) => pl.id === pid);
                  return `${p?.alienNickname}: "${ans}"`;
                })
                .join(", ")}`,
            });
            state.conversationContext.push({
              role: "assistant",
              content: `Reactions: ${JSON.stringify(reactions)}. Summary: ${alienSummary}`,
            });

            // Archive round
            state.roundHistory.push({ ...state.currentRound });

            // Advance index for sequential rounds
            if (state.currentRound.roundType === "hot-seat") {
              state.currentHotSeatIndex++;
            } else if (state.currentRound.roundType === "espionage") {
              state.currentEspionageIndex++;
            } else if (state.currentRound.roundType === "final-plea") {
              state.currentFinalPleaIndex++;
            }

            await triggerGameEvent(roomCode, "game-update", {
              gameState: state,
            });
          } catch (err) {
            console.error("Error generating reactions:", err);
            state.phase = "alien-react";
            addMessage(state, "alien", "Hmm... interesting responses, all of you.");
            state.roundHistory.push({ ...state.currentRound });
            await triggerGameEvent(roomCode, "game-update", {
              gameState: state,
            });
          }
        }

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

function getNextPhase(state: GameState): GamePhase | null {
  const { phase, roundHistory, players } = state;
  const groupRoundsPlayed = roundHistory.filter(
    (r) => r.roundType === "group"
  ).length;
  const hotSeatRoundsPlayed = roundHistory.filter(
    (r) => r.roundType === "hot-seat"
  ).length;
  const espionageRoundsPlayed = roundHistory.filter(
    (r) => r.roundType === "espionage"
  ).length;
  const finalPleaRoundsPlayed = roundHistory.filter(
    (r) => r.roundType === "final-plea"
  ).length;

  // Game flow:
  // 1. Two group rounds
  // 2. Hot seat (one per player)
  // 3. Espionage (one per player)
  // 4. Final plea (one per player)
  // 5. Deliberation

  if (phase === "intro" || (phase === "alien-react" && groupRoundsPlayed < 2)) {
    return "group-question";
  }

  if (
    phase === "alien-react" &&
    groupRoundsPlayed >= 2 &&
    hotSeatRoundsPlayed < players.length
  ) {
    return "hot-seat";
  }

  if (
    phase === "alien-react" &&
    hotSeatRoundsPlayed >= players.length &&
    espionageRoundsPlayed < players.length
  ) {
    return "espionage";
  }

  if (
    phase === "alien-react" &&
    espionageRoundsPlayed >= players.length &&
    finalPleaRoundsPlayed < players.length
  ) {
    return "final-plea";
  }

  if (
    phase === "alien-react" &&
    finalPleaRoundsPlayed >= players.length
  ) {
    return "deliberation";
  }

  return null;
}
