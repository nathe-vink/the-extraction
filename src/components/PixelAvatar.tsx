"use client";

import { AvatarType } from "@/lib/types";

type PixelGrid = {
  grid: string[];
  colors: Record<string, string>;
};

const AVATARS: Record<AvatarType, PixelGrid> = {
  hillbilly: {
    colors: { h: '#DAA520', s: '#FDBF60', e: '#2d1b00', o: '#4682B4', m: '#8B4513' },
    grid: [
      '..hhhh..',
      '.hhhhhh.',
      '..ssss..',
      '.sesses.',
      '..ssss..',
      '..mssm..',
      '.oooooo.',
      '..oo.oo.',
    ],
  },
  "mib-agent": {
    colors: { h: '#333333', s: '#D2A679', g: '#111111', b: '#1a1a2e', w: '#eeeeee' },
    grid: [
      '..hhhh..',
      '.hhhhhh.',
      '..ssss..',
      '.sggggs.',
      '..ssss..',
      '.bbbbbb.',
      '.bwbbbb.',
      '..bb.bb.',
    ],
  },
  "sexy-lady": {
    colors: { p: '#FF69B4', s: '#FDBF60', e: '#2d1b00', l: '#FF0000', r: '#FF1493' },
    grid: [
      '.pppppp.',
      'pppppppp',
      '..ssss..',
      '.sesses.',
      '..slls..',
      '.rrrrrr.',
      '..rrrr..',
      '...rr...',
    ],
  },
  "mad-scientist": {
    colors: { w: '#aaaaaa', g: '#00FF88', s: '#D2A679', e: '#2d1b00', c: '#eeeeee' },
    grid: [
      'w.wwww.w',
      'wwwwwwww',
      '..gssg..',
      '..sees..',
      '..ssss..',
      '.cccccc.',
      '.cccccc.',
      '..cc.cc.',
    ],
  },
  cowboy: {
    colors: { h: '#8B4513', s: '#FDBF60', e: '#2d1b00', t: '#DAA520' },
    grid: [
      '..hhhh..',
      '.hhhhhh.',
      'hhhhhhhh',
      '..ssss..',
      '.sesses.',
      '..ssss..',
      '.tttttt.',
      '..tt.tt.',
    ],
  },
  grandma: {
    colors: { g: '#999999', s: '#FDBF60', o: '#666666', e: '#2d1b00', p: '#DDA0DD' },
    grid: [
      '..gggg..',
      '.gggggg.',
      '.gg.ggg.',
      '..ssss..',
      '.soesoe.',
      '..ssss..',
      '.pppppp.',
      '..pp.pp.',
    ],
  },
  "conspiracy-nut": {
    colors: { f: '#C0C0C0', s: '#FDBF60', e: '#000000', g: '#556B2F' },
    grid: [
      '....f...',
      '...fff..',
      '..fffff.',
      '..ssss..',
      '.sesses.',
      '..ssss..',
      '.gggggg.',
      '..gg.gg.',
    ],
  },
  "florida-man": {
    colors: { d: '#654321', s: '#CD853F', e: '#2d1b00', o: '#FF8C00', k: '#F5DEB3' },
    grid: [
      '..dddd..',
      '.dddddd.',
      '..ssss..',
      '.sesses.',
      '..ssss..',
      '.oooooo.',
      '.osssso.',
      '..kk.kk.',
    ],
  },
};

export function PixelAvatar({
  type,
  size = 32,
}: {
  type: AvatarType;
  size?: number;
}) {
  const avatar = AVATARS[type];
  if (!avatar) return null;

  const rows = avatar.grid.length;
  const cols = avatar.grid[0].length;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${cols} ${rows}`}
      shapeRendering="crispEdges"
    >
      {avatar.grid.map((row, y) =>
        row.split("").map((char, x) => {
          if (char === ".") return null;
          const fill = avatar.colors[char];
          if (!fill) return null;
          return (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={fill}
            />
          );
        })
      )}
    </svg>
  );
}
