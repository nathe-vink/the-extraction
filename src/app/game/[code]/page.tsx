"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { getPusherClient } from "@/lib/pusher-client";
import { GameState, Player, GameMessage, AVATAR_CONFIG } from "@/lib/types";
import { PixelAvatar } from "@/components/PixelAvatar";
import type { Channel } from "pusher-js";

interface LiveAnswer {
  playerId: string;
  playerNickname: string;
  answer: string;
}

export default function GamePage() {
  const params = useParams();
  const roomCode = params.code as string;

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [answer, setAnswer] = useState("");
  const [submittedAnswer, setSubmittedAnswer] = useState(false);
  const [liveAnswers, setLiveAnswers] = useState<LiveAnswer[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [burnPhase, setBurnPhase] = useState(0);
  const [shipVisible, setShipVisible] = useState(false);
  const [shipDeparting, setShipDeparting] = useState(false);
  const [beamActive, setBeamActive] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<Channel | null>(null);
  const timerExpiredRef = useRef(false);

  // Initialize
  useEffect(() => {
    const pid = localStorage.getItem("playerId") || "";
    setPlayerId(pid);

    fetch("/alien/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get-state", roomCode }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.gameState) {
          setGameState(data.gameState);
          setInitialLoadDone(true);
        }
      });

    const pusher = getPusherClient();
    const channel = pusher.subscribe(`game-${roomCode}`);
    channelRef.current = channel;

    channel.bind("game-update", (data: { gameState: GameState }) => {
      setGameState(data.gameState);
      // Reset answer state when phase changes to questioning
      if (data.gameState.phase === "questioning") {
        setSubmittedAnswer(false);
        setAnswer("");
        setLiveAnswers([]);
        timerExpiredRef.current = false;
      }
    });

    channel.bind(
      "answer-live",
      (data: {
        playerId: string;
        playerNickname: string;
        answer: string;
      }) => {
        setLiveAnswers((prev) => {
          // Don't add duplicates
          if (prev.some((a) => a.playerId === data.playerId)) return prev;
          return [...prev, data];
        });
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

  // Countdown timer
  useEffect(() => {
    if (!gameState?.roundDeadline || gameState.phase !== "questioning") {
      setTimeLeft(null);
      return;
    }

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((gameState.roundDeadline! - Date.now()) / 1000)
      );
      setTimeLeft(remaining);

      if (remaining <= 0 && !timerExpiredRef.current) {
        timerExpiredRef.current = true;
        // Trigger timer expiry on server
        fetch("/alien/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "timer-expire", roomCode }),
        });
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [gameState?.roundDeadline, gameState?.phase, roomCode]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameState?.messages?.length, liveAnswers.length]);

  // Handle arrival animation
  useEffect(() => {
    if (gameState?.phase === "arrival") {
      setShipVisible(true);
    }
  }, [gameState?.phase]);

  // Handle result/departure phase
  useEffect(() => {
    if (gameState?.phase === "result" && gameState.winnerId) {
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
    await callAPI("start");
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) return;
    setSubmittedAnswer(true);
    await callAPI("submit-answer", { answer: answer.trim() });
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

  // Can current player answer?
  const canAnswer = (() => {
    if (!gameState.currentRound || submittedAnswer) return false;
    if (phase !== "questioning") return false;
    const round = gameState.currentRound;
    if (round.roundType === "spotlight") {
      return round.targetPlayerId === playerId;
    }
    return true; // group, betrayal, final-plea: everyone answers
  })();

  // Timer bar percentage
  const timerPercent =
    timeLeft !== null ? Math.max(0, (timeLeft / 60) * 100) : 0;
  const timerColor =
    timeLeft !== null && timeLeft <= 10
      ? "var(--neon-pink)"
      : "var(--neon-green)";

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-space-mid/80 backdrop-blur border-b border-neon-green/20 px-4 py-2">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="font-pixel text-[10px] neon-text-green leading-none">
            THE EXTRACTION
          </h1>
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[10px] neon-text-yellow tracking-widest">
              {roomCode}
            </span>
            <div className="flex gap-0.5">
              {gameState.players.map((p) => (
                <div
                  key={p.id}
                  className="relative"
                  title={p.alienNickname || p.name}
                  style={{ opacity: p.id === playerId ? 1 : 0.6 }}
                >
                  <PixelAvatar type={p.avatar} size={24} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Timer bar */}
      {phase === "questioning" && timeLeft !== null && (
        <div className="flex-shrink-0 h-1 bg-space-mid/50">
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{
              width: `${timerPercent}%`,
              backgroundColor: timerColor,
              boxShadow: `0 0 8px ${timerColor}`,
            }}
          />
        </div>
      )}

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
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 animate-slide-up"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <PixelAvatar type={p.avatar} size={40} />
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
              <p className="font-pixel text-sm neon-text-green animate-pulse">
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
              {gameState.messages.map((msg, i) => (
                <MessageBubble
                  key={msg.id || i}
                  message={msg}
                  players={gameState.players}
                  currentPlayerId={playerId}
                  isNew={initialLoadDone && i >= (gameState.messages.length - 1)}
                />
              ))}

              {/* Live answers appearing in real-time */}
              {liveAnswers.length > 0 && phase === "questioning" && (
                <div className="space-y-2">
                  <p className="font-pixel text-[10px] neon-text-blue text-center my-2">
                    ANSWERS
                  </p>
                  {liveAnswers.map((la) => (
                    <div
                      key={la.playerId}
                      className="player-bubble p-3 ml-8 animate-slide-up"
                    >
                      <p className="text-xs text-neon-purple mb-1 font-semibold">
                        {la.playerNickname}
                        {la.playerId === playerId ? " (you)" : ""}
                      </p>
                      <p className="text-gray-200 text-sm">{la.answer}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Processing indicator */}
              {(phase === "processing" || phase === "deliberation") && (
                <div className="text-center py-4">
                  <div className="alien-bubble p-3 ml-8 inline-block">
                    <div className="typing-indicator">
                      <span />
                      <span />
                      <span />
                    </div>
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
            <div className="flex-shrink-0 border-t border-neon-green/20 bg-space-mid/80 backdrop-blur p-3">
              {canAnswer && (
                <div className="max-w-2xl mx-auto">
                  {timeLeft !== null && (
                    <p className="text-center font-pixel text-xs mb-2" style={{ color: timerColor }}>
                      {timeLeft}s
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Type your answer..."
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
                </div>
              )}

              {submittedAnswer && phase === "questioning" && (
                <div className="text-center">
                  <p className="neon-text-green text-sm font-mono">
                    Answer submitted &#x2713;
                  </p>
                  {gameState.currentRound?.roundType !== "spotlight" && (
                    <p className="text-gray-500 text-xs mt-1">
                      Waiting for others... ({liveAnswers.length}/
                      {gameState.players.length})
                    </p>
                  )}
                </div>
              )}

              {!canAnswer &&
                !submittedAnswer &&
                phase === "questioning" &&
                gameState.currentRound?.roundType === "spotlight" &&
                gameState.currentRound?.targetPlayerId !== playerId && (
                  <div className="text-center">
                    <p className="text-gray-500 text-sm font-mono">
                      Watching the spotlight...
                    </p>
                  </div>
                )}

              {phase === "processing" && (
                <div className="text-center">
                  <p className="text-gray-500 text-xs font-mono">
                    ZYRAX is thinking...
                  </p>
                </div>
              )}

              {phase === "deliberation" && (
                <div className="text-center">
                  <p className="text-gray-500 text-xs font-mono">
                    ZYRAX is making a decision...
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
  isNew,
}: {
  message: GameMessage;
  players: Player[];
  currentPlayerId: string;
  isNew: boolean;
}) {
  const isAlien = message.sender === "alien";
  const isSystem = message.sender === "system";
  const targetPlayer = message.targetPlayer
    ? players.find((p) => p.id === message.targetPlayer)
    : null;

  const animClass = isNew ? "animate-slide-up" : "";

  if (isSystem) {
    return (
      <div className={`text-center py-2 ${animClass}`}>
        <p className="text-gray-500 text-xs font-pixel">{message.text}</p>
      </div>
    );
  }

  if (isAlien) {
    const isTargeted = message.targetPlayer === currentPlayerId;
    return (
      <div
        className={`${animClass} ${isTargeted ? "ring-1 ring-neon-green/30 rounded-lg" : ""}`}
      >
        {targetPlayer && (
          <p className="text-xs text-neon-blue ml-8 mb-1 font-pixel">
            &#x25B6; {targetPlayer.alienNickname || targetPlayer.name}
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
    <div className={`player-bubble p-3 ml-8 ${animClass}`}>
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
      <div
        className={`text-6xl ${shipDeparting ? "animate-ship-depart" : "animate-float"}`}
      >
        &#x1F6F8;
      </div>

      {beamActive && (
        <div className="beam h-32 animate-beam-down mx-auto rounded-b-full" />
      )}

      <div className="space-y-2">
        <p className="font-pixel text-xs neon-text-green">THE CHOSEN ONE</p>
        <div
          className={`inline-flex flex-col items-center gap-2 p-4 rounded-xl bg-neon-green/10 border border-neon-green/30 ${beamActive ? "animate-float" : ""}`}
        >
          <PixelAvatar type={winner?.avatar || "hillbilly"} size={48} />
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
                {burnPhase <= 1 ? (
                  <PixelAvatar type={p.avatar} size={36} />
                ) : (
                  <span className="text-3xl">
                    {burnPhase === 2 ? "\uD83D\uDC80" : "\u2728"}
                  </span>
                )}
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

      {burnPhase >= 3 && (
        <div className="animate-fade-in space-y-4 mt-8">
          <p className="font-pixel text-lg neon-text-pink">GAME OVER</p>
          <p className="text-gray-400 text-sm">
            {isWinner
              ? "You've been extracted. Enjoy the stars."
              : "You've been reduced to cosmic dust. Better luck next apocalypse."}
          </p>
          <button
            onClick={() => (window.location.href = "/alien")}
            className="btn-neon btn-neon-pink"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
