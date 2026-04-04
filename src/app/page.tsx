"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PixelShip } from "@/components/PixelShip";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join");
    if (joinCode) {
      setRoomCode(joinCode.toUpperCase());
      setMode("join");
    }
  }, []);

  const handleCreate = async () => {
    if (!playerName.trim()) {
      setError("Enter your name, human.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", playerName: playerName.trim() }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Create game failed:", res.status, text);
        setError(`Server error (${res.status}). Try again.`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("playerId", data.playerId);
        localStorage.setItem("playerName", playerName.trim());
        localStorage.setItem("roomCode", data.roomCode);
        router.push(`/game/${data.roomCode}`);
      } else {
        setError(data.error || "Failed to create game");
      }
    } catch (err) {
      console.error("Create game error:", err);
      setError("Connection failed. Try again.");
    }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      setError("Enter your name, human.");
      return;
    }
    if (!roomCode.trim()) {
      setError("Enter the room code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          playerName: playerName.trim(),
          roomCode: roomCode.trim().toUpperCase(),
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("Join game failed:", res.status, text);
        setError(`Server error (${res.status}). Try again.`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("playerId", data.playerId);
        localStorage.setItem("playerName", playerName.trim());
        localStorage.setItem("roomCode", data.roomCode);
        router.push(`/game/${data.roomCode}`);
      } else {
        setError(data.error || "Failed to join game");
      }
    } catch (err) {
      console.error("Join game error:", err);
      setError("Connection failed. Try again.");
    }
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      {/* Title */}
      <div className="text-center mb-12 animate-fade-in">
        <div className="mb-4 animate-float"><PixelShip size={120} animate showJetStream /></div>
        <h1 className="font-pixel text-2xl sm:text-4xl neon-text-green mb-4 tracking-wider">
          THE EXTRACTION
        </h1>
        <p className="text-sm sm:text-base text-gray-400 max-w-md mx-auto font-mono">
          An alien has come to destroy Earth.
          <br />
          It will save <span className="neon-text-green">one</span> of you.
          <br />
          <span className="text-gray-500">Convince it you&apos;re worthy.</span>
        </p>
      </div>

      {/* Menu */}
      <div className="w-full max-w-sm space-y-4">
        {mode === "menu" && (
          <div className="space-y-4 animate-slide-up">
            <button
              onClick={() => setMode("create")}
              className="btn-neon w-full py-4"
            >
              Create Game
            </button>
            <button
              onClick={() => setMode("join")}
              className="btn-neon btn-neon-pink w-full py-4"
            >
              Join Game
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-4 animate-slide-up">
            <div>
              <label className="block text-xs text-neon-green font-pixel mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your real name..."
                maxLength={20}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="btn-neon w-full py-4"
            >
              {loading ? "Creating..." : "Launch Game"}
            </button>
            <button
              onClick={() => {
                setMode("menu");
                setError("");
              }}
              className="text-gray-500 text-sm w-full text-center hover:text-gray-300"
            >
              &larr; Back
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="space-y-4 animate-slide-up">
            <div>
              <label className="block text-xs text-neon-pink font-pixel mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your real name..."
                maxLength={20}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-neon-pink font-pixel mb-2">
                Room Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="XXXX"
                maxLength={4}
                className="text-center text-2xl tracking-[0.5em] font-pixel"
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={loading}
              className="btn-neon btn-neon-pink w-full py-4"
            >
              {loading ? "Joining..." : "Board Ship"}
            </button>
            <button
              onClick={() => {
                setMode("menu");
                setError("");
              }}
              className="text-gray-500 text-sm w-full text-center hover:text-gray-300"
            >
              &larr; Back
            </button>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm text-center font-mono">
            {error}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="mt-16 text-center text-gray-600 text-xs">
        <p>2-8 players &middot; 15-20 minutes &middot; Betrayal guaranteed</p>
      </div>
    </main>
  );
}
