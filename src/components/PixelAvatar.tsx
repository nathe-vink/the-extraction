"use client";

import { AvatarType } from "@/lib/types";

type PixelGrid = {
  grid: string[];
  colors: Record<string, string>;
};

// Portrait avatars (head/shoulders, 16x16) — used throughout the game
const AVATARS: Record<AvatarType, PixelGrid> = {
  hillbilly: {
    colors: {
      h: '#DAA520', H: '#B8860B', s: '#FDBF60', S: '#E5A84B', e: '#2d1b00',
      m: '#8B4513', t: '#F5DEB3', w: '#FFFFFF', b: '#CD853F',
      o: '#4682B4', O: '#3A6D96',
    },
    grid: [
      '....HHHHHH......',
      '...HhhhhhhhH....',
      '..HhhhhhhhhhhH..',
      '..HhhhHHHhhhhH..',
      '..HhhhhhhhhhHH..',
      '...ssssssssss...',
      '..sssssssssssS..',
      '..sSe.sSsSe.sS..',
      '..sssssssssssS..',
      '...sSsssssSss...',
      '...sSSsmSSss....',
      '....ssssssss....',
      '.....ssssss.....',
      '...ooOooOooo....',
      '..oooOooOoooo...',
      '..oooooooooooo..',
    ],
  },
  "mib-agent": {
    colors: {
      h: '#333333', H: '#222222', s: '#D2A679', S: '#BA8F65',
      g: '#111111', b: '#1a1a2e', B: '#0f0f1e', w: '#eeeeee',
      t: '#8B0000', r: '#444444',
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
      '.....ssssss.....',
      '...bbbttbbbb....',
      '..bbbbttbbbbb...',
      '..bBwbbbbbBbb...',
      '..bbbbbbbbbbb...',
      '..bbbbbbbbbbb...',
    ],
  },
  "sexy-lady": {
    colors: {
      p: '#FF69B4', P: '#E0559E', s: '#FDBF60', S: '#E5A84B',
      e: '#2d1b00', l: '#FF0000', r: '#FF1493',
      R: '#D1107A', E: '#4d3b00', k: '#000000',
    },
    grid: [
      '.pppppppppppp...',
      'pPpppppppppppp..',
      'pPppppppppppppp.',
      'pppppppppppppppp',
      '..ppsssssssspp..',
      '..sssssssssssS..',
      '..sEekkSsEekks..',
      '..sSsssssssSs...',
      '...sSlllllSs....',
      '....sSsssSs.....',
      '.....ssssss.....',
      '...rrrrrrrrrr...',
      '..rRrrrrrrrRr...',
      '..rrRrrrrRrrr...',
      '..rrrrrrrrrrrr..',
      '..rrrrrrrrrrrr..',
    ],
  },
  "mad-scientist": {
    colors: {
      w: '#aaaaaa', W: '#888888', g: '#00FF88', G: '#00CC6A',
      s: '#D2A679', S: '#BA8F65', e: '#2d1b00', c: '#eeeeee',
      C: '#cccccc', n: '#00FF88',
    },
    grid: [
      'w..wwwwwwww..w..',
      'ww.wwwwwwww.ww..',
      'wwwwWwwwwWwwww..',
      'wwwwwwwwwwwwww..',
      '..gwwssssswwg...',
      '..ggsssssssgg...',
      '..sGGgsSsGGgs...',
      '..sSsssssssSs...',
      '...sSssssSss....',
      '....ssssssss....',
      '.....ssssss.....',
      '...cccccccccc...',
      '..cCccccccCcc...',
      '..ccCcnnncCcc...',
      '..ccccccccccc...',
      '..ccccccccccc...',
    ],
  },
  cowboy: {
    colors: {
      h: '#8B4513', H: '#6B3410', s: '#FDBF60', S: '#E5A84B',
      e: '#2d1b00', t: '#DAA520', T: '#B8860B', b: '#A0522D',
      d: '#654321', w: '#F5DEB3',
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
      '.....ssssss.....',
      '...ttTttTttt....',
      '..tttttttttttt..',
      '..tttttttttttt..',
    ],
  },
  grandma: {
    colors: {
      g: '#999999', G: '#777777', s: '#FDBF60', S: '#E5A84B',
      e: '#2d1b00', p: '#DDA0DD', P: '#C68BC6', o: '#666666',
      w: '#FFFFFF', n: '#FFB6C1',
    },
    grid: [
      '....gggggg......',
      '...GggggggGg....',
      '..GgggggggggG...',
      '..gGg.gggg.gG...',
      '..gggggggggggg..',
      '...gsssssssg....',
      '..sssssssssss...',
      '..soe.sSsoe.s...',
      '..sSsssssssSs...',
      '...sSsnnnSss....',
      '....ssssssss....',
      '.....ssssss.....',
      '...pppppppppp...',
      '..pPppppppPpp...',
      '..pppppppppppp..',
      '..pppppppppppp..',
    ],
  },
  "conspiracy-nut": {
    colors: {
      f: '#C0C0C0', F: '#A0A0A0', s: '#FDBF60', S: '#E5A84B',
      e: '#000000', g: '#556B2F', G: '#3D4E22',
      w: '#FF0000', r: '#8B0000', d: '#654321',
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
      '.....ssssss.....',
      '...ggGggGggg....',
      '..gggggggggggg..',
      '..gggggggggggg..',
    ],
  },
  "florida-man": {
    colors: {
      d: '#654321', D: '#4A2F18', s: '#CD853F', S: '#B5722E',
      e: '#2d1b00', o: '#FF8C00', O: '#E07800',
      g: '#FFD700', t: '#FF6347', w: '#FFFFFF',
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
      '.....ssssss.....',
      '..ggsssssssgg...',
      '...oooooooooo...',
      '..oOssssssoOo...',
      '..oooooooooooo..',
      '..oooooooooooo..',
    ],
  },
};

