"use client";

import { AvatarType } from "@/lib/types";

type PixelGrid = {
  grid: string[];
  colors: Record<string, string>;
};

const AVATARS: Record<AvatarType, PixelGrid> = {
  hillbilly: {
    colors: {
      h: '#DAA520', H: '#B8860B', s: '#FDBF60', S: '#E5A84B', e: '#2d1b00',
      o: '#4682B4', O: '#3A6D96', m: '#8B4513', b: '#CD853F', w: '#FFFFFF',
      d: '#654321', t: '#F5DEB3',
    },
    grid: [
      '....HHHHHH......',
      '...HhhhhhhhH....',
      '..HhhhhhhhhhhH..',
      '..HhhhHHHhhhhH..',
      '...ssssssssss...',
      '..sssssssssssS..',
      '..sSe.sSsSe.sS..',
      '..sssssssssssS..',
      '...sSsssssSss...',
      '...sSSsmSSss....',
      '....ssssssss....',
      '...ooOooOooo....',
      '..oooOooOoooo...',
      '..oobbbbbboooo..',
      '...oo.oo.oo.oo..',
      '...dd..dd..dd...',
    ],
  },
  "mib-agent": {
    colors: {
      h: '#333333', H: '#222222', s: '#D2A679', S: '#BA8F65',
      g: '#111111', b: '#1a1a2e', B: '#0f0f1e', w: '#eeeeee',
      W: '#cccccc', t: '#8B0000', r: '#444444',
    },
    grid: [
      '....hhhhhh......',
      '...HhhhhhhhH....',
      '..HhhhhhhhhhhH..',
      '..HHHHHHHHHHHH..',
      '...ssssssssss...',
      '..sssssssssssS..',
      '..sggggSggggs...',
      '..sSsssssssSS...',
      '...sSsssssSs....',
      '....ssssssss....',
      '...bbbttbbbb....',
      '..bbbbttbbbbb...',
      '..bBwbbbbbBbb...',
      '..bbbbbbbbbbbb..',
      '...bb..bb..bb...',
      '...rr..rr..rr...',
    ],
  },
  "sexy-lady": {
    colors: {
      p: '#FF69B4', P: '#E0559E', s: '#FDBF60', S: '#E5A84B',
      e: '#2d1b00', l: '#FF0000', L: '#CC0000', r: '#FF1493',
      R: '#D1107A', E: '#4d3b00', h: '#FFB6C1', j: '#FF85B3',
    },
    grid: [
      '.pppppppppppp...',
      'pPpppppppppppp..',
      'pPppppppppppppp.',
      'pppppppppppppppp',
      '..ppsssssssspp..',
      '..sssssssssssS..',
      '..sEe.sSsEe.s..',
      '..sSsssssssSs...',
      '...sSlllllSs....',
      '....sSsssSs.....',
      '...rrrrrrrrrr...',
      '..rRrrrrrrrRr...',
      '..rrRrrrrRrrr...',
      '...rrrrrrrrrr...',
      '....rrrrrrr.....',
      '.....rr.rr......',
    ],
  },
  "mad-scientist": {
    colors: {
      w: '#aaaaaa', W: '#888888', g: '#00FF88', G: '#00CC6A',
      s: '#D2A679', S: '#BA8F65', e: '#2d1b00', c: '#eeeeee',
      C: '#cccccc', n: '#00FF88', N: '#009955', p: '#FFFFFF',
    },
    grid: [
      'w..wwwwwwww..w..',
      'ww.wwwwwwww.ww..',
      'wwwwWwwwwWwwww..',
      'wwwwwwwwwwwwww..',
      '..gwwssssswwg...',
      '..ggsssssssgg...',
      '..sSe.sSsSe.s...',
      '..sSsssssssSs...',
      '...sSssssSss....',
      '....ssssssss....',
      '...cccccccccc...',
      '..cCccccccCcc...',
      '..ccCcnnncCccc..',
      '..cccccccccccc..',
      '...cc..cc..cc...',
      '...pp..pp..pp...',
    ],
  },
  cowboy: {
    colors: {
      h: '#8B4513', H: '#6B3410', s: '#FDBF60', S: '#E5A84B',
      e: '#2d1b00', t: '#DAA520', T: '#B8860B', b: '#A0522D',
      d: '#654321', w: '#F5DEB3', g: '#CD853F',
    },
    grid: [
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '...hhhhhhhhhh...',
      '..HhhhhhhhhhHH..',
      '.HHHHhhhhhHHHH..',
      'HHHHHHHHHHHHHHHH',
      '....ssssssss....',
      '...sSssssssSs...',
      '...sSe.sSe.sS...',
      '...sSsssssSss...',
      '....ssSssSss....',
      '....ssssssss....',
      '...ttTttTttt....',
      '..tttttttttttt..',
      '...tt..tt..tt...',
      '...bb..bb..bb...',
    ],
  },
  grandma: {
    colors: {
      g: '#999999', G: '#777777', s: '#FDBF60', S: '#E5A84B',
      e: '#2d1b00', p: '#DDA0DD', P: '#C68BC6', o: '#666666',
      w: '#FFFFFF', b: '#9370DB', n: '#FFB6C1',
    },
    grid: [
      '....gggggg......',
      '...GggggggGg....',
      '..GgggggggggG...',
      '..gGg.gggg.gG...',
      '...gsssssssg....',
      '..sssssssssss...',
      '..soe.sSsoe.s...',
      '..sSsssssssSs...',
      '...sSsnnnSss....',
      '....ssssssss....',
      '...pppppppppp...',
      '..pPppppppPpp...',
      '..ppPpbbpPpppp..',
      '..pppppppppppp..',
      '...pp..pp..pp...',
      '...pp..pp..pp...',
    ],
  },
  "conspiracy-nut": {
    colors: {
      f: '#C0C0C0', F: '#A0A0A0', s: '#FDBF60', S: '#E5A84B',
      e: '#000000', g: '#556B2F', G: '#3D4E22', b: '#2F4F2F',
      d: '#654321', w: '#FF0000', r: '#8B0000',
    },
    grid: [
      '........f.......',
      '.......fff......',
      '......fffff.....',
      '.....ffFffff....',
      '....fffffffFf...',
      '...ffffffffffff.',
      '...sssssssssss..',
      '..sSssssssssSs..',
      '..sSew.sSsew.S..',
      '..sSsssssssSss..',
      '...sSssssSsss...',
      '....ssssssss....',
      '...ggGggGggg....',
      '..gggggggggggg..',
      '...gg..gg..gg...',
      '...dd..dd..dd...',
    ],
  },
  "florida-man": {
    colors: {
      d: '#654321', D: '#4A2F18', s: '#CD853F', S: '#B5722E',
      e: '#2d1b00', o: '#FF8C00', O: '#E07800', k: '#F5DEB3',
      K: '#E0C9A0', t: '#FF6347', w: '#FFFFFF', g: '#FFD700',
    },
    grid: [
      '....dddddd......',
      '...DddddddD.....',
      '..DddddddddddD.',
      '..dddDddddDddd..',
      '...ssssssssss...',
      '..sssssssssssS..',
      '..sSe.sSsSe.sS..',
      '..sSsssssssSss..',
      '...sSsssssSss...',
      '....sSsSSsss....',
      '...oooooooooo...',
      '..oOssssssoOo...',
      '..oosssssssooo..',
      '..oooooooooooo..',
      '...kk..kk..kk...',
      '...KK..KK..KK...',
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
