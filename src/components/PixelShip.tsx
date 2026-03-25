"use client";

import { useState, useEffect } from "react";

// Frame 1: Normal
const FRAME_1 = [
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
  '................................',
  '................................',
  '................................',
  '................................',
];

// Frame 2: Lights shifted
const FRAME_2 = [
  '..........GGGGGGGGGGGG..........',
  '.......GGGGLLLLLLLLGGGG.........',
  '.....GGGLLLLLLLLLLLLLLGGG.......',
  '....GGLLLLLWWWWWWLLLLLLLGG.....',
  '...GGLLLLWWWWWWWWWWLLLLLLGG....',
  '..GGLLLWWWWCCWWCCWWWLLLLLGG...',
  '.GGGLLWWWWWWWWWWWWWWWLLLLGGG..',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGG.',
  '..NNNNNNNNNNNNNNNNNNNNNNNNNN...',
  '...NNNNNNNNNNNNNNNNNNNNNNNN....',
  '...GGGGGGGGGGGGGGGGGGGGGGGG....',
  '....GGG..GGGG..GGGG..GGGG.....',
  '................................',
  '................................',
  '................................',
  '................................',
];

// Jet stream frames
const JET_FRAME_1 = [
  '..............MMMM..............',
  '...............MM...............',
  '..............MMMM..............',
  '...............MM...............',
  '................M...............',
  '................................',
];

const JET_FRAME_2 = [
  '...............MM...............',
  '..............MMMM..............',
  '...............MM...............',
  '..............MMMM..............',
  '..............M.M...............',
  '................................',
];

const JET_FRAME_3 = [
  '..............MMMM..............',
  '..............MMMM..............',
  '...............MM...............',
  '...............MM...............',
  '...............M................',
  '................................',
];

const SHIP_COLORS: Record<string, string> = {
  G: '#555566', L: '#777788', W: '#99aacc', C: '#00f0ff', M: '#39ff14', N: '#bf00ff',
};

const JET_COLORS: Record<string, string> = {
  M: '#39ff14',
};

function renderGrid(grid: string[], colors: Record<string, string>, viewBox: string, width: number, height: number) {
  const rows = grid.length;
  const cols = grid[0].length;
  return (
    <svg width={width} height={height} viewBox={viewBox} shapeRendering="crispEdges">
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

export function PixelShip({
  size = 128,
  animate = true,
  showJetStream = false,
}: {
  size?: number;
  animate?: boolean;
  showJetStream?: boolean;
}) {
  const [frame, setFrame] = useState(0);
  const [jetFrame, setJetFrame] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const interval = setInterval(() => setFrame((f) => (f + 1) % 2), 600);
    return () => clearInterval(interval);
  }, [animate]);

  useEffect(() => {
    if (!showJetStream || !animate) return;
    const interval = setInterval(() => setJetFrame((f) => (f + 1) % 3), 200);
    return () => clearInterval(interval);
  }, [showJetStream, animate]);

  const shipGrid = animate ? (frame === 0 ? FRAME_1 : FRAME_2) : FRAME_1;
  const jetGrids = [JET_FRAME_1, JET_FRAME_2, JET_FRAME_3];
  const jetHeight = size * 0.19; // jet stream proportional height

  return (
    <div className="flex flex-col items-center">
      {renderGrid(shipGrid, SHIP_COLORS, "0 0 32 16", size, size / 2)}
      {showJetStream && (
        <div style={{ marginTop: -2, opacity: 0.8 }}>
          {renderGrid(jetGrids[jetFrame], JET_COLORS, "0 0 32 6", size, jetHeight)}
        </div>
      )}
    </div>
  );
}
