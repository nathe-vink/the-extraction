"use client";

import { useState, useEffect } from "react";

// 32x32 pixel art alien — neon green/cyan aesthetic
// Frame 1: Normal
const FRAME_1 = [
  '................................',
  '..........cc..........cc........',
  '.........cccc........cccc.......',
  '........cccccc......cccccc......',
  '........cccccc......cccccc......',
  '.........cccc........cccc.......',
  '..........ccGGGGGGGGcc..........',
  '.........GGGGGGGGGGGGgg........',
  '........GGGGGGGGGGGGGGgg.......',
  '.......GGGggGGGGGGggGGGgg......',
  '......GGGgddgGGGGgddgGGGg.....',
  '......GGGgddgGGGGgddgGGGg.....',
  '......GGGGggGGGGGGggGGGGg.....',
  '.......GGGGGGGGGGGGGGGGg......',
  '........GGGGGGmmGGGGGGg........',
  '.........GGGGmmmmGGGGg..........',
  '..........GGGGGGGGGGg...........',
  '...........gGGGGGGgg............',
  '............gggggggg.............',
  '...........GG......GG...........',
  '..........GGG......GGG..........',
  '..........GgG......GgG..........',
  '..........GGG......GGG..........',
  '...........GG......GG...........',
  '...........Gg......gG...........',
  '..........ggg......ggg..........',
  '..........gGg......gGg..........',
  '..........ggg......ggg..........',
  '................................',
  '................................',
  '................................',
  '................................',
];

// Frame 2: Blink
const FRAME_2 = [
  '................................',
  '..........cc..........cc........',
  '.........cccc........cccc.......',
  '........cccccc......cccccc......',
  '........cccccc......cccccc......',
  '.........cccc........cccc.......',
  '..........ccGGGGGGGGcc..........',
  '.........GGGGGGGGGGGGgg........',
  '........GGGGGGGGGGGGGGgg.......',
  '.......GGGGGGGGGGGGGGGGgg......',
  '......GGGGddGGGGGGddGGGGg.....',
  '......GGGGddGGGGGGddGGGGg.....',
  '......GGGGGGGGGGGGGGGGGGg.....',
  '.......GGGGGGGGGGGGGGGGg......',
  '........GGGGGGmmGGGGGGg........',
  '.........GGGGmmmmGGGGg..........',
  '..........GGGGGGGGGGg...........',
  '...........gGGGGGGgg............',
  '............gggggggg.............',
  '...........GG......GG...........',
  '..........GGG......GGG..........',
  '..........GgG......GgG..........',
  '..........GGG......GGG..........',
  '...........GG......GG...........',
  '...........Gg......gG...........',
  '..........ggg......ggg..........',
  '..........gGg......gGg..........',
  '..........ggg......ggg..........',
  '................................',
  '................................',
  '................................',
  '................................',
];

// Frame 3: Antenna wobble left
const FRAME_3 = [
  '................................',
  '.........cc..........cc.........',
  '........cccc........cccc........',
  '.......cccccc......cccccc.......',
  '.......cccccc......cccccc.......',
  '........cccc........cccc........',
  '..........ccGGGGGGGGcc..........',
  '.........GGGGGGGGGGGGgg........',
  '........GGGGGGGGGGGGGGgg.......',
  '.......GGGggGGGGGGggGGGgg......',
  '......GGGgddgGGGGgddgGGGg.....',
  '......GGGgddgGGGGgddgGGGg.....',
  '......GGGGggGGGGGGggGGGGg.....',
  '.......GGGGGGGGGGGGGGGGg......',
  '........GGGGGGmmGGGGGGg........',
  '.........GGGGmmmmGGGGg..........',
  '..........GGGGGGGGGGg...........',
  '...........gGGGGGGgg............',
  '............gggggggg.............',
  '...........GG......GG...........',
  '..........GGG......GGG..........',
  '..........GgG......GgG..........',
  '..........GGG......GGG..........',
  '...........GG......GG...........',
  '...........Gg......gG...........',
  '..........ggg......ggg..........',
  '..........gGg......gGg..........',
  '..........ggg......ggg..........',
  '................................',
  '................................',
  '................................',
  '................................',
];

const COLORS: Record<string, string> = {
  G: '#39ff14',  // neon green body
  g: '#1a8a0a',  // dark green shadow
  c: '#00f0ff',  // cyan antenna
  d: '#0a0a1a',  // dark eye
  m: '#1a8a0a',  // mouth shadow
};

const FRAMES = [FRAME_1, FRAME_1, FRAME_1, FRAME_2, FRAME_1, FRAME_1, FRAME_3, FRAME_1];

export function PixelAlien({
  size = 48,
  animate = true,
}: {
  size?: number;
  animate?: boolean;
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!animate) return;
    const interval = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 400);
    return () => clearInterval(interval);
  }, [animate]);

  const grid = FRAMES[animate ? frame : 0];
  const rows = grid.length;
  const cols = grid[0].length;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
    >
      {grid.map((row, y) =>
        row.split("").map((char, x) => {
          if (char === ".") return null;
          const fill = COLORS[char];
          if (!fill) return null;
          return (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />
          );
        })
      )}
    </svg>
  );
}
