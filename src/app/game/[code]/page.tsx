"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { getSocketClient, disconnectSocketClient } from "@/lib/socket-client";
import { GameState, Player, AVATAR_CONFIG, AnswerReview } from "@/lib/types";
import { PixelAvatar } from "@/components/PixelAvatar";
import { PixelAlien } from "@/components/PixelAlien";
import { PixelShip } from "@/components/PixelShip";
import { TypewriterText } from "@/components/TypewriterText";
import { DrawingCanvas } from "@/components/DrawingCanvas";
import { soundEngine } from "@/lib/sound-engine";
import { ResultScene as NewResultScene } from "@/components/ResultScene";

const PROCESSING_PHRASES = [
  "ANALYZING RESPONSES...",
  "COMPUTING WORTHINESS...",
  "CALIBRATING JUDGMENT MATRIX...",
  "CONSULTING GALACTIC DATABASE...",
  "PROCESSING HUMAN OUTPUT...",
  "EVALUATING SURVIVAL POTENTIAL...",
  "CROSS-REFERENCING WITH VEXAR-9 STANDARDS...",
];

const REVIEW_DURATION = 10000; // 10 seconds per player review

export default function GamePage() {
  const params = useParams();
  const roomCode = params.code as string;

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [answer, setAnswer] = useState("");
  const [submittedAnswer, setSubmittedAnswer] = useState(false);
  const [answerCount, setAnswerCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [animPhase, setAnimPhase] = useState(0);
  const [shipVisible, setShipVisible] = useState(false);
  const [startError, setStartError] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [readyCount, setReadyCount] = useState(0);
  const [processingPhrase, setProcessingPhrase] = useState(PROCESSING_PHRASES[0]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(-1);
  const [phaseTransition, setPhaseTransition] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [soundInitialized, setSoundInitialized] = useState(false);
  const [introText, setIntroText] = useState("");
  const [introTypingDone, setIntroTypingDone] = useState(false);
  const [drawings, setDrawings] = useState<Record<string, string>>({});
  const [drawingsLoaded, setDrawingsLoaded] = useState(true);

  const roomRef = useRef<string>('');
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
          // Sync ready state if player already marked ready on server
          if (data.gameState.readyPlayers?.includes(pid)) {
            setIsReady(true);
          }
          // Extract intro text from messages
          const msgs = data.gameState.messages || [];
          const lastAlien = [...msgs].reverse().find((m: { sender: string }) => m.sender === "alien");
          if (lastAlien) setIntroText(lastAlien.text);
        }
      });

    const room = `game-${roomCode.toLowerCase()}`;
    roomRef.current = room;

    const connectAndJoin = async () => {
      const authRes = await fetch('/api/socket-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: pid }),
      });

      if (!authRes.ok) {
        console.error('[socket] failed to get connect token');
        return;
      }

      const { token } = await authRes.json();
      const socket = getSocketClient(token);

      const joinRoom = () => {
        socket.emit('room.join', { room }, (err: unknown) => {
          if (err) {
            console.error('[socket] room.join failed:', err);
            return;
          }

          socket.on('game-update', (data: { gameState: GameState }) => {
            const gs = data.gameState;
            setGameState(gs);
            setReadyCount(gs.readyPlayers?.length || 0);

            if (gs.phase === "questioning") {
              setSubmittedAnswer(false);
              setAnswer("");
              setAnswerCount(0);
              setIsReady(false);
              timerExpiredRef.current = false;
            }
            if (gs.phase === "reviewing") {
              setCurrentReviewIndex(-1);
              reviewingDoneRef.current = false;
              // Fetch drawings if this is a drawing round (with retry)
              if (gs.currentRound?.roundType === "drawing") {
                setDrawingsLoaded(false);
                const fetchDrawings = async (retries = 2) => {
                  for (let i = 0; i <= retries; i++) {
                    try {
                      const res = await fetch("/api/game", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "get-drawings", roomCode }),
                      });
                      const d = await res.json();
                      if (d.success && Object.keys(d.drawings || {}).length > 0) {
                        setDrawings(d.drawings);
                        return;
                      }
                      console.warn(`Drawing fetch attempt ${i + 1}: success=${d.success}, drawings=${Object.keys(d.drawings || {}).length}`);
                    } catch (err) {
                      console.error(`Drawing fetch attempt ${i + 1} failed:`, err);
                    }
                    if (i < retries) await new Promise(r => setTimeout(r, 1000));
                  }
                  // Final fallback — set empty drawings so review can still proceed
                  setDrawings({});
                };
                fetchDrawings().finally(() => setDrawingsLoaded(true));
              } else {
                setDrawingsLoaded(true);
              }
            }
            if (gs.phase === "results" || gs.phase === "intro") {
              setIsReady(gs.readyPlayers?.includes(pid) || false);
            }
            // Extract latest alien text for display
            const msgs = gs.messages || [];
            const lastAlien = [...msgs].reverse().find((m: { sender: string }) => m.sender === "alien");
            if (lastAlien) setIntroText(lastAlien.text);
          });

          socket.on('answer-live', (data: { answerCount: number; expectedAnswers: number }) => {
            setAnswerCount(data.answerCount);
          });

          socket.on('player-joined', (data: { gameState: GameState }) => {
            setGameState(data.gameState);
          });

          socket.on('player-ready', (data: { gameState: GameState }) => {
            setReadyCount(data.gameState.readyPlayers?.length || 0);
            setGameState(data.gameState);
          });
        });
      };

      // Join immediately if already connected, otherwise wait for connect event
      if (socket.connected) {
        joinRoom();
      } else {
        socket.once('connect', joinRoom);
      }
    };

    connectAndJoin();

    return () => {
      const socket = getSocketClient('');
      socket.emit('room.leave', { room });
      socket.off('game-update');
      socket.off('answer-live');
      socket.off('player-joined');
      socket.off('player-ready');
      socket.off('connect');
      disconnectSocketClient();
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
      if (type === "drawing") text = `ROUND ${rn} — DRAW!`;
      else if (type === "final-plea") text = `FINAL ROUND — 2X POINTS!`;
      else text = `ROUND ${rn}`;
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
      const duration = phase === "reviewing" ? 600 : 2500;
      setTimeout(() => setPhaseTransition(null), duration);
    }
  }, [gameState?.phase, gameState?.currentRound?.roundNumber]);

  // Countdown timer
  useEffect(() => {
    if (!gameState?.roundDeadline || gameState.phase !== "questioning") {
      setTimeLeft(null);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((gameState.roundDeadline! - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining > 0 && remaining <= 10) {
        soundEngine.playCountdownUrgent();
        soundEngine.setMelodyTempo(200);
      } else if (remaining > 0 && remaining <= 30) {
        soundEngine.setMelodyTempo(160);
        if (remaining % 5 === 0) soundEngine.playCountdownTick();
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

  // Arrival animation
  useEffect(() => {
    if (gameState?.phase === "arrival") setShipVisible(true);
  }, [gameState?.phase]);

  // Processing phrase cycling + polling fallback
  useEffect(() => {
    if (gameState?.phase !== "processing") return;
    let i = 0;
    const phraseInterval = setInterval(() => {
      i = (i + 1) % PROCESSING_PHRASES.length;
      setProcessingPhrase(PROCESSING_PHRASES[i]);
    }, 1500);

    // Auto-reload after 30s stuck in processing — catches socket failures that
    // polling also misses (e.g. when get-state returns a transient server error).
    const autoReloadTimer = setTimeout(() => {
      window.location.reload();
    }, 30000);

    // Poll every 2s as fallback in case socket broadcast fails
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/game", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get-state", roomCode }),
        });
        const data = await res.json();
        if (data.success && data.gameState && data.gameState.phase !== "processing") {
          clearTimeout(autoReloadTimer);
          setGameState(data.gameState);
          setReadyCount(data.gameState.readyPlayers?.length || 0);
          const msgs = data.gameState.messages || [];
          const lastAlien = [...msgs].reverse().find((m: { sender: string }) => m.sender === "alien");
          if (lastAlien) setIntroText(lastAlien.text);
        }
      } catch { /* ignore polling errors */ }
    }, 2000);

    return () => { clearInterval(phraseInterval); clearInterval(pollInterval); clearTimeout(autoReloadTimer); };
  }, [gameState?.phase, roomCode]);

  // Review cycling
  useEffect(() => {
    if (gameState?.phase !== "reviewing" || !gameState.currentRound?.answerReviews?.length || !drawingsLoaded) return;
    const startTimer = setTimeout(() => setCurrentReviewIndex(0), 800);
    return () => clearTimeout(startTimer);
  }, [gameState?.phase, gameState?.currentRound?.answerReviews?.length, drawingsLoaded]);

  // Auto-advance reviews
  useEffect(() => {
    if (gameState?.phase !== "reviewing" || currentReviewIndex < 0) return;

    const reviews = gameState.currentRound?.answerReviews || [];
    if (currentReviewIndex >= reviews.length) {
      if (!reviewingDoneRef.current) {
        reviewingDoneRef.current = true;
        setTimeout(() => {
          fetch("/api/game", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reviewing-done", roomCode }),
          });
        }, 1500);
      }
      return;
    }

    const review = reviews[currentReviewIndex];
    if (review) {
      const maxScore = gameState.currentRound?.roundType === "final-plea" ? 2000 : 1000;
      setTimeout(() => soundEngine.playScoreReveal(review.score, maxScore), 500);
    }

    const timer = setTimeout(() => setCurrentReviewIndex((i) => i + 1), REVIEW_DURATION);
    return () => clearTimeout(timer);
  }, [currentReviewIndex, gameState?.phase, gameState?.currentRound, roomCode]);

  // Result/departure phase — 9 animation phases
  useEffect(() => {
    if (gameState?.phase === "result" && gameState.winnerId) {
      setAnimPhase(0);
      const timers = [
        setTimeout(() => { setAnimPhase(0); soundEngine.playRampExtend(); }, 0),       // ramp extends
        setTimeout(() => setAnimPhase(1), 1500),                                        // winner walks up
        setTimeout(() => setAnimPhase(2), 3500),                                        // ramp retracts
        setTimeout(() => { setAnimPhase(3); soundEngine.playChargeUp(); }, 4500),       // ship charges
        setTimeout(() => { setAnimPhase(4); soundEngine.playShipDepart(); }, 6500),     // ship departs
        setTimeout(() => { setAnimPhase(5); soundEngine.playEngineBlast(); }, 7500),    // engine blast
        setTimeout(() => { setAnimPhase(6); soundEngine.playBurn(); }, 8500),           // skeletons
        setTimeout(() => setAnimPhase(7), 10500),                                       // ash collapse
        setTimeout(() => setAnimPhase(8), 13000),                                       // game over
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [gameState?.phase, gameState?.winnerId]);

  // Final results → result transition
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
          body: JSON.stringify({ action, roomCode, playerId, ...extraData }),
        });
        if (!res.ok) return { success: false, error: `Server error (${res.status})` };
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
    if (data && !data.success) setStartError(data.error || "Failed to start game.");
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

  // --- RENDER ---

  if (!gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="mb-4 animate-float"><PixelShip size={80} animate /></div>
          <p className="neon-text-green font-pixel text-sm">Establishing contact...</p>
        </div>
      </div>
    );
  }

  const currentPlayer = gameState.players.find((p) => p.id === playerId);
  const isHost = currentPlayer?.isHost || false;
  const phase = gameState.phase;
  const timerPercent = timeLeft !== null ? Math.max(0, (timeLeft / 60) * 100) : 0;
  const timerColor = timeLeft !== null && timeLeft <= 10 ? "var(--neon-pink)" : "var(--neon-green)";
  const isDrawingRound = gameState.currentRound?.roundType === "drawing";

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden">
      {/* Phase transition overlay */}
      {phaseTransition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in pointer-events-none">
          <p className="font-pixel text-xl sm:text-2xl neon-text-green animate-pulse">{phaseTransition}</p>
        </div>
      )}

      {/* Header */}
      <header className="flex-shrink-0 bg-space-mid/80 backdrop-blur border-b border-neon-green/20 px-4 py-2">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="font-pixel text-[10px] neon-text-green leading-none">THE EXTRACTION</h1>
          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="text-xs opacity-60 hover:opacity-100 transition-opacity" title={muted ? "Unmute" : "Mute"}>
              {muted ? "\uD83D\uDD07" : "\uD83D\uDD0A"}
            </button>
            <span className="font-pixel text-[10px] neon-text-yellow tracking-widest">{roomCode}</span>
            <div className="flex gap-0.5">
              {gameState.players.map((p) => (
                <div key={p.id} title={p.name} style={{ opacity: p.id === playerId ? 1 : 0.6 }}>
                  <PixelAvatar type={p.avatar} size={24} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Timer bar (only during active questioning) */}
      {phase === "questioning" && timeLeft !== null && (
        <div className="flex-shrink-0 h-1 bg-space-mid/50">
          <div className="h-full transition-all duration-1000 ease-linear" style={{ width: `${timerPercent}%`, backgroundColor: timerColor, boxShadow: `0 0 8px ${timerColor}` }} />
        </div>
      )}

      {/* Main content — one screen per phase */}
      <main className="flex-1 overflow-hidden flex flex-col max-w-2xl mx-auto w-full">

        {/* === LOBBY === */}
        {phase === "lobby" && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 gap-6">
            <div className="animate-float"><PixelShip size={120} animate /></div>
            <div className="text-center">
              <p className="font-pixel text-xs text-gray-400 mb-2">ROOM CODE</p>
              <p className="room-code">{roomCode}</p>
              <p className="text-gray-500 text-sm mt-2">Share this code with your friends</p>
            </div>
            <div className="w-full max-w-xs space-y-3">
              <p className="font-pixel text-xs neon-text-blue text-center">CREW ({gameState.players.length}/8)</p>
              {gameState.players.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
                  <PixelAvatar type={p.avatar} size={40} animated />
                  <div className="flex-1">
                    <p className="text-white font-semibold">{p.name}</p>
                    <p className="text-gray-500 text-xs">{AVATAR_CONFIG[p.avatar]?.label}</p>
                  </div>
                  {p.isHost && <span className="text-xs neon-text-yellow font-pixel">HOST</span>}
                  {p.id === playerId && <span className="text-xs neon-text-green font-pixel">YOU</span>}
                </div>
              ))}
            </div>
            {isHost ? (
              <div className="flex flex-col items-center gap-2">
                <button onClick={handleStartGame} disabled={gameState.players.length < 2} className="btn-neon py-4 px-8 mt-4">
                  {gameState.players.length < 2 ? "Waiting for crew..." : "Begin Extraction"}
                </button>
                {startError && <p className="text-red-400 text-sm text-center font-mono">{startError}</p>}
              </div>
            ) : (
              <p className="text-gray-500 text-sm font-mono animate-pulse">Waiting for host to start...</p>
            )}
          </div>
        )}

        {/* === ARRIVAL === */}
        {phase === "arrival" && (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className={`spaceship ${shipVisible ? "animate-ship-arrive" : "opacity-0"}`}><PixelShip size={120} animate showJetStream /></div>
            <div className="mt-8 text-center">
              <p className="font-pixel text-sm neon-text-green animate-pulse">INCOMING TRANSMISSION</p>
              <div className="typing-indicator justify-center mt-4"><span /><span /><span /></div>
            </div>
          </div>
        )}

        {/* === INTRO — Alien intro, centered, no chat history === */}
        {phase === "intro" && (
          <div className="flex-1 flex flex-col items-center justify-start pt-12 sm:pt-16 p-6">
            <div className="mb-6"><PixelAlien size={64} animate /></div>
            <div className="max-w-lg text-center mb-8">
              <p className="text-gray-200 text-sm leading-relaxed">
                <TypewriterText
                  text={introText}
                  speed={25}
                  onWordSound={() => soundEngine.playTypewriterTick()}
                  onComplete={() => setIntroTypingDone(true)}
                />
              </p>
            </div>
            {introTypingDone && (
              <div className="animate-fade-in text-center space-y-3">
                <button onClick={handleReady} disabled={isReady} className={`btn-neon py-3 px-8 ${isReady ? "opacity-50" : ""}`}>
                  {isReady ? "Ready \u2713" : "Ready"}
                </button>
                <p className="font-pixel text-xs neon-text-blue">{readyCount} of {gameState.players.length} ready</p>
              </div>
            )}
          </div>
        )}

        {/* === QUESTIONING — Timer + input === */}
        {phase === "questioning" && gameState.currentRound && (
          <div className="flex-1 flex flex-col p-4">
            {/* Question reference at top */}
            <div className="flex-shrink-0 text-center mb-4 pt-2">
              <p className="font-pixel text-[10px] text-gray-500 mb-2">
                ROUND {gameState.currentRound.roundNumber}
                {isDrawingRound ? " — DRAW!" : ""}
              </p>
              <p className="text-gray-400 text-sm italic">&ldquo;{gameState.currentRound.question}&rdquo;</p>
            </div>

            {/* Main input area */}
            <div className={`flex-1 flex flex-col items-center ${isDrawingRound ? "justify-start overflow-y-auto" : "justify-center"}`}>
              {!submittedAnswer ? (
                <>
                  {timeLeft !== null && (
                    <p className="font-pixel text-2xl mb-6" style={{ color: timerColor }}>
                      {timeLeft}
                    </p>
                  )}

                  {isDrawingRound ? (
                    <DrawingCanvas onSubmit={handleSubmitDrawing} disabled={submittedAnswer} />
                  ) : (
                    <div className="w-full max-w-md space-y-3">
                      <textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Type your answer..."
                        maxLength={500}
                        autoFocus
                        rows={3}
                        className="w-full resize-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmitAnswer();
                          }
                        }}
                      />
                      <button onClick={handleSubmitAnswer} disabled={!answer.trim()} className="btn-neon w-full py-3 text-xs">
                        Done
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center space-y-3">
                  <div className="text-4xl mb-4">&#x2705;</div>
                  <p className="neon-text-green text-lg font-mono">
                    {isDrawingRound ? "Drawing submitted" : "Answer submitted"}
                  </p>
                  <p className="text-gray-500 text-sm">
                    Waiting for others... ({answerCount}/{gameState.players.length})
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === PROCESSING — Animated interstitial === */}
        {phase === "processing" && (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="mb-6 animate-float"><PixelShip size={120} animate showJetStream /></div>
            <p className="font-pixel text-xs neon-text-green animate-pulse mb-4">{processingPhrase}</p>
            <div className="typing-indicator justify-center"><span /><span /><span /></div>
          </div>
        )}

        {/* === REVIEWING — One answer at a time, full screen === */}
        {phase === "reviewing" && gameState.currentRound && (
          <ReviewScreen
            round={gameState.currentRound}
            players={gameState.players}
            currentReviewIndex={currentReviewIndex}
            currentPlayerId={playerId}
            drawings={drawings}
          />
        )}

        {/* === RESULTS — Leaderboard + ready up === */}
        {phase === "results" && gameState.currentRound && (
          <div className="flex-1 flex flex-col p-4">
            <div className="flex-1 flex flex-col items-center justify-center">
              <ResultsLeaderboard
                players={gameState.players}
                scores={gameState.scores}
                currentRound={gameState.currentRound}
                currentPlayerId={playerId}
              />
            </div>
            <div className="flex-shrink-0 text-center space-y-2 pb-4">
              <button onClick={handleReady} disabled={isReady} className={`btn-neon py-2 px-6 text-xs ${isReady ? "opacity-50" : ""}`}>
                {isReady ? "Ready \u2713" : "Next Round"}
              </button>
              <p className="font-pixel text-[10px] neon-text-blue">{readyCount} of {gameState.players.length} ready</p>
            </div>
          </div>
        )}

        {/* === FINAL RESULTS === */}
        {phase === "final-results" && (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <FinalResults
              players={gameState.players}
              scores={gameState.scores}
              winnerId={gameState.winnerId}
              currentPlayerId={playerId}
              sendoffText={introText}
            />
          </div>
        )}

        {/* === RESULT — Ship departure + burn === */}
        {phase === "result" && gameState.winnerId && (
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <NewResultScene
              players={gameState.players}
              winnerId={gameState.winnerId}
              currentPlayerId={playerId}
              animPhase={animPhase}
            />
          </div>
        )}
      </main>
    </div>
  );
}

