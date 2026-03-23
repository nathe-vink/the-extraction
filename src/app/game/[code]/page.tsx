"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { getPusherClient } from "@/lib/pusher-client";
import { GameState, Player, GameMessage, AVATAR_CONFIG, AnswerReview } from "@/lib/types";
import { PixelAvatar } from "@/components/PixelAvatar";
import { TypewriterText } from "@/components/TypewriterText";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { soundEngine } from "@/lib/sound-engine";
import type { Channel } from "pusher-js";

interface LiveAnswer {
  playerId: string;
  playerName: string;
  answer: string;
}

const PROCESSING_PHRASES = [
  "ANALYZING RESPONSES...",
  "COMPUTING WORTHINESS...",
  "CALIBRATING JUDGMENT MATRIX...",
  "CONSULTING GALACTIC DATABASE...",
  "PROCESSING HUMAN OUTPUT...",
  "EVALUATING SURVIVAL POTENTIAL...",
  "CROSS-REFERENCING WITH VEXAR-9 STANDARDS...",
];

const REVIEW_DURATION = 5000; // 5 seconds per player review

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
  const [startError, setStartError] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [processingPhrase, setProcessingPhrase] = useState(PROCESSING_PHRASES[0]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(-1);
  const [lastTypewriterMsgId, setLastTypewriterMsgId] = useState<string>("");
  const [phaseTransition, setPhaseTransition] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [soundInitialized, setSoundInitialized] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<Channel | null>(null);
  const timerExpiredRef = useRef(false);
  const reviewingDoneRef = useRef(false);
  const previousPhaseRef = useRef<string>("");

  // Initialize sound on first user gesture
  const initSound = useCallback(() => {
    if (!soundInitialized) {
      soundEngine.init();
      setSoundInitialized(true);
      setMuted(soundEngine.muted);
    }
  }, [soundInitialized]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    initSound();
    const newMuted = !muted;
    setMuted(newMuted);
    soundEngine.setMuted(newMuted);
  }, [muted, initSound]);

  // Initialize
  useEffect(() => {
    const pid = localStorage.getItem("playerId") || "";
    setPlayerId(pid);

    fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get-state", roomCode }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.gameState) {
          setGameState(data.gameState);
          setReadyCount(data.gameState.readyPlayers?.length || 0);
          setInitialLoadDone(true);
        }
      });

    const pusher = getPusherClient();
    const channel = pusher.subscribe(`game-${roomCode}`);
    channelRef.current = channel;

    channel.bind("game-update", (data: { gameState: GameState }) => {
      setGameState(data.gameState);
      setReadyCount(data.gameState.readyPlayers?.length || 0);
      if (data.gameState.phase === "questioning") {
        setSubmittedAnswer(false);
        setAnswer("");
        setLiveAnswers([]);
        setIsReady(false);
        timerExpiredRef.current = false;
      }
      if (data.gameState.phase === "reviewing") {
        setCurrentReviewIndex(-1);
        reviewingDoneRef.current = false;
      }
      if (data.gameState.phase === "results" || data.gameState.phase === "intro") {
        setIsReady(false);
      }
      // Track last alien message for typewriter
      const msgs = data.gameState.messages;
      const lastAlien = [...msgs].reverse().find((m) => m.sender === "alien");
      if (lastAlien) setLastTypewriterMsgId(lastAlien.id);
    });

    channel.bind(
      "answer-live",
      (data: { playerId: string; playerName: string; answer: string }) => {
        setLiveAnswers((prev) => {
          if (prev.some((a) => a.playerId === data.playerId)) return prev;
          return [...prev, data];
        });
      }
    );

    channel.bind("player-joined", (data: { gameState: GameState }) => {
      setGameState(data.gameState);
    });

    channel.bind(
      "player-ready",
      (data: { gameState: GameState; readyCount: number }) => {
        setReadyCount(data.readyCount);
        setGameState(data.gameState);
      }
    );

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`game-${roomCode}`);
    };
  }, [roomCode]);

  // Phase transition overlay
  useEffect(() => {
    if (!gameState) return;
    const phase = gameState.phase;
    const prevPhase = previousPhaseRef.current;
    previousPhaseRef.current = phase;

    if (prevPhase === phase || !prevPhase) return;

    let text: string | null = null;
    if (phase === "questioning" && gameState.currentRound) {
      const rn = gameState.currentRound.roundNumber;
      const type = gameState.currentRound.roundType;
      if (type === "drawing") {
        text = `ROUND ${rn} — DRAW!`;
      } else if (type === "final-plea") {
        text = `FINAL ROUND — 2X POINTS!`;
      } else {
        text = `ROUND ${rn}`;
      }
      soundEngine.playRoundStart();
    } else if (phase === "reviewing") {
      text = "REVIEWING ANSWERS...";
    } else if (phase === "results") {
      text = "SCORES ARE IN";
    } else if (phase === "final-results") {
      text = "FINAL RESULTS";
    }

    if (text) {
      setPhaseTransition(text);
      setTimeout(() => setPhaseTransition(null), 2500);
    }
  }, [gameState?.phase, gameState?.currentRound?.roundNumber]);

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

      // Sound effects for countdown
      if (remaining > 0 && remaining <= 10) {
        soundEngine.playCountdownUrgent();
      } else if (remaining > 0 && remaining <= 30 && remaining % 5 === 0) {
        soundEngine.playCountdownTick();
      }

      if (remaining <= 0 && !timerExpiredRef.current) {
        timerExpiredRef.current = true;
        fetch("/api/game", {
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

  // Ambient sound during questioning
  useEffect(() => {
    if (gameState?.phase === "questioning") {
      soundEngine.startAmbient();
    } else {
      soundEngine.stopAmbient();
    }
  }, [gameState?.phase]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameState?.messages?.length, liveAnswers.length, currentReviewIndex]);

  // Arrival animation
  useEffect(() => {
    if (gameState?.phase === "arrival") {
      setShipVisible(true);
    }
  }, [gameState?.phase]);

  // Processing phrase cycling
  useEffect(() => {
    if (gameState?.phase !== "processing") return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % PROCESSING_PHRASES.length;
      setProcessingPhrase(PROCESSING_PHRASES[i]);
    }, 1500);
    return () => clearInterval(interval);
  }, [gameState?.phase]);

  // Review cycling — auto-advance through reviews
  useEffect(() => {
    if (gameState?.phase !== "reviewing" || !gameState.currentRound?.answerReviews?.length) return;

    const reviews = gameState.currentRound.answerReviews;
    // Start first review after a brief pause
    const startTimer = setTimeout(() => setCurrentReviewIndex(0), 800);

    return () => clearTimeout(startTimer);
  }, [gameState?.phase, gameState?.currentRound?.answerReviews?.length]);

  // Auto-advance reviews
  useEffect(() => {
    if (gameState?.phase !== "reviewing" || currentReviewIndex < 0) return;

    const reviews = gameState.currentRound?.answerReviews || [];
    if (currentReviewIndex >= reviews.length) {
      // All reviews shown — signal reviewing done
      if (!reviewingDoneRef.current) {
        reviewingDoneRef.current = true;
        setTimeout(() => {
          fetch("/api/game", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reviewing-done", roomCode }),
          });
        }, 1000);
      }
      return;
    }

    // Play score reveal sound for current review
    const review = reviews[currentReviewIndex];
    if (review) {
      const maxScore = gameState.currentRound?.roundType === "final-plea" ? 2000 : 1000;
      setTimeout(() => soundEngine.playScoreReveal(review.score, maxScore), 500);
    }

    // Auto-advance to next review
    const timer = setTimeout(() => {
      setCurrentReviewIndex((i) => i + 1);
    }, REVIEW_DURATION);

    return () => clearTimeout(timer);
  }, [currentReviewIndex, gameState?.phase, gameState?.currentRound, roomCode]);

  // Result/departure phase
  useEffect(() => {
    if (gameState?.phase === "result" && gameState.winnerId) {
      const timer1 = setTimeout(() => setBeamActive(true), 3000);
      const timer2 = setTimeout(() => {
        setShipDeparting(true);
        setBeamActive(false);
        soundEngine.playShipDepart();
      }, 6000);
      const timer3 = setTimeout(() => { setBurnPhase(1); soundEngine.playBurn(); }, 7000);
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

  // Transition from final-results to result after delay
  useEffect(() => {
    if (gameState?.phase === "final-results") {
      const timer = setTimeout(() => {
        setGameState((prev) => prev ? { ...prev, phase: "result" } : prev);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [gameState?.phase]);

  const callAPI = useCallback(
    async (action: string, extraData = {}) => {
      try {
        const res = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            roomCode,
            playerId,
            ...extraData,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          console.error(`API action "${action}" failed:`, res.status, text);
          return { success: false, error: `Server error (${res.status})` };
        }
        return res.json();
      } catch (err) {
        console.error(`API action "${action}" error:`, err);
        return { success: false, error: "Connection failed" };
      }
    },
    [roomCode, playerId]
  );

  const handleStartGame = async () => {
    initSound();
    setStartError("");
    const data = await callAPI("start");
    if (data && !data.success) {
      setStartError(data.error || "Failed to start game. Try again.");
    }
  };

  const handleReady = async () => {
    initSound();
    if (isReady) return;
    setIsReady(true);
    soundEngine.playReady();
    await callAPI("ready");
  };

  const handleSubmitAnswer = async () => {
    initSound();
    if (!answer.trim()) return;
    setSubmittedAnswer(true);
    await callAPI("submit-answer", { answer: answer.trim() });
  };

  const handleSubmitDrawing = async (dataUrl: string) => {
    initSound();
    setSubmittedAnswer(true);
    await callAPI("submit-answer", { answer: dataUrl });
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

  const canAnswer = (() => {
    if (!gameState.currentRound || submittedAnswer) return false;
    if (phase !== "questioning") return false;
    return true;
  })();

  const timerPercent =
    timeLeft !== null ? Math.max(0, (timeLeft / 60) * 100) : 0;
  const timerColor =
    timeLeft !== null && timeLeft <= 10
      ? "var(--neon-pink)"
      : "var(--neon-green)";

  const isDrawingRound = gameState.currentRound?.roundType === "drawing";

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Phase transition overlay */}
      {phaseTransition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in pointer-events-none">
          <div className="text-center">
            <p className="font-pixel text-xl sm:text-2xl neon-text-green animate-pulse">
              {phaseTransition}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 bg-space-mid/80 backdrop-blur border-b border-neon-green/20 px-4 py-2">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="font-pixel text-[10px] neon-text-green leading-none">
            THE EXTRACTION
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-xs opacity-60 hover:opacity-100 transition-opacity"
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? "\uD83D\uDD07" : "\uD83D\uDD0A"}
            </button>
            <span className="font-pixel text-[10px] neon-text-yellow tracking-widest">
              {roomCode}
            </span>
            <div className="flex gap-0.5">
              {gameState.players.map((p) => (
                <div
                  key={p.id}
                  className="relative"
                  title={p.name}
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
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={handleStartGame}
                  disabled={gameState.players.length < 2}
                  className="btn-neon py-4 px-8 mt-4"
                >
                  {gameState.players.length < 2
                    ? "Waiting for crew..."
                    : "Begin Extraction"}
                </button>
                {startError && (
                  <p className="text-red-400 text-sm text-center font-mono">
                    {startError}
                  </p>
                )}
              </div>
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

        {/* INTRO PHASE — Alien intro + Ready up */}
        {phase === "intro" && (
          <div className="flex-1 flex flex-col p-4">
            <div className="flex-1 overflow-y-auto message-scroll space-y-3">
              {gameState.messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  players={gameState.players}
                  currentPlayerId={playerId}
                  isTypewriter={msg.id === lastTypewriterMsgId}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex-shrink-0 border-t border-neon-green/20 bg-space-mid/80 backdrop-blur p-4">
              <div className="text-center space-y-3">
                <button
                  onClick={handleReady}
                  disabled={isReady}
                  className={`btn-neon py-3 px-8 ${isReady ? "opacity-50" : ""}`}
                >
                  {isReady ? "Ready \u2713" : "Ready"}
                </button>
                <p className="font-pixel text-xs neon-text-blue">
                  {readyCount} of {gameState.players.length} ready
                </p>
              </div>
            </div>
          </div>
        )}

        {/* GAME PHASES — Questioning, Processing, Reviewing, Results, Final Results, Result */}
        {phase !== "lobby" && phase !== "arrival" && phase !== "intro" && (
          <>
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto message-scroll p-4 space-y-3">
              {gameState.messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  players={gameState.players}
                  currentPlayerId={playerId}
                  isTypewriter={msg.id === lastTypewriterMsgId && (phase === "questioning" || phase === "final-results")}
                />
              ))}

              {/* Live answers during questioning */}
              {liveAnswers.length > 0 && phase === "questioning" && !isDrawingRound && (
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
                        {la.playerName}
                        {la.playerId === playerId ? " (you)" : ""}
                      </p>
                      <p className="text-gray-200 text-sm">{la.answer}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Drawing round: show count instead of answers */}
              {liveAnswers.length > 0 && phase === "questioning" && isDrawingRound && (
                <div className="text-center py-2">
                  <p className="font-pixel text-[10px] neon-text-blue">
                    {liveAnswers.length} of {gameState.players.length} drawings submitted
                  </p>
                </div>
              )}

              {/* Processing indicator */}
              {phase === "processing" && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4 animate-float">&#x1F6F8;</div>
                  <p className="font-pixel text-xs neon-text-green animate-pulse">
                    {processingPhrase}
                  </p>
                  <div className="typing-indicator justify-center mt-4">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}

              {/* Reviewing phase — cycle through each player's answer + alien review */}
              {phase === "reviewing" && gameState.currentRound && (
                <ReviewingDisplay
                  round={gameState.currentRound}
                  players={gameState.players}
                  currentReviewIndex={currentReviewIndex}
                  currentPlayerId={playerId}
                />
              )}

              {/* Results phase — leaderboard with score bars */}
              {phase === "results" && gameState.currentRound && (
                <ResultsLeaderboard
                  players={gameState.players}
                  scores={gameState.scores}
                  currentRound={gameState.currentRound}
                  currentPlayerId={playerId}
                />
              )}

              {/* Final results */}
              {phase === "final-results" && (
                <FinalResults
                  players={gameState.players}
                  scores={gameState.scores}
                  winnerId={gameState.winnerId}
                  currentPlayerId={playerId}
                />
              )}

              {/* Ship departure */}
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

            {/* Bottom bar — context-dependent */}
            <div className="flex-shrink-0 border-t border-neon-green/20 bg-space-mid/80 backdrop-blur p-3">
              {/* Questioning phase — answer input */}
              {canAnswer && !isDrawingRound && (
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
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* Drawing round — canvas */}
              {canAnswer && isDrawingRound && (
                <div className="max-w-2xl mx-auto">
                  {timeLeft !== null && (
                    <p className="text-center font-pixel text-xs mb-2" style={{ color: timerColor }}>
                      {timeLeft}s
                    </p>
                  )}
                  <DrawingCanvas onSubmit={handleSubmitDrawing} disabled={submittedAnswer} />
                </div>
              )}

              {/* Submitted state */}
              {submittedAnswer && phase === "questioning" && (
                <div className="text-center">
                  <p className="neon-text-green text-sm font-mono">
                    {isDrawingRound ? "Drawing submitted" : "Answer submitted"} &#x2713;
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Waiting for others... ({liveAnswers.length}/
                    {gameState.players.length})
                  </p>
                </div>
              )}

              {/* Processing */}
              {phase === "processing" && (
                <div className="text-center">
                  <p className="text-gray-500 text-xs font-mono">
                    ZYRAX is judging your answers...
                  </p>
                </div>
              )}

              {/* Reviewing */}
              {phase === "reviewing" && (
                <div className="text-center">
                  <p className="text-gray-500 text-xs font-mono">
                    Reviewing answers...
                  </p>
                </div>
              )}

              {/* Results — ready up */}
              {phase === "results" && (
                <div className="text-center space-y-2">
                  <button
                    onClick={handleReady}
                    disabled={isReady}
                    className={`btn-neon py-2 px-6 text-xs ${isReady ? "opacity-50" : ""}`}
                  >
                    {isReady ? "Ready \u2713" : "Next Round"}
                  </button>
                  <p className="font-pixel text-[10px] neon-text-blue">
                    {readyCount} of {gameState.players.length} ready
                  </p>
                </div>
              )}

              {/* Final results */}
              {phase === "final-results" && (
                <div className="text-center">
                  <p className="font-pixel text-xs neon-text-pink animate-pulse">
                    THE SHIP IS DEPARTING...
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
  isTypewriter = false,
}: {
  message: GameMessage;
  players: Player[];
  currentPlayerId: string;
  isTypewriter?: boolean;
}) {
  const isAlien = message.sender === "alien";
  const isSystem = message.sender === "system";

  if (isSystem) {
    return (
      <div className="text-center py-2">
        <p className="text-gray-500 text-xs font-pixel">{message.text}</p>
      </div>
    );
  }

  if (isAlien) {
    return (
      <div className="alien-bubble p-3 ml-8 animate-slide-up">
        <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
          {isTypewriter ? (
            <TypewriterText
              text={message.text}
              speed={25}
              onTick={() => soundEngine.playTypewriterTick()}
            />
          ) : (
            message.text
          )}
        </p>
      </div>
    );
  }

  // Player message
  const sender = players.find((p) => p.id === message.sender);
  return (
    <div className="player-bubble p-3 ml-8 animate-slide-up">
      <p className="text-xs text-neon-purple mb-1 font-semibold">
        {sender?.name || "Unknown"}
        {message.sender === currentPlayerId ? " (you)" : ""}
      </p>
      <p className="text-gray-200 text-sm">{message.text}</p>
    </div>
  );
}

function ReviewingDisplay({
  round,
  players,
  currentReviewIndex,
  currentPlayerId,
}: {
  round: { question: string; answers: Record<string, string>; answerReviews: AnswerReview[]; roundType: string };
  players: Player[];
  currentReviewIndex: number;
  currentPlayerId: string;
}) {
  const reviews = round.answerReviews || [];
  const isDrawing = round.roundType === "drawing";
  const maxScore = round.roundType === "final-plea" ? 2000 : 1000;

  return (
    <div className="space-y-4 py-4">
      {reviews.map((review, i) => {
        if (i > currentReviewIndex) return null;
        const player = players.find((p) => p.id === review.playerId);
        const answer = round.answers[review.playerId];
        const isCurrent = i === currentReviewIndex;
        const isYou = review.playerId === currentPlayerId;

        return (
          <div
            key={review.playerId}
            className={`animate-slide-up rounded-xl border p-4 transition-all duration-500 ${
              isCurrent
                ? "border-neon-green/40 bg-neon-green/5"
                : "border-white/5 bg-white/5 opacity-60"
            }`}
          >
            {/* Player header */}
            <div className="flex items-center gap-3 mb-3">
              <PixelAvatar type={player?.avatar || "hillbilly"} size={36} />
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">
                  {player?.name}{isYou ? " (you)" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className="font-pixel text-sm neon-text-yellow">
                  +{review.score}
                </p>
                <p className="text-gray-500 text-[10px]">/ {maxScore}</p>
              </div>
            </div>

            {/* Their answer */}
            {isDrawing && answer?.startsWith("data:image/") ? (
              <div className="mb-3 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={answer}
                  alt={`${player?.name}'s drawing`}
                  className="rounded-lg border border-white/10 max-w-[200px]"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            ) : (
              <div className="player-bubble p-2 mb-3">
                <p className="text-gray-200 text-sm">{answer || "(no answer)"}</p>
              </div>
            )}

            {/* Alien's review comment */}
            <div className="alien-bubble p-2">
              <p className="text-gray-200 text-sm">
                {isCurrent ? (
                  <TypewriterText
                    text={review.comment}
                    speed={20}
                    onTick={() => soundEngine.playTypewriterTick()}
                    skipAlienFont
                  />
                ) : (
                  review.comment
                )}
              </p>
            </div>

            {/* Score bar */}
            <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: isCurrent ? `${(review.score / maxScore) * 100}%` : `${(review.score / maxScore) * 100}%`,
                  backgroundColor: AVATAR_CONFIG[player?.avatar || "hillbilly"]?.color || "#39ff14",
                  boxShadow: `0 0 8px ${AVATAR_CONFIG[player?.avatar || "hillbilly"]?.color || "#39ff14"}`,
                  transitionDelay: isCurrent ? "500ms" : "0ms",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResultsLeaderboard({
  players,
  scores,
  currentRound,
  currentPlayerId,
}: {
  players: Player[];
  scores: Record<string, number>;
  currentRound: { roundScores: Record<string, number>; roundNumber: number };
  currentPlayerId: string;
}) {
  const sorted = [...players].sort(
    (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)
  );
  const maxScore = Math.max(...Object.values(scores), 1);

  return (
    <div className="py-4 space-y-4">
      <p className="font-pixel text-xs neon-text-green text-center mb-4">
        ROUND {currentRound.roundNumber} RESULTS
      </p>
      {sorted.map((player, i) => {
        const total = scores[player.id] || 0;
        const roundScore = currentRound.roundScores[player.id] || 0;
        const isYou = player.id === currentPlayerId;
        const barColor = AVATAR_CONFIG[player.avatar]?.color || "#39ff14";

        return (
          <div
            key={player.id}
            className="animate-slide-up"
            style={{ animationDelay: `${i * 150}ms` }}
          >
            <div className="flex items-center gap-3 mb-1">
              <span className="font-pixel text-xs text-gray-500 w-5">
                {i + 1}.
              </span>
              <PixelAvatar type={player.avatar} size={28} />
              <span className={`text-sm flex-1 ${isYou ? "text-white font-bold" : "text-gray-300"}`}>
                {player.name}{isYou ? " (you)" : ""}
              </span>
              <span className="font-pixel text-xs neon-text-yellow">
                +{roundScore}
              </span>
              <span className="font-pixel text-sm text-white w-16 text-right">
                {total}
              </span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden ml-8">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${(total / maxScore) * 100}%`,
                  backgroundColor: barColor,
                  boxShadow: `0 0 6px ${barColor}`,
                  transitionDelay: `${i * 200}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FinalResults({
  players,
  scores,
  winnerId,
  currentPlayerId,
}: {
  players: Player[];
  scores: Record<string, number>;
  winnerId: string | null;
  currentPlayerId: string;
}) {
  const sorted = [...players].sort(
    (a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)
  );
  const maxScore = Math.max(...Object.values(scores), 1);

  return (
    <div className="py-8 space-y-6">
      <p className="font-pixel text-lg neon-text-green text-center animate-pulse">
        FINAL STANDINGS
      </p>
      {sorted.map((player, i) => {
        const total = scores[player.id] || 0;
        const isWinner = player.id === winnerId;
        const isYou = player.id === currentPlayerId;
        const barColor = AVATAR_CONFIG[player.avatar]?.color || "#39ff14";

        return (
          <div
            key={player.id}
            className={`animate-slide-up rounded-xl p-4 ${
              isWinner
                ? "border-2 border-neon-green/60 bg-neon-green/10"
                : "border border-white/5 bg-white/5"
            }`}
            style={{ animationDelay: `${i * 300}ms` }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="font-pixel text-lg text-gray-400 w-8">
                {i === 0 ? "\uD83D\uDC51" : `${i + 1}.`}
              </span>
              <PixelAvatar type={player.avatar} size={40} />
              <div className="flex-1">
                <p className={`font-semibold ${isWinner ? "neon-text-green" : "text-white"}`}>
                  {player.name}{isYou ? " (you)" : ""}
                </p>
                {isWinner && (
                  <p className="font-pixel text-[10px] neon-text-yellow">
                    EXTRACTED
                  </p>
                )}
              </div>
              <span className="font-pixel text-lg text-white">
                {total}
              </span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1500 ease-out"
                style={{
                  width: `${(total / maxScore) * 100}%`,
                  backgroundColor: barColor,
                  boxShadow: `0 0 8px ${barColor}`,
                  transitionDelay: `${i * 400}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
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
            {winner?.name}
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
                  {p.name}
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
