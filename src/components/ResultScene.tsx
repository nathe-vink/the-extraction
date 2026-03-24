"use client";

import { Player, AVATAR_CONFIG } from "@/lib/types";
import { PixelAvatar } from "./PixelAvatar";

// Pixel art UFO (32x16 grid)
function PixelShip({ size = 128 }: { size?: number }) {
  const grid = [
    '..........GGGGGGGGGGGG..........',
    '.......GGGGLLLLLLLLGGGG.........',
    '.....GGGLLLLLLLLLLLLLLGGG.......',
    '....GGLLLLLWWWWWWLLLLLLLGG.....',
    '...GGLLLLWWWWWWWWWWLLLLLLGG....',
    '..GGLLLWWCCWWWWCCWWWLLLLLGG...',
    '.GGGLLWWWWWWWWWWWWWWWLLLLGGG..',
    'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
    '.MMMMMMMMMMMMMMMMMMMMMMMMMMMM..',
    '..MMMMMMMMMMMMMMMMMMMMMMMMMM...',
    '...GGGGGGGGGGGGGGGGGGGGGGGG....',
    '....GGGG..GGGG..GGGG..GGG.....',
    '................. ..............',
    '................................',
    '................................',
    '................................',
  ];
  const colors: Record<string, string> = {
    G: '#555566', L: '#777788', W: '#99aacc', C: '#00f0ff', M: '#39ff14',
  };

  return (
    <svg width={size} height={size / 2} viewBox="0 0 32 16" shapeRendering="crispEdges">
      {grid.map((row, y) =>
        row.split("").map((char, x) => {
          if (char === "." || char === " ") return null;
          const fill = colors[char];
          if (!fill) return null;
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
        })
      )}
    </svg>
  );
}

// Pixel art skeleton (16x16)
function PixelSkeleton({ size = 32 }: { size?: number }) {
  const grid = [
    '....wwwwww......',
    '...wwwwwwww.....',
    '..wwwwwwwwww....',
    '..wweewwweew....',
    '..wwwwwwwwww....',
    '...wwwggwww.....',
    '...wwggggww.....',
    '....wwwwww......',
    '.....wwww.......',
    '....wwwwww......',
    '...wwwwwwww.....',
    '..wwwwwwwwww....',
    '..wwwwwwwwww....',
    '....wwwwww......',
    '.....ww.ww......',
    '.....ww.ww......',
  ];
  const colors: Record<string, string> = { w: '#e8e8d0', e: '#222222', g: '#333333' };

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges">
      {grid.map((row, y) =>
        row.split("").map((char, x) => {
          if (char === ".") return null;
          const fill = colors[char];
          if (!fill) return null;
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
        })
      )}
    </svg>
  );
}

// Pixel art ash pile (16x6)
function PixelAshPile({ size = 32 }: { size?: number }) {
  const grid = [
    '......aa.a......',
    '.....aAAaa......',
    '....aAAAAaa.....',
    '...aAAAAAAaa....',
    '..aaAAAAAAAAa...',
    '.aaAAAAAAAAaaa..',
  ];
  const colors: Record<string, string> = { a: '#555555', A: '#444444' };

  return (
    <svg width={size} height={size * 6 / 16} viewBox="0 0 16 6" shapeRendering="crispEdges">
      {grid.map((row, y) =>
        row.split("").map((char, x) => {
          if (char === ".") return null;
          const fill = colors[char];
          if (!fill) return null;
          return <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />;
        })
      )}
    </svg>
  );
}

// Animation phases:
// 0: Ship hovering, ramp extends
// 1: Winner walks up ramp
// 2: Ramp retracts, winner inside
// 3: Ship charges (pulsing glow)
// 4: Ship departs upward
// 5: Engine blast fires down
// 6: Losers become skeletons
// 7: Skeletons collapse to ash
// 8: GAME OVER