// === SUB-COMPONENTS ===

function ReviewScreen({
  round,
  players,
  currentReviewIndex,
  currentPlayerId,
  drawings,
}: {
  round: { question: string; answers: Record<string, string>; answerReviews: AnswerReview[]; roundType: string };
  players: Player[];
  currentReviewIndex: number;
  currentPlayerId: string;
  drawings: Record<string, string>;
}) {
  const reviews = round.answerReviews || [];
  const maxScore = round.roundType === "final-plea" ? 2000 : 1000;
  const isDrawing = round.roundType === "drawing";

  if (currentReviewIndex < 0 || currentReviewIndex >= reviews.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="typing-indicator"><span /><span /><span /></div>
      </div>
    );
  }

  const review = reviews[currentReviewIndex];
  const player = players.find((p) => p.id === review.playerId);
  const answer = round.answers[review.playerId];
  const drawingData = drawings[review.playerId];
  const isYou = review.playerId === currentPlayerId;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in" key={review.playerId}>
      {/* Progress bar */}
      <div className="w-full max-w-md mb-6">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-neon-green rounded-full"
            style={{
              width: "0%",
              transition: "width 10s linear",
              boxShadow: "0 0 8px var(--neon-green)",
            }}
            ref={(el) => { if (el) requestAnimationFrame(() => { el.style.width = "100%"; }); }}
          />
        </div>
        <p className="font-pixel text-[8px] text-gray-500 mt-1 text-right">{currentReviewIndex + 1} / {reviews.length}</p>
      </div>

      {/* Player info */}
      <div className="flex items-center gap-3 mb-4">
        <PixelAvatar type={player?.avatar || "hillbilly"} size={48} animated />
        <div>
          <p className="text-white font-semibold text-lg">{player?.name}{isYou ? " (you)" : ""}</p>
        </div>
      </div>

      {/* Their answer */}
      {isDrawing ? (
        drawingData ? (
          <div className="mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={drawingData} alt={`${player?.name}'s drawing`} className="rounded-lg border border-white/10 max-w-[220px]" style={{ imageRendering: "pixelated" }} />
          </div>
        ) : (
          <div className="mb-6 w-[220px] h-[220px] rounded-lg border border-white/10 flex items-center justify-center bg-white/5">
            <p className="text-gray-500 text-xs font-pixel">Drawing unavailable</p>
          </div>
        )
      ) : (
        <div className="player-bubble p-4 mb-6 max-w-md">
          <p className="text-gray-200 text-base">{answer || "(no answer)"}</p>
        </div>
      )}

      {/* Alien review */}
      <div className="alien-bubble p-4 max-w-md mb-6">
        <p className="text-gray-200 text-sm leading-relaxed">
          <TypewriterText
            text={review.comment}
            speed={20}
            onWordSound={() => soundEngine.playTypewriterTick()}
            skipAnimation={false}
          />
        </p>
      </div>

      {/* Score reveal */}
      <div className="text-center animate-slide-up" style={{ animationDelay: "500ms" }}>
        <p className="font-pixel text-2xl neon-text-yellow">+{review.score}</p>
        <p className="text-gray-500 text-xs">/ {maxScore}</p>
      </div>

      {/* Score bar */}
      <div className="w-full max-w-xs mt-4 h-3 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${(review.score / maxScore) * 100}%`,
            backgroundColor: AVATAR_CONFIG[player?.avatar || "hillbilly"]?.color || "#39ff14",
            boxShadow: `0 0 8px ${AVATAR_CONFIG[player?.avatar || "hillbilly"]?.color || "#39ff14"}`,
            transitionDelay: "800ms",
          }}
        />
      </div>
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
  const sorted = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  const maxScore = Math.max(...Object.values(scores), 1);

  return (
    <div className="w-full max-w-md space-y-4">
      <p className="font-pixel text-xs neon-text-green text-center mb-6">ROUND {currentRound.roundNumber} RESULTS</p>
      {sorted.map((player, i) => {
        const total = scores[player.id] || 0;
        const roundScore = currentRound.roundScores[player.id] || 0;
        const isYou = player.id === currentPlayerId;
        const barColor = AVATAR_CONFIG[player.avatar]?.color || "#39ff14";

        return (
          <div key={player.id} className="animate-slide-up" style={{ animationDelay: `${i * 150}ms` }}>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-pixel text-xs text-gray-500 w-5">{i + 1}.</span>
              <PixelAvatar type={player.avatar} size={28} />
              <span className={`text-sm flex-1 ${isYou ? "text-white font-bold" : "text-gray-300"}`}>
                {player.name}{isYou ? " (you)" : ""}
              </span>
              <span className="font-pixel text-xs neon-text-yellow">+{roundScore}</span>
              <span className="font-pixel text-sm text-white w-16 text-right">{total}</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden ml-8">
              <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{
                width: `${(total / maxScore) * 100}%`,
                backgroundColor: barColor,
                boxShadow: `0 0 6px ${barColor}`,
                transitionDelay: `${i * 200}ms`,
              }} />
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
  sendoffText,
}: {
  players: Player[];
  scores: Record<string, number>;
  winnerId: string | null;
  currentPlayerId: string;
  sendoffText: string;
}) {
  const sorted = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  const maxScore = Math.max(...Object.values(scores), 1);

  return (
    <div className="w-full max-w-md space-y-6">
      <p className="font-pixel text-lg neon-text-green text-center animate-pulse">FINAL STANDINGS</p>

      {/* Alien sendoff */}
      {sendoffText && (
        <div className="alien-bubble p-3 mb-4">
          <p className="text-gray-200 text-sm leading-relaxed">
            <TypewriterText text={sendoffText} speed={20} onWordSound={() => soundEngine.playTypewriterTick()} />
          </p>
        </div>
      )}

      {sorted.map((player, i) => {
        const total = scores[player.id] || 0;
        const isWinner = player.id === winnerId;
        const isYou = player.id === currentPlayerId;
        const barColor = AVATAR_CONFIG[player.avatar]?.color || "#39ff14";

        return (
          <div key={player.id} className={`animate-slide-up rounded-xl p-4 ${isWinner ? "border-2 border-neon-green/60 bg-neon-green/10" : "border border-white/5 bg-white/5"}`} style={{ animationDelay: `${i * 300}ms` }}>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-pixel text-lg text-gray-400 w-8">{i === 0 ? "\uD83D\uDC51" : `${i + 1}.`}</span>
              <PixelAvatar type={player.avatar} size={40} animated />
              <div className="flex-1">
                <p className={`font-semibold ${isWinner ? "neon-text-green" : "text-white"}`}>{player.name}{isYou ? " (you)" : ""}</p>
                {isWinner && <p className="font-pixel text-[10px] neon-text-yellow">EXTRACTED</p>}
              </div>
              <span className="font-pixel text-lg text-white">{total}</span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1500 ease-out" style={{
                width: `${(total / maxScore) * 100}%`,
                backgroundColor: barColor,
                boxShadow: `0 0 8px ${barColor}`,
                transitionDelay: `${i * 400}ms`,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

