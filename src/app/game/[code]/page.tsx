"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { getPusherClient } from "@/lib/pusher-client";
import { GameState, Player, GameMessage, AVATAR_CONFIG } from "@/lib/types";
import type { Channel } from "pusher-js";

export default function GamePage() {
  const params = useParams();
  const roomCode = params.code as string;

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [answer, setAnswer] = useState("");
  const [submittedAnswer, setSubmittedAnswer] = useState(false);
  const [answerCount, setAnswerCount] = useState(0);
  const [alienTyping, setAlienTyping] = useState(false);
  const [showingMessages, setShowingMessages] = useState<GameMessage[]>([]);
  const [burnPhase, setBurnPhase] = useState(0); // 0=none, 1=fire, 2=skeleton, 3=ash
  const [shipVisible, setShipVisible] = useState(false);
  const [shipDeparting, setShipDeparting] = useState(false);
  const [beamActive, setBeamActive] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<Channel | null>(null);
  const lastMessageCountRef = useRef(0);

  // Initialize
  useEffect(() => {
    const pid = localStorage.getItem("playerId") || "";
    setPlayerId(pid);

    // Fetch initial state
    fetch("/alien/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get-state", roomCode }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.gameState) {
          setGameState(data.gameState);
          setShowingMessages(data.gameState.messages || []);
        }
      });

    // Subscribe to Pusher
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`game-${roomCode}`);
    channelRef.current = channel;

    channel.bind("game-update", (data: { gameState: GameState }) => {
      setGameState(data.gameState);
      setSubmittedAnswer(false);
      setAnswer("");
      setAnswerCount(0);
    });

    channel.bind(
      "answer-submitted",
      (data: { playerId: string; answerCount: number }) => {
        setAnswerCount(data.answerCount);
      }
    );

    channel.bind("player-joined", (data: { gameState: GameState }) => {
      setGameState(data.gameState);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`game-${roomCode}`);
    };
  }, [roomCode]);

  // Auto-scroll messages and animate new ones
  useEffect(() => {
    if (!gameState) return;
    const messages = gameState.messages || [];

    if (messages.length > lastMessageCountRef.current) {
      // New messages arrived - show typing animation then reveal
      const newMessages = messages.slice(lastMessageCountRef.current);
      const existingMessages = messages.slice(0, lastMessageCountRef.current);

      let delay = 0;
      const animatedMessages: GameMessage[] = [...existingMessages];

      newMessages.forEach((msg, i) => {
        if (msg.sender === "alien") {
          delay += 800; // typing delay for alien messages
        }
        setTimeout(() => {
          setAlienTyping(false);
          setShowingMessages((prev) => [...prev, msg]);
        }, delay);

        if (msg.sender === "alien" && i < newMessages.length - 1) {
          setTimeout(() => setAlienTyping(true), delay - 700);
        }

        delay += 300;
      });

      if (newMessages[0]?.sender === "alien") {
        setAlienTyping(true);
      }

      lastMessageCountRef.current = messages.length;
    }
  }, [gameState?.messages?.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [showingMessages, alienTyping]);

  // Handle arrival animation
  useEffect(() => {
    if (gameState?.phase === "arrival") {
      setShipVisible(true);
    }
  }, [gameState?.phase]);

  // Handle result/departure phase
  useEffect(() => {
    if (gameState?.phase === "result" && gameState.winnerId) {
      // Start departure sequence after a delay
      const timer1 = setTimeout(() => setBeamActive(true), 3000);
      const timer2 = setTimeout(() => {
        setShipDeparting(true);
        setBeamActive(false);
      }, 6000);
      const timer3 = setTimeout(() => setBurnPhase(1), 7000);
      const timer4 = setTimeout(() => setBurnPhase(2), 9000);
      const timer5 = setTimeout(() => setBurnPhase(3), 11000);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        clearTimeout(timer4);
        clearTimeout(timer5);
      };
    }
  }, [gameState?.phase, gameState?.winnerId]);

  const callAPI = useCallback(
    async (action: string, extraData = {}) => {
      const res = await fetch("/alien/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          roomCode,
          playerId,
          ...extraData,
        }),
      });
      return res.json();
    },
    [roomCode, playerId]
  );

  const handleStartGame = async () => {
    setAlienTyping(true);
    await callAPI("start");
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) return;
    setSubmittedAnswer(true);
    setAlienTyping(true);
    await callAPI("submit-answer", { answer: answer.trim() });
  };

  const handleAdvance = async () => {
    setAlienTyping(true);
    await callAPI("advance", { gameState });
  };

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-float">&#x1F6F8;</div>
          <p className="neon-text-green font-pixel text-sm">
            Establishing contact...
          </p>
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players.find((p) => p.id === playerId);
  const isHost = currentPlayer?.isHost || false;
  const phase = gameState.phase;

  // Determine if current player should be able to answer
  const canAnswer = (() => {
    if (!gameState.currentRound || submittedAnswer) return false;
    if (
      phase !== "group-question" &&
      phase !== "hot-seat" &&
      phase !== "espionage" &&
      phase !== "final-plea"
    )
      return false;

    const round = gameState.currentRound;
    if (round.roundType === "group") return true;

    // Individual rounds: only the target player answers
    return round.targetPlayerId === playerId;
  })();

  // Can the host advance?
  const canAdvance =
    isHost &&
    (phase === "intro" || phase === "alien-react");

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-space-mid/80 backdrop-blur border-b border-neon-green/20 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="font-pixel text-xs neon-text-green">THE EXTRACTION</h1>
          <div className="flex items-center gap-3">
            <span className="room-code text-xs tracking-[0.3em]">{roomCode}</span>
            <div className="flex gap-1">
              {gameState.players.map((p) => (
                <div
                  key={p.id}
                  className="avatar-container w-8 h-8 text-lg"
                  style={{
                    // @ts-expect-error custom property
                    "--glow-color": AVATAR_CONFIG[p.avatar]?.color || "#39ff14",
                    background: `${AVATAR_CONFIG[p.avatar]?.color}22`,
                    opacity: p.id === playerId ? 1 : 0.6,
                  }}
                  title={p.alienNickname || p.name}
                >
                  {AVATAR_CONFIG[p.avatar]?.emoji || "\uD83D\uDC64"}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 overflow-hidden flex flex-col max-w-2xl mx-auto w-full">
        {/* LOBBY PHASE */}
        {phase === "lobby" && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
            <div className="text-6xl animate-float">&#x1F6F8;</div>
            <div className="text-center">
              <p className="font-pixel text-xs text-gray-400 mb-2">
                ROOM CODE
              </p>
              <p className="room-code">{roomCode}</p>
              <p className="text-gray-500 text-sm mt-2">
                Share this code with your friends
              </p>
            </div>

            <div className="w-full max-w-xs space-y-3">
              <p className="font-pixel text-xs neon-text-blue text-center">
                CREW ({gameState.players.length}/8)
              </p>
              {gameState.players.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-space-light/50 border border-white/5 animate-slide-up"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div
                    className="avatar-container w-12 h-12 text-2xl"
                    style={{
                      // @ts-expect-error custom property
                      "--glow-color": AVATAR_CONFIG[p.avatar]?.color,
                      background: `${AVATAR_CONFIG[p.avatar]?.color}22`,
                    }}
                  >
                    {AVATAR_CONFIG[p.avatar]?.emoji}
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold">{p.name}</p>
                    <p className="text-gray-500 text-xs">
                      {AVATAR_CONFIG[p.avatar]?.label}
                    </p>
                  </div>
                  {p.isHost && (
                    <span className="text-xs neon-text-yellow font-pixel">
                      HOST
                    </span>
                  )}
                  {p.id === playerId && (
                    <span className="text-xs neon-text-green font-pixel">
                      YOU
                    </span>
                  )}
                </div>
              ))}
            </div>

            {isHost && (
              <button
                onClick={handleStartGame}
                disabled={gameState.players.length < 2}
                className="btn-neon py-4 px-8 mt-4"
              >
                {gameState.players.length < 2
                  ? "Waiting for crew..."
                  : "Begin Extraction"}
              </button>
            )}

            {!isHost && (
              <p className="text-gray-500 text-sm font-mono animate-pulse">
                Waiting for host to start...
              </p>
            )}
          </div>
        )}

        {/* ARRIVAL ANIMATION */}
        {phase === "arrival" && (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div
              className={`spaceship ${shipVisible ? "animate-ship-arrive" : "opacity-0"}`}
            >
              &#x1F6F8;
            </div>
            <div className="mt-8 text-center">
              <p className="font-pixel text-sm neon-text-green animate-pulse-neon">
                INCOMING TRANSMISSION
              </p>
              <div className="typing-indicator justify-center mt-4">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}

        {/* GAME PHASES - Message Feed + Input */}
        {phase !== "lobby" && phase !== "arrival" && (
          <>
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto message-scroll p-4 space-y-3">
              {showingMessages.map((msg, i) => (
                <MessageBubble
                  key={msg.id || i}
                  message={msg}
                  players={gameState.players}
                  currentPlayerId={playerId}
                  index={i}
                />
              ))}

              {/* Show revealed answers */}
              {phase === "answer-reveal" && gameState.currentRound?.revealed && (
                <div className="space-y-2 animate-fade-in">
                  <p className="font-pixel text-xs neon-text-blue text-center my-2">
                    ANSWERS REVEALED
                  </p>
                  {Object.entries(gameState.currentRound.answers).map(
                    ([pid, ans]) => {
                      const p = gameState.players.find(
                        (pl) => pl.id === pid
                      );
                      return (
                        <div
                          key={pid}
                          className="player-bubble p-3 ml-8 animate-slide-up"
                        >
                          <p className="text-xs text-neon-purple mb-1 font-semibold">
                            {p?.alienNickname || p?.name}
                          </p>
                          <p className="text-gray-200 text-sm">{ans}</p>
                        </div>
                      );
                    }
                  )}
                </div>
              )}

              {/* Typing indicator */}
              {alienTyping && (
                <div className="alien-bubble p-3 ml-8">
                  <div className="typing-indicator">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}

              {/* Result / departure phase */}
              {phase === "result" && gameState.winnerId && (
                <div className="text-center py-8 animate-fade-in">
                  <ResultScene
                    players={gameState.players}
                    winnerId={gameState.winnerId}
                    currentPlayerId={playerId}
                    burnPhase={burnPhase}
                    beamActive={beamActive}
                    shipDeparting={shipDeparting}
                  />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Answer input area */}
            <div className="flex-shrink-0 border-t border-neon-green/20 bg-space-mid/80 backdrop-blur p-4">
              {canAnswer && (
                <div className="max-w-2xl mx-auto">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder={
                        gameState.currentRound?.roundType === "espionage"
                          ? "Time to betray..."
                          : "Type your response..."
                      }
                      maxLength={500}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitAnswer();
                        }
                      }}
                      className="flex-1"
                    />
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={!answer.trim()}
                      className="btn-neon px-6 text-xs"
                    >
                      Send
                    </button>
                  </div>
                  <p className="text-gray-600 text-xs mt-1">
                    {answer.length}/500
                  </p>
                </div>
              )}

              {submittedAnswer &&
                (phase === "group-question" ||
                  phase === "hot-seat" ||
                  phase === "espionage" ||
                  phase === "final-plea") && (
                  <div className="text-center">
                    <p className="neon-text-green text-sm font-mono">
                      Answer submitted &#x2713;
                    </p>
                    {gameState.currentRound?.roundType === "group" && (
                      <p className="text-gray-500 text-xs mt-1">
                        Waiting for others... ({answerCount}/
                        {gameState.players.length})
                      </p>
                    )}
                  </div>
                )}

              {canAdvance && (
                <div className="text-center">
                  <button
                    onClick={handleAdvance}
                    className="btn-neon px-8 py-3"
                  >
                    Continue &#x25B6;
                  </button>
                </div>
              )}

              {!canAnswer &&
                !canAdvance &&
                !submittedAnswer &&
                phase !== "result" &&
                phase !== "deliberation" &&
                phase !== "departure" &&
                phase !== "answer-reveal" && (
                  <div className="text-center">
                    <p className="text-gray-500 text-sm font-mono">
                      {phase === "alien-react"
                        ? isHost
                          ? "Press Continue when ready"
                          : "Waiting for host..."
                        : "Watching..."}
                    </p>
                  </div>
                )}

              {(phase === "deliberation" || phase === "answer-reveal") && (
                <div className="text-center">
                  <div className="typing-indicator justify-center">
                    <span />
                    <span />
                    <span />
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    {phase === "deliberation"
                      ? "ZYRAX is deliberating..."
                      : "Processing answers..."}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// --- Sub-components ---

function MessageBubble({
  message,
  players,
  currentPlayerId,
  index,
}: {
  message: GameMessage;
  players: Player[];
  currentPlayerId: string;
  index: number;
}) {
  const isAlien = message.sender === "alien";
  const isSystem = message.sender === "system";
  const targetPlayer = message.targetPlayer
    ? players.find((p) => p.id === message.targetPlayer)
    : null;

  if (isSystem) {
    return (
      <div className="text-center py-2 animate-fade-in">
        <p className="text-gray-500 text-xs font-pixel">{message.text}</p>
      </div>
    );
  }

  if (isAlien) {
    const isTargeted = message.targetPlayer === currentPlayerId;
    return (
      <div
        className={`animate-slide-up ${isTargeted ? "ring-1 ring-neon-green/30 rounded-lg" : ""}`}
        style={{ animationDelay: `${(index % 5) * 100}ms` }}
      >
        {targetPlayer && (
          <p className="text-xs text-neon-blue ml-8 mb-1 font-pixel">
            &#x25B6; TO: {targetPlayer.alienNickname || targetPlayer.name}
            {isTargeted ? " (you)" : ""}
          </p>
        )}
        <div className="alien-bubble p-3 ml-8">
          <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
            {message.text}
          </p>
        </div>
      </div>
    );
  }

  // Player message
  const sender = players.find((p) => p.id === message.sender);
  return (
    <div className="player-bubble p-3 ml-8 animate-slide-up">
      <p className="text-xs text-neon-purple mb-1 font-semibold">
        {sender?.alienNickname || sender?.name || "Unknown"}
        {message.sender === currentPlayerId ? " (you)" : ""}
      </p>
      <p className="text-gray-200 text-sm">{message.text}</p>
    </div>
  );
}

function ResultScene({
  players,
  winnerId,
  currentPlayerId,
  burnPhase,
  beamActive,
  shipDeparting,
}: {
  players: Player[];
  winnerId: string;
  currentPlayerId: string;
  burnPhase: number;
  beamActive: boolean;
  shipDeparting: boolean;
}) {
  const winner = players.find((p) => p.id === winnerId);
  const losers = players.filter((p) => p.id !== winnerId);
  const isWinner = winnerId === currentPlayerId;

  return (
    <div className="space-y-8">
      {/* Spaceship */}
      <div
        className={`text-6xl ${shipDeparting ? "animate-ship-depart" : "animate-float"}`}
      >
        &#x1F6F8;
      </div>

      {/* Beam */}
      {beamActive && (
        <div className="beam h-32 animate-beam-down mx-auto rounded-b-full" />
      )}

      {/* Winner */}
      <div className="space-y-2">
        <p className="font-pixel text-xs neon-text-green">THE CHOSEN ONE</p>
        <div
          className={`inline-flex flex-col items-center gap-2 p-4 rounded-xl bg-neon-green/10 border border-neon-green/30 ${beamActive ? "animate-float" : ""}`}
        >
          <span className="text-4xl">
            {AVATAR_CONFIG[winner?.avatar || "hillbilly"]?.emoji}
          </span>
          <p className="text-white font-bold">
            {winner?.alienNickname || winner?.name}
          </p>
          {isWinner && (
            <p className="neon-text-green font-pixel text-xs">
              THAT&apos;S YOU!
            </p>
          )}
        </div>
      </div>

      {/* Losers */}
      {burnPhase > 0 && (
        <div className="space-y-2">
          <p className="font-pixel text-xs text-red-400">LEFT BEHIND</p>
          <div className="flex justify-center gap-4 flex-wrap">
            {losers.map((p) => (
              <div
                key={p.id}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg transition-all duration-1000 ${
                  burnPhase === 1
                    ? "burn-phase-1"
                    : burnPhase === 2
                      ? "burn-phase-2"
                      : "burn-phase-3"
                }`}
              >
                <span className="text-3xl">
                  {burnPhase <= 1
                    ? AVATAR_CONFIG[p.avatar]?.emoji
                    : burnPhase === 2
                      ? "\uD83D\uDC80"
                      : "\u2728"}
                </span>
                <p className="text-xs text-gray-400">
                  {p.alienNickname || p.name}
                </p>
                {p.id === currentPlayerId && burnPhase < 3 && (
                  <p className="text-red-400 font-pixel text-[8px]">YOU</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game over */}
      {burnPhase >= 3 && (
        <div className="animate-fade-in space-y-4 mt-8">
          <p className="font-pixel text-lg neon-text-pink">GAME OVER</p>
          <p className="text-gray-400 text-sm">
            {isWinner
              ? "You've been extracted. Enjoy the stars."
              : "You've been reduced to cosmic dust. Better luck next apocalypse."}
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            className="btn-neon btn-neon-pink"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