export function ResultScene({
  players,
  winnerId,
  currentPlayerId,
  animPhase,
}: {
  players: Player[];
  winnerId: string;
  currentPlayerId: string;
  animPhase: number;
}) {
  const winner = players.find((p) => p.id === winnerId);
  const losers = players.filter((p) => p.id !== winnerId);
  const isWinner = winnerId === currentPlayerId;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full relative overflow-hidden">
      {/* Ship */}
      {animPhase < 4 && (
        <div className={`relative ${animPhase === 3 ? "animate-charge-pulse" : "animate-float"}`}>
          <PixelShip size={160} />
          {/* Ramp */}
          {animPhase <= 1 && (
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-0 w-1 bg-gradient-to-b from-neon-green/80 to-neon-green/20 animate-ramp-extend origin-top"
              style={{ width: "4px" }}
            />
          )}
          {animPhase === 2 && (
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-0 w-1 bg-gradient-to-b from-neon-green/80 to-neon-green/20 animate-ramp-retract origin-top"
              style={{ width: "4px" }}
            />
          )}
        </div>
      )}

      {/* Ship departing */}
      {animPhase === 4 && (
        <div className="animate-ship-depart">
          <PixelShip size={160} />
        </div>
      )}

      {/* Engine blast */}
      {animPhase === 5 && (
        <div className="flex flex-col items-center">
          <div className="w-32 h-24 bg-gradient-to-b from-neon-green via-neon-yellow to-transparent animate-engine-blast origin-top rounded-b-full" />
        </div>
      )}

      {/* Winner walking up */}
      {animPhase <= 1 && (
        <div className={`mt-4 flex flex-col items-center ${animPhase === 1 ? "animate-walk-up" : ""}`}>
          <div className="p-2 rounded-lg bg-neon-green/10 border border-neon-green/30">
            <PixelAvatar type={winner?.avatar || "hillbilly"} size={48} fullBody />
          </div>
          <p className="text-white font-semibold text-sm mt-1">{winner?.name}</p>
          {isWinner && <p className="neon-text-green font-pixel text-[8px]">THAT&apos;S YOU!</p>}
        </div>
      )}

      {/* Winner inside ship (phases 2-4) */}
      {animPhase >= 2 && animPhase <= 4 && (
        <p className="font-pixel text-[10px] neon-text-green mt-2 animate-pulse">
          {winner?.name} is aboard!
        </p>
      )}

      {/* Losers section */}
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        {animPhase < 6 && animPhase >= 0 && losers.map((p) => (
          <div key={p.id} className="flex flex-col items-center gap-1 p-2">
            {animPhase <= 4 ? (
              <PixelAvatar type={p.avatar} size={36} fullBody />
            ) : (
              <div className={`transition-all duration-500 ${animPhase === 5 ? "burn-phase-1" : ""}`}>
                <PixelAvatar type={p.avatar} size={36} fullBody />
              </div>
            )}
            <p className="text-xs text-gray-400">{p.name}</p>
            {p.id === currentPlayerId && <p className="text-red-400 font-pixel text-[8px]">YOU</p>}
          </div>
        ))}

        {/* Skeleton phase */}
        {animPhase === 6 && losers.map((p) => (
          <div key={p.id} className="flex flex-col items-center gap-1 p-2 animate-skeleton-reveal">
            <PixelSkeleton size={36} />
            <p className="text-xs text-gray-500">{p.name}</p>
            {p.id === currentPlayerId && <p className="text-red-400 font-pixel text-[8px]">YOU</p>}
          </div>
        ))}

        {/* Ash phase */}
        {animPhase === 7 && losers.map((p) => (
          <div key={p.id} className="flex flex-col items-center gap-1 p-2 animate-ash-collapse">
            <PixelAshPile size={36} />
            <p className="text-xs text-gray-600">{p.name}</p>
          </div>
        ))}
      </div>

      {/* GAME OVER */}
      {animPhase >= 8 && (
        <div className="animate-fade-in space-y-4 mt-8 text-center">
          <p className="font-pixel text-lg neon-text-pink">GAME OVER</p>
          <p className="text-gray-400 text-sm">
            {isWinner
              ? "You've been extracted. Enjoy the stars."
              : "You've been reduced to cosmic dust. Better luck next apocalypse."}
          </p>
          <button onClick={() => (window.location.href = "/")} className="btn-neon btn-neon-pink">
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