// Full-body avatars (16x24) — used only in the ending animation
export const FULL_BODY_AVATARS: Record<AvatarType, PixelGrid> = {
  hillbilly: {
    colors: {
      h: '#DAA520', H: '#B8860B', s: '#FDBF60', S: '#E5A84B', e: '#2d1b00',
      m: '#8B4513', o: '#4682B4', O: '#3A6D96', b: '#CD853F', d: '#654321',
    },
    grid: [
      '....HHHHHH......',
      '...HhhhhhhhH....',
      '..HhhhhhhhhhhH..',
      '..HhhhHHHhhhhH..',
      '...ssssssssss...',
      '..sSe.sSsSe.sS..',
      '..sssssssssssS..',
      '...sSsssssSss...',
      '...sSSsmSSss....',
      '....ssssssss....',
      '.....ssssss.....',
      '...ooOooOooo....',
      '..oooOooOoooo...',
      '..oobbbbbboooo..',
      '..oooooooooooo..',
      '..oooooooooooo..',
      '...oooooooooo...',
      '....oooooooo....',
      '.....oo..oo.....',
      '.....oo..oo.....',
      '....ddd..ddd....',
      '....ddd..ddd....',
      '................',
      '................',
    ],
  },
  "mib-agent": {
    colors: {
      h: '#333333', H: '#222222', s: '#D2A679', S: '#BA8F65',
      g: '#111111', b: '#1a1a2e', B: '#0f0f1e', w: '#eeeeee',
      t: '#8B0000', r: '#444444',
    },
    grid: [
      '....hhhhhh......',
      '...HhhhhhhhH....',
      '..HhhhhhhhhhhH..',
      '..HHHHHHHHHHHH..',
      '...ssssssssss...',
      '..sggggSggggs...',
      '..sSsssssssSS...',
      '...sSsssssSs....',
      '....ssssssss....',
      '.....ssssss.....',
      '...bbbttbbbb....',
      '..bbbbttbbbbb...',
      '..bBwbbbbbBbb...',
      '..bbbbbbbbbbb...',
      '..bbbbbbbbbbb...',
      '..bbbbbbbbbbb...',
      '...bbbbbbbbb....',
      '....bbbbbbbb....',
      '.....bb..bb.....',
      '.....bb..bb.....',
      '....rrr..rrr....',
      '....rrr..rrr....',
      '................',
      '................',
    ],
  },
  "sexy-lady": {
    colors: {
      p: '#FF69B4', P: '#E0559E', s: '#FDBF60', S: '#E5A84B',
      e: '#2d1b00', l: '#FF0000', r: '#FF1493',
      R: '#D1107A', E: '#4d3b00', k: '#000000', h: '#FFB6C1',
    },
    grid: [
      '.pppppppppppp...',
      'pPpppppppppppp..',
      'pPppppppppppppp.',
      'pppppppppppppppp',
      '..ppsssssssspp..',
      '..sEekkSsEekks..',
      '..sSsssssssSs...',
      '...sSlllllSs....',
      '....sSsssSs.....',
      '.....ssssss.....',
      '...rrrrrrrrrr...',
      '..rRrrrrrrrRr...',
      '..rrRrrrrRrrr...',
      '..rrrrrrrrrrrr..',
      '..rrrrrrrrrrrr..',
      '...rrrrrrrrrr...',
      '....rrrrrrrr....',
      '.....rrrrrr.....',
      '.....rr..rr.....',
      '.....rr..rr.....',
      '....hhh..hhh....',
      '....hhh..hhh....',
      '................',
      '................',
    ],
  },
  "mad-scientist": {
    colors: {
      w: '#aaaaaa', W: '#888888', g: '#00FF88', G: '#00CC6A',
      s: '#D2A679', S: '#BA8F65', e: '#2d1b00', c: '#eeeeee',
      C: '#cccccc', n: '#00FF88', p: '#FFFFFF',
    },
    grid: [
      'w..wwwwwwww..w..',
      'ww.wwwwwwww.ww..',
      'wwwwWwwwwWwwww..',
      'wwwwwwwwwwwwww..',
      '..gwwssssswwg...',
      '..sGGgsSsGGgs...',
      '..sSsssssssSs...',
      '...sSssssSss....',
      '....ssssssss....',
      '.....ssssss.....',
      '...cccccccccc...',
      '..cCccccccCcc...',
      '..ccCcnnncCcc...',
      '..ccccccccccc...',
      '..ccccccccccc...',
      '..ccccccccccc...',
      '...ccccccccc....',
      '....cccccccc....',
      '.....cc..cc.....',
      '.....cc..cc.....',
      '....ppp..ppp....',
      '....ppp..ppp....',
      '................',
      '................',
    ],
  },
  cowboy: {
    colors: {
      h: '#8B4513', H: '#6B3410', s: '#FDBF60', S: '#E5A84B',
      e: '#2d1b00', t: '#DAA520', T: '#B8860B', b: '#A0522D',
    },
    grid: [
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '...hhhhhhhhhh...',
      '..HhhhhhhhhhHH..',
      '.HHHHhhhhhHHHH..',
      'HHHHHHHHHHHHHHHH',
      '....ssssssss....',
      '...sSe.sSe.sS...',
      '...sSsssssSss...',
      '....ssSssSss....',
      '....ssssssss....',
      '.....ssssss.....',
      '...ttTttTttt....',
      '..tttttttttttt..',
      '..tttttttttttt..',
      '..tttttttttttt..',
      '...tttttttttt...',
      '....tttttttt....',
      '.....tt..tt.....',
      '.....tt..tt.....',
      '....bbb..bbb....',
      '....bbb..bbb....',
      '................',
      '................',
    ],
  },
  grandma: {
    colors: {
      g: '#999999', G: '#777777', s: '#FDBF60', S: '#E5A84B',
      e: '#2d1b00', p: '#DDA0DD', P: '#C68BC6', o: '#666666',
      n: '#FFB6C1',
    },
    grid: [
      '....gggggg......',
      '...GggggggGg....',
      '..GgggggggggG...',
      '..gGg.gggg.gG...',
      '...gsssssssg....',
      '..soe.sSsoe.s...',
      '..sSsssssssSs...',
      '...sSsnnnSss....',
      '....ssssssss....',
      '.....ssssss.....',
      '...pppppppppp...',
      '..pPppppppPpp...',
      '..pppppppppppp..',
      '..pppppppppppp..',
      '..pppppppppppp..',
      '..pppppppppppp..',
      '...pppppppppp...',
      '....pppppppp....',
      '.....pp..pp.....',
      '.....pp..pp.....',
      '....ppp..ppp....',
      '....ppp..ppp....',
      '................',
      '................',
    ],
  },
  "conspiracy-nut": {
    colors: {
      f: '#C0C0C0', F: '#A0A0A0', s: '#FDBF60', S: '#E5A84B',
      e: '#000000', g: '#556B2F', G: '#3D4E22',
      w: '#FF0000', d: '#654321',
    },
    grid: [
      '........f.......',
      '.......fff......',
      '......fffff.....',
      '.....ffFffff....',
      '....fffffffFf...',
      '...ffffffffffff.',
      '...sssssssssss..',
      '..sSew.sSsew.S..',
      '..sSsssssssSss..',
      '...sSssssSsss...',
      '....ssssssss....',
      '.....ssssss.....',
      '...ggGggGggg....',
      '..gggggggggggg..',
      '..gggggggggggg..',
      '..gggggggggggg..',
      '...gggggggggg...',
      '....gggggggg....',
      '.....gg..gg.....',
      '.....gg..gg.....',
      '....ddd..ddd....',
      '....ddd..ddd....',
      '................',
      '................',
    ],
  },
  "florida-man": {
    colors: {
      d: '#654321', D: '#4A2F18', s: '#CD853F', S: '#B5722E',
      e: '#2d1b00', o: '#FF8C00', O: '#E07800',
      g: '#FFD700', k: '#F5DEB3', K: '#E0C9A0',
    },
    grid: [
      '....dddddd......',
      '...DddddddD.....',
      '..DddddddddddD.',
      '..dddDddddDddd..',
      '...ssssssssss...',
      '..sSe.sSsSe.sS..',
      '..sSsssssssSss..',
      '...sSsssssSss...',
      '....sSsSSsss....',
      '.....ssssss.....',
      '..ggsssssssgg...',
      '...oooooooooo...',
      '..oOssssssoOo...',
      '..oooooooooooo..',
      '..oooooooooooo..',
      '..oooooooooooo..',
      '...oooooooooo...',
      '....oooooooo....',
      '.....oo..oo.....',
      '.....oo..oo.....',
      '....kkk..kkk....',
      '....KKK..KKK....',
      '................',
      '................',
    ],
  },
};

export function PixelAvatar({
  type,
  size = 32,
  fullBody = false,
}: {
  type: AvatarType;
  size?: number;
  fullBody?: boolean;
}) {
  const avatarSet = fullBody ? FULL_BODY_AVATARS : AVATARS;
  const avatar = avatarSet[type];
  if (!avatar) return null;

  const rows = avatar.grid.length;
  const cols = avatar.grid[0].length;

  return (
    <svg
      width={size}
      height={fullBody ? size * (rows / cols) : size}
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
