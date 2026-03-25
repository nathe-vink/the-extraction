"use client";

import { useState, useEffect } from "react";
import { AvatarType } from "@/lib/types";

type PixelGrid = {
  grid: string[];
  colors: Record<string, string>;
};

type AnimatedAvatar = {
  frames: PixelGrid[];
  frameDelay?: number; // ms per frame, default 500
};

// ============================================================
// PORTRAIT AVATARS (32×32) — used throughout the game
// Each character has 2+ animation frames with proper shading
// Colors use 3-4 tones: highlight, base, shadow, deep shadow
// Eyes use 2-3px pupils with white sclera, no line-eyes
// ============================================================

const HILLBILLY_COLORS: Record<string, string> = {
  // Hair
  h: '#DAA520', H: '#B8860B', y: '#F0C840',
  // Skin (4 tones)
  s: '#FDBF60', S: '#E5A84B', k: '#C98A35', K: '#A06D28',
  // Eyes
  w: '#FFFFFF', e: '#4d3319', p: '#1a1008',
  // Mouth
  m: '#8B4513', M: '#6B3410',
  // Overalls
  o: '#4682B4', O: '#3A6D96', q: '#2A5070',
  // Straw
  t: '#F5DEB3', T: '#D4BC8B',
  // Stubble
  b: '#C09838',
};

const HILLBILLY_FRAME_1: PixelGrid = {
  colors: HILLBILLY_COLORS,
  grid: [
    '................................',
    '..........yHHHHHHHHy...........',
    '.........yhhhhhhhhhhhy..........',
    '........yhhhhhhhhhhhhhy.........',
    '........HhhhhhhhhhhhhhH........',
    '........HhhhHHHHHhhhhhH........',
    '........HhhhhhhhhhhhhhH........',
    '........HhhhhhhhhhhhhhH........',
    '.........ssssssssssssss.........',
    '........sSsssssssssssSs.........',
    '.......sSssssssssssssSs........',
    '.......sSsssssssssssssSs.......',
    '.......sSswe.sSsSswe.sS.......',
    '.......sSswp.sSsSswp.sS.......',
    '.......sSksssssssssskSs........',
    '........sSbbbbbbbbbSs..........',
    '........sSksmmmmmskSs..........',
    '.........sSssmmmssSs.....t.....',
    '..........sSssssSs..ttttt......',
    '...........sSssSs..............',
    '............ssss................',
    '..........ooooooooo............',
    '.........ooOoooOoooo...........',
    '........ooOooooOooooo..........',
    '........ooooooooooooo..........',
    '........oqoooooooqooo..........',
    '........ooooooooooooo..........',
    '........oooooooooooo...........',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

// Frame 2: Straw switches to left side
const HILLBILLY_FRAME_2: PixelGrid = {
  colors: HILLBILLY_COLORS,
  grid: [
    '................................',
    '..........yHHHHHHHHy...........',
    '.........yhhhhhhhhhhhy..........',
    '........yhhhhhhhhhhhhhy.........',
    '........HhhhhhhhhhhhhhH........',
    '........HhhhHHHHHhhhhhH........',
    '........HhhhhhhhhhhhhhH........',
    '........HhhhhhhhhhhhhhH........',
    '.........ssssssssssssss.........',
    '........sSsssssssssssSs.........',
    '.......sSssssssssssssSs........',
    '.......sSsssssssssssssSs.......',
    '.......sSswe.sSsSswe.sS.......',
    '.......sSswp.sSsSswp.sS.......',
    '.......sSksssssssssskSs........',
    '........sSbbbbbbbbbSs..........',
    '........sSksmmmmmskSs..........',
    '....t....sSssmmmssSs...........',
    '.....ttttt..sSssSs.............',
    '..........sSssSs................',
    '............ssss................',
    '..........ooooooooo............',
    '.........ooOoooOoooo...........',
    '........ooOooooOooooo..........',
    '........ooooooooooooo..........',
    '........oqoooooooqooo..........',
    '........ooooooooooooo..........',
    '........oooooooooooo...........',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

const MIB_COLORS: Record<string, string> = {
  // Hair
  h: '#333333', H: '#1a1a1a', j: '#444444',
  // Skin
  s: '#D2A679', S: '#BA8F65', k: '#9E7550', K: '#7D5C3A',
  // Sunglasses
  g: '#111111', G: '#222222', r: '#334455',
  // Suit
  b: '#1a1a2e', B: '#0f0f1e', n: '#252540',
  // Tie
  t: '#8B0000', T: '#AA1111',
  // Shirt
  w: '#cccccc', W: '#dddddd',
  // Glint
  x: '#ffffff',
};

const MIB_FRAME_1: PixelGrid = {
  colors: MIB_COLORS,
  grid: [
    '................................',
    '...........HHHHHHHH............',
    '..........HhhhhhhhHH...........',
    '.........HhhhhhhhhhhH..........',
    '........HhhhhhhhhhhhHH.........',
    '........HHHHHHHHHHHHHHH........',
    '........HjhjhjhjhjhjhHH........',
    '.........ssssssssssssss.........',
    '........sSsssssssssssSs........',
    '.......sSssssssssssssSs........',
    '.......sSsGGGrsSsGGGrsS.......',
    '.......sSsGGGGsSsGGGGsS.......',
    '.......sSksssssssssskSs........',
    '........sSssssssssSss..........',
    '........sSkssssssksss..........',
    '.........sSssssssSs............',
    '..........sSssssSs.............',
    '...........ssssss..............',
    '..........bbbttbbbb............',
    '.........bbbWttWbbbbb..........',
    '........bbBWWttWWBbbbb.........',
    '........bBbWWttWWbBbbb.........',
    '........bbbbbttbbbbbbb.........',
    '........bbnbbttbbnbbbb.........',
    '........bbbbbbbbbbbbb..........',
    '........bbbbbbbbbbbbb..........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

// Frame 2: Sunglasses glint
const MIB_FRAME_2: PixelGrid = {
  colors: MIB_COLORS,
  grid: [
    '................................',
    '...........HHHHHHHH............',
    '..........HhhhhhhhHH...........',
    '.........HhhhhhhhhhhH..........',
    '........HhhhhhhhhhhhHH.........',
    '........HHHHHHHHHHHHHHH........',
    '........HjhjhjhjhjhjhHH........',
    '.........ssssssssssssss.........',
    '........sSsssssssssssSs........',
    '.......sSssssssssssssSs........',
    '.......sSsGxGrsSsGGGrsS.......',
    '.......sSsGGGGsSsGGGGsS.......',
    '.......sSksssssssssskSs........',
    '........sSssssssssSss..........',
    '........sSkssssssksss..........',
    '.........sSssssssSs............',
    '..........sSssssSs.............',
    '...........ssssss..............',
    '..........bbbttbbbb............',
    '.........bbbWttWbbbbb..........',
    '........bbBWWttWWBbbbb.........',
    '........bBbWWttWWbBbbb.........',
    '........bbbbbttbbbbbbb.........',
    '........bbnbbttbbnbbbb.........',
    '........bbbbbbbbbbbbb..........',
    '........bbbbbbbbbbbbb..........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

const SEXY_LADY_COLORS: Record<string, string> = {
  // Hair
  a: '#FF69B4', A: '#E0559E', P: '#CC4488', i: '#FF88CC',
  // Skin
  s: '#FDBF60', S: '#E5A84B', k: '#C98A35', K: '#A06D28',
  // Eyes
  w: '#FFFFFF', e: '#2E8B57', p: '#143D25', l: '#000000',
  // Lips
  r: '#FF0000', R: '#CC0000',
  // Eyelash
  L: '#1a0a00',
  // Dress
  d: '#FF1493', D: '#D1107A', x: '#FF69B4',
};

const SEXY_LADY_FRAME_1: PixelGrid = {
  colors: SEXY_LADY_COLORS,
  grid: [
    '......aaAAAAAAAAaaaa............',
    '.....aaiaaaaaaaaaiaa............',
    '....AaiaaaaaaaaaaiaA...........',
    '...AaaaaaaaaaaaaaaAA...........',
    '...AaaaaaaaaaaaaaaAA...........',
    '...AAAAaaaaaaaaAAAAA...........',
    '....aaassssssssssaa............',
    '........sSsssssSs..............',
    '.......sSssssssssSs............',
    '.......sSsssssssssS............',
    '......sSLwe.sSsLwe.Ss..........',
    '......sSswp.sSsswp.Ss..........',
    '......sSksssssssskSs...........',
    '.......sSksssssskss............',
    '........sSsrrrrSss.............',
    '.........sSsRRsSs..............',
    '..........sSssSs...............',
    '...........ssss................',
    '.........dddddddddd............',
    '........dDddddddDddd...........',
    '........ddDddddDddddd..........',
    '.......ddxddddddxdddd.........',
    '.......ddddddddddddddd........',
    '.......dDdddddddddDddd........',
    '.......ddddddddddddddd........',
    '........ddddddddddddd.........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

// Frame 2: Wink
const SEXY_LADY_FRAME_2: PixelGrid = {
  colors: SEXY_LADY_COLORS,
  grid: [
    '......aaAAAAAAAAaaaa............',
    '.....aaiaaaaaaaaaiaa............',
    '....AaiaaaaaaaaaaiaA...........',
    '...AaaaaaaaaaaaaaaAA...........',
    '...AaaaaaaaaaaaaaaAA...........',
    '...AAAAaaaaaaaaAAAAA...........',
    '....aaassssssssssaa............',
    '........sSsssssSs..............',
    '.......sSssssssssSs............',
    '.......sSsssssssssS............',
    '......sSLwe.sSssllsSs..........',
    '......sSswp.sSssssSs...........',
    '......sSksssssssskSs...........',
    '.......sSksssssskss............',
    '........sSsrrrrSss.............',
    '.........sSsRRsSs..............',
    '..........sSssSs...............',
    '...........ssss................',
    '.........dddddddddd............',
    '........dDddddddDddd...........',
    '........ddDddddDddddd..........',
    '.......ddxddddddxdddd.........',
    '.......ddddddddddddddd........',
    '.......dDdddddddddDddd........',
    '.......ddddddddddddddd........',
    '........ddddddddddddd.........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

const MAD_SCIENTIST_COLORS: Record<string, string> = {
  // Hair (wild white/gray)
  h: '#cccccc', H: '#999999', j: '#dddddd',
  // Skin
  s: '#D2A679', S: '#BA8F65', k: '#9E7550', K: '#7D5C3A',
  // Goggles
  g: '#00FF88', G: '#00CC6A', r: '#008844', f: '#444444', F: '#333333',
  // Eyes through goggles
  w: '#FFFFFF', e: '#2d1b00',
  // Lab coat
  c: '#eeeeee', C: '#cccccc', n: '#aaaaaa',
  // Glow
  x: '#66FFaa',
};

const MAD_SCIENTIST_FRAME_1: PixelGrid = {
  colors: MAD_SCIENTIST_COLORS,
  grid: [
    '...j.....................j......',
    '..jh..HHHHHHHHHH..hj...........',
    '.jhh.HhhhhhhhhhHH.hhj..........',
    '.hhhHHhhhhhhhhhhHHhhh..........',
    '.hhhHhhhhhhhhhhhhhHhh..........',
    '.hhhHhhhHHHHHhhhhhHhh..........',
    '..hHHhhhhhhhhhhhhhHH...........',
    '..hhHhhhhhhhhhhhhhHh...........',
    '.....ssssssssssssss............',
    '....sSssssssssssssSs...........',
    '...sSssssssssssssssSs..........',
    '...sSfGGGfsSsfGGGfsS...........',
    '...sSfGwGfsSsfGwGfsS...........',
    '...sSfGGGfsSsfGGGfsS...........',
    '....sSksssssssssskSs...........',
    '.....sSssssssssSss.............',
    '......sSssssssSss..............',
    '.......sSssssSs................',
    '........ssssss.................',
    '.......cccccccccc..............',
    '......cCccccccCccc.............',
    '.....ccCccccccCcccc............',
    '.....ccnccccccncccc............',
    '.....cccccccccccccc............',
    '.....ccccccccccccc.............',
    '......ccccccccccc..............',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

// Frame 2: Goggle glow pulse
const MAD_SCIENTIST_FRAME_2: PixelGrid = {
  colors: MAD_SCIENTIST_COLORS,
  grid: [
    '...j.....................j......',
    '..jh..HHHHHHHHHH..hj...........',
    '.jhh.HhhhhhhhhhHH.hhj..........',
    '.hhhHHhhhhhhhhhhHHhhh..........',
    '.hhhHhhhhhhhhhhhhhHhh..........',
    '.hhhHhhhHHHHHhhhhhHhh..........',
    '..hHHhhhhhhhhhhhhhHH...........',
    '..hhHhhhhhhhhhhhhhHh...........',
    '.....ssssssssssssss............',
    '....sSssssssssssssSs...........',
    '...sSssssssssssssssSs..........',
    '...sSfxxx fsSsfxxxfsS...........',
    '...sSfxwxfsSsfxwxfsS...........',
    '...sSfxxxfsSsfxxxfsS...........',
    '....sSksssssssssskSs...........',
    '.....sSssssssssSss.............',
    '......sSssssssSss..............',
    '.......sSssssSs................',
    '........ssssss.................',
    '.......cccccccccc..............',
    '......cCccccccCccc.............',
    '.....ccCccccccCcccc............',
    '.....ccnccccccncccc............',
    '.....cccccccccccccc............',
    '.....ccccccccccccc.............',
    '......ccccccccccc..............',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

const COWBOY_COLORS: Record<string, string> = {
  // Hat
  h: '#8B4513', H: '#6B3410', d: '#A0522D', D: '#543210',
  // Hat band
  t: '#DAA520', T: '#B8860B',
  // Skin
  s: '#FDBF60', S: '#E5A84B', k: '#C98A35', K: '#A06D28',
  // Eyes
  w: '#FFFFFF', e: '#4d3319', p: '#1a1008',
  // Mouth
  m: '#8B4513',
  // Stubble
  b: '#C09838',
  // Shirt
  r: '#DAA520', R: '#B8860B', q: '#8B6914',
  // Bandana
  n: '#CC0000', N: '#990000',
};

const COWBOY_FRAME_1: PixelGrid = {
  colors: COWBOY_COLORS,
  grid: [
    '..........hhhhhhhh.............',
    '.........hhhhhhhhhh............',
    '........hhdhhhhhdhhh...........',
    '.......hhhhhhhhhhhhhh..........',
    '......HhhhhhhhhhhhhhHH........',
    '.....HHHHhhhhhhhhhHHHH........',
    '....HHHHHHHHHHHHHHHHHHHH.......',
    '....HHHHHttttttttHHHHHH.......',
    '........ssssssssssss...........',
    '.......sSsssssssssSss..........',
    '......sSssssssssssssSs.........',
    '......sSswe.ssSsswe.Ss.........',
    '......sSswp.ssSsswp.Ss.........',
    '......sSksssssssssskS..........',
    '.......sSbbbbbbbbSss...........',
    '........sSssmmmsSss............',
    '.........sSssssSs..............',
    '..........ssssss...............',
    '.........nnnnnnnnn.............',
    '........rrRrrrRrrr.............',
    '.......rrRrrrrRrrrrr...........',
    '.......rrrrrrrrrrrrrr..........',
    '.......rqrrrrrrrqrrrr..........',
    '.......rrrrrrrrrrrrrr..........',
    '........rrrrrrrrrrrr...........',
    '........rrrrrrrrrrr............',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

// Frame 2: Slight hat tip
const COWBOY_FRAME_2: PixelGrid = {
  colors: COWBOY_COLORS,
  grid: [
    '.........hhhhhhhh..............',
    '........hhhhhhhhhh.............',
    '.......hhdhhhhhdhhh............',
    '......hhhhhhhhhhhhhh...........',
    '.....HhhhhhhhhhhhhhHH.........',
    '....HHHHhhhhhhhhhHHHHH........',
    '...HHHHHHHHHHHHHHHHHHHHHH......',
    '...HHHHHttttttttHHHHHHH.......',
    '........ssssssssssss...........',
    '.......sSsssssssssSss..........',
    '......sSssssssssssssSs.........',
    '......sSswe.ssSsswe.Ss.........',
    '......sSswp.ssSsswp.Ss.........',
    '......sSksssssssssskS..........',
    '.......sSbbbbbbbbSss...........',
    '........sSssmmmsSss............',
    '.........sSssssSs..............',
    '..........ssssss...............',
    '.........nnnnnnnnn.............',
    '........rrRrrrRrrr.............',
    '.......rrRrrrrRrrrrr...........',
    '.......rrrrrrrrrrrrrr..........',
    '.......rqrrrrrrrqrrrr..........',
    '.......rrrrrrrrrrrrrr..........',
    '........rrrrrrrrrrrr...........',
    '........rrrrrrrrrrr............',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

const GRANDMA_COLORS: Record<string, string> = {
  // Hair
  g: '#bbbbbb', G: '#888888', j: '#dddddd',
  // Skin
  s: '#FDBF60', S: '#E5A84B', k: '#C98A35', K: '#A06D28',
  // Eyes
  w: '#FFFFFF', e: '#6B4423', p: '#3B2413',
  // Glasses
  f: '#888888', F: '#666666',
  // Mouth
  n: '#FFB6C1', N: '#E0969F',
  // Dress
  d: '#DDA0DD', D: '#C68BC6', x: '#BB80BB',
  // Knitting needles
  t: '#C0C0C0', T: '#888888',
};

const GRANDMA_FRAME_1: PixelGrid = {
  colors: GRANDMA_COLORS,
  grid: [
    '.........ggggggggg.............',
    '........GgggggggggGg...........',
    '.......GgggjgggjgggGg..........',
    '......GgggggggggggggG..........',
    '......GgGg.ggggg.gGgG..........',
    '......gggggggggggggggg..........',
    '.......gsssssssssssg...........',
    '......sSsssssssssssSs..........',
    '.....sSfwefsSsfwefsSs..........',
    '.....sSfwpfsSsfwpfsSs..........',
    '.....sSksssssssssskSs..........',
    '......sSkssnnnsskSs............',
    '.......sSssssssSs..............',
    '........sSssssSs...............',
    '.........ssssss................',
    '........dddddddddd............',
    '.......dDddddddDddd...........',
    '......dDddddddddDdddd.........',
    '......dxddddddddxdddd.........',
    '......ddddddddddddddd.t.......',
    '......dDdddddddddDddt.........',
    '......ddddddddddddt...........',
    '.......ddddddddddt............',
    '........ddddddddd.............',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

// Frame 2: Knitting needle position shifts
const GRANDMA_FRAME_2: PixelGrid = {
  colors: GRANDMA_COLORS,
  grid: [
    '.........ggggggggg.............',
    '........GgggggggggGg...........',
    '.......GgggjgggjgggGg..........',
    '......GgggggggggggggG..........',
    '......GgGg.ggggg.gGgG..........',
    '......gggggggggggggggg..........',
    '.......gsssssssssssg...........',
    '......sSsssssssssssSs..........',
    '.....sSfwefsSsfwefsSs..........',
    '.....sSfwpfsSsfwpfsSs..........',
    '.....sSksssssssssskSs..........',
    '......sSkssnnnsskSs............',
    '.......sSssssssSs..............',
    '........sSssssSs...............',
    '.........ssssss................',
    '........dddddddddd............',
    '.......dDddddddDddd...........',
    '......dDddddddddDdddd.........',
    '......dxddddddddxdddd.........',
    '......dddddddddddddddt........',
    '......dDddddddddddDddt........',
    '......ddddddddddddddt.........',
    '.......dddddddddddt...........',
    '........ddddddddd.............',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

const CONSPIRACY_COLORS: Record<string, string> = {
  // Tinfoil hat
  f: '#C0C0C0', F: '#909090', i: '#E0E0E0', I: '#FFFFFF',
  // Skin
  s: '#FDBF60', S: '#E5A84B', k: '#C98A35', K: '#A06D28',
  // Eyes (bloodshot / intense)
  w: '#FFFFFF', e: '#882200', p: '#441100', r: '#FF4444',
  // Beard
  b: '#8B4513', B: '#6B3410',
  // Jacket
  g: '#556B2F', G: '#3D4E22', q: '#2A3518',
  // T-shirt
  t: '#333333',
};

const CONSPIRACY_FRAME_1: PixelGrid = {
  colors: CONSPIRACY_COLORS,
  grid: [
    '...............f................',
    '..............fff...............',
    '.............fffff..............',
    '............fFfFffF.............',
    '...........fFfffffFf............',
    '..........ffffffffff...........',
    '.........ffffffffffff..........',
    '........ffffiffffffiff.........',
    '........ffffffffffffff.........',
    '.........ssssssssssss..........',
    '........sSsssssssssSss.........',
    '.......sSssssssssssssSs........',
    '.......sSswe.ssSsswe.Ss.......',
    '.......sSswp.ssSsswp.Ss.......',
    '.......sSksssssssssskSs........',
    '........sSsbbbbbbbSss..........',
    '........sSsbBbBbBbSss..........',
    '.........sSsssssSss............',
    '..........sSssSss..............',
    '...........ssss................',
    '.........gggttggggg............',
    '........gGggtggGgggg...........',
    '.......gGggttggGggggg..........',
    '.......ggqgggggqggggg..........',
    '.......ggggggggggggggg.........',
    '.......gGgggggggggGggg.........',
    '........ggggggggggggg..........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

// Frame 2: Tinfoil spark
const CONSPIRACY_FRAME_2: PixelGrid = {
  colors: CONSPIRACY_COLORS,
  grid: [
    '...............f................',
    '..............fff...............',
    '.............fffff..............',
    '............fFfFffF.............',
    '...........fFfffffFf............',
    '..........ffffffffff...........',
    '.........ffffffffffff..........',
    '........ffffIffffffiff.........',
    '........ffffffffffffff.........',
    '.........ssssssssssss..........',
    '........sSsssssssssSss.........',
    '.......sSssssssssssssSs........',
    '.......sSswe.ssSsswe.Ss.......',
    '.......sSswp.ssSsswp.Ss.......',
    '.......sSksssssssssskSs........',
    '........sSsbbbbbbbSss..........',
    '........sSsbBbBbBbSss..........',
    '.........sSsssssSss............',
    '..........sSssSss..............',
    '...........ssss................',
    '.........gggttggggg............',
    '........gGggtggGgggg...........',
    '.......gGggttggGggggg..........',
    '.......ggqgggggqggggg..........',
    '.......ggggggggggggggg.........',
    '.......gGgggggggggGggg.........',
    '........ggggggggggggg..........',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

const FLORIDA_MAN_COLORS: Record<string, string> = {
  // Hair (messy)
  d: '#654321', D: '#4A2F18', j: '#7B5733',
  // Skin (tanned)
  s: '#CD853F', S: '#B5722E', k: '#9A6025', K: '#7D4E1D',
  // Eyes
  w: '#FFFFFF', e: '#4d3319', p: '#1a1008',
  // Mouth (grin)
  m: '#8B4513', W: '#FFFFFF',
  // Hawaiian shirt
  o: '#FF8C00', O: '#E07800', q: '#CC6600',
  // Shirt flowers
  f: '#FF4444', F: '#FF69B4',
  // Gold chain
  g: '#FFD700', G: '#DAA520',
};

const FLORIDA_MAN_FRAME_1: PixelGrid = {
  colors: FLORIDA_MAN_COLORS,
  grid: [
    '.........ddddddddd.............',
    '........DdddjddjddD............',
    '.......DddddddddddDd..........',
    '......DdddddddddddddD.........',
    '......DddDdddddDdddD..........',
    '......dddddddddddddd..........',
    '.......ssssssssssssss..........',
    '......sSsssssssssssSs..........',
    '.....sSssssssssssssssSs........',
    '.....sSswe.ssSsswe.sSs........',
    '.....sSswp.ssSsswp.sSs........',
    '.....sSksssssssssskSs..........',
    '......sSssssssssSss............',
    '......sSkWWWWWWskss............',
    '.......sSssmmmssSs.............',
    '........sSssssSs...............',
    '.........gggggg................',
    '........oofoofooooo............',
    '.......oOoooooOooooo...........',
    '......oOfFoooofFOooooo.........',
    '......oooooooooooooooo.........',
    '......oqoooooooooqoooo.........',
    '......oofooooooofoooo..........',
    '......oooooooooooooooo.........',
    '.......oooooooooooooo..........',
    '........ooooooooooo............',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

// Frame 2: Shirt colors shift
const FLORIDA_MAN_FRAME_2: PixelGrid = {
  colors: FLORIDA_MAN_COLORS,
  grid: [
    '.........ddddddddd.............',
    '........DdddjddjddD............',
    '.......DddddddddddDd..........',
    '......DdddddddddddddD.........',
    '......DddDdddddDdddD..........',
    '......dddddddddddddd..........',
    '.......ssssssssssssss..........',
    '......sSsssssssssssSs..........',
    '.....sSssssssssssssssSs........',
    '.....sSswe.ssSsswe.sSs........',
    '.....sSswp.ssSsswp.sSs........',
    '.....sSksssssssssskSs..........',
    '......sSssssssssSss............',
    '......sSkWWWWWWskss............',
    '.......sSssmmmssSs.............',
    '........sSssssSs...............',
    '.........gggggg................',
    '........ooFoooFoooo............',
    '.......oOoooooOooooo...........',
    '......oOoofoooofoOooooo........',
    '......oooooooooooooooo.........',
    '......oqoooooooooqoooo.........',
    '......ooFooooooFooooo..........',
    '......oooooooooooooooo.........',
    '.......oooooooooooooo..........',
    '........ooooooooooo............',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
  ],
};

// ============================================================
// ANIMATED AVATAR DATA — maps avatar type to frames + timing
// ============================================================

const ANIMATED_AVATARS: Record<AvatarType, AnimatedAvatar> = {
  hillbilly: {
    frames: [HILLBILLY_FRAME_1, HILLBILLY_FRAME_1, HILLBILLY_FRAME_1, HILLBILLY_FRAME_2, HILLBILLY_FRAME_2, HILLBILLY_FRAME_2],
    frameDelay: 500,
  },
  "mib-agent": {
    frames: [MIB_FRAME_1, MIB_FRAME_1, MIB_FRAME_1, MIB_FRAME_1, MIB_FRAME_2, MIB_FRAME_1],
    frameDelay: 400,
  },
  "sexy-lady": {
    frames: [SEXY_LADY_FRAME_1, SEXY_LADY_FRAME_1, SEXY_LADY_FRAME_1, SEXY_LADY_FRAME_1, SEXY_LADY_FRAME_2, SEXY_LADY_FRAME_1],
    frameDelay: 500,
  },
  "mad-scientist": {
    frames: [MAD_SCIENTIST_FRAME_1, MAD_SCIENTIST_FRAME_1, MAD_SCIENTIST_FRAME_2, MAD_SCIENTIST_FRAME_1],
    frameDelay: 400,
  },
  cowboy: {
    frames: [COWBOY_FRAME_1, COWBOY_FRAME_1, COWBOY_FRAME_1, COWBOY_FRAME_1, COWBOY_FRAME_2, COWBOY_FRAME_1],
    frameDelay: 600,
  },
  grandma: {
    frames: [GRANDMA_FRAME_1, GRANDMA_FRAME_2],
    frameDelay: 500,
  },
  "conspiracy-nut": {
    frames: [CONSPIRACY_FRAME_1, CONSPIRACY_FRAME_1, CONSPIRACY_FRAME_1, CONSPIRACY_FRAME_2, CONSPIRACY_FRAME_1],
    frameDelay: 350,
  },
  "florida-man": {
    frames: [FLORIDA_MAN_FRAME_1, FLORIDA_MAN_FRAME_1, FLORIDA_MAN_FRAME_2, FLORIDA_MAN_FRAME_1],
    frameDelay: 600,
  },
};

// ============================================================
// FULL-BODY AVATARS (32×48) — used in ending animation
// ============================================================

const FULL_BODY_AVATARS: Record<AvatarType, PixelGrid> = {
  hillbilly: {
    colors: HILLBILLY_COLORS,
    grid: [
      '................................',
      '..........yHHHHHHHHy...........',
      '.........yhhhhhhhhhhhy..........',
      '........yhhhhhhhhhhhhhy.........',
      '........HhhhhhhhhhhhhhH........',
      '........HhhhHHHHHhhhhhH........',
      '........HhhhhhhhhhhhhhH........',
      '.........ssssssssssssss.........',
      '........sSsssssssssssSs.........',
      '.......sSswe.sSsSswe.Ss........',
      '.......sSswp.sSsSswp.Ss........',
      '.......sSksssssssssskSs........',
      '........sSbbbbbbbbbSs..........',
      '........sSksmmmmmskSs..........',
      '.........sSssmmmssSs...........',
      '..........sSssssSs.............',
      '...........ssssss..............',
      '..........ooooooooo............',
      '.........ooOoooOoooo...........',
      '........ooOooooOooooo..........',
      '........ooooooooooooo..........',
      '........oqoooooooqooo..........',
      '........ooooooooooooo..........',
      '........ooooooooooooo..........',
      '.........ooooooooooo...........',
      '..........ooooooooo............',
      '...........oo...oo.............',
      '...........oo...oo.............',
      '..........ooo...ooo............',
      '..........kkk...kkk............',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  },
  "mib-agent": {
    colors: MIB_COLORS,
    grid: [
      '................................',
      '...........HHHHHHHH............',
      '..........HhhhhhhhHH...........',
      '.........HhhhhhhhhhhH..........',
      '........HhhhhhhhhhhhHH.........',
      '........HHHHHHHHHHHHHHH........',
      '.........ssssssssssssss.........',
      '........sSsssssssssssSs........',
      '.......sSsGGGrsSsGGGrsS........',
      '.......sSsGGGGsSsGGGGsS........',
      '.......sSksssssssssskSs........',
      '........sSssssssssSss..........',
      '.........sSssssssSs............',
      '..........ssssss...............',
      '.........bbbttbbbb.............',
      '........bbbWttWbbbbb...........',
      '.......bbBWWttWWBbbbb..........',
      '.......bBbWWttWWbBbbb..........',
      '.......bbbbbttbbbbbbb..........',
      '.......bbnbbttbbnbbbb..........',
      '.......bbbbbbbbbbbbb...........',
      '.......bbbbbbbbbbbbb...........',
      '........bbbbbbbbbbb............',
      '.........bbbbbbbbb.............',
      '..........bb...bb..............',
      '..........bb...bb..............',
      '.........bbb...bbb.............',
      '.........HHH...HHH.............',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  },
  "sexy-lady": {
    colors: SEXY_LADY_COLORS,
    grid: [
      '......aaAAAAAAAAaaaa............',
      '.....aaiaaaaaaaaaiaa............',
      '....AaiaaaaaaaaaaiaA...........',
      '...AaaaaaaaaaaaaaaAA...........',
      '...AAAAaaaaaaaaAAAAA...........',
      '....aaassssssssssaa............',
      '.......sSssssssssSs............',
      '......sSLwe.sSsLwe.Ss..........',
      '......sSswp.sSsswp.Ss..........',
      '......sSksssssssskSs...........',
      '.......sSsrrrrSss..............',
      '........sSsRRsSs...............',
      '.........sSssSs................',
      '..........ssss.................',
      '.........dddddddddd............',
      '........dDddddddDddd...........',
      '.......ddDddddDddddd...........',
      '.......ddxddddddxdddd..........',
      '.......ddddddddddddddd........',
      '.......dDdddddddddDddd........',
      '.......ddddddddddddddd........',
      '........ddddddddddddd..........',
      '.........ddddddddddd...........',
      '..........ddddddddd............',
      '...........dd...dd..............',
      '...........dd...dd..............',
      '..........ddd...ddd.............',
      '..........AAA...AAA.............',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  },
  "mad-scientist": {
    colors: MAD_SCIENTIST_COLORS,
    grid: [
      '...j.....................j......',
      '..jh..HHHHHHHHHH..hj...........',
      '.jhh.HhhhhhhhhhHH.hhj..........',
      '.hhhHHhhhhhhhhhhHHhhh..........',
      '.hhhHhhhhhhhhhhhhhHhh..........',
      '..hHHhhhhhhhhhhhhhHH...........',
      '.....ssssssssssssss............',
      '....sSssssssssssssSs...........',
      '...sSfGGGfsSsfGGGfsS...........',
      '...sSfGwGfsSsfGwGfsS...........',
      '...sSfGGGfsSsfGGGfsS...........',
      '....sSksssssssssskSs...........',
      '.....sSssssssssSss.............',
      '......sSssssssSss..............',
      '.......ssssss..................',
      '......cccccccccc...............',
      '.....cCccccccCccc..............',
      '....ccCccccccCcccc.............',
      '....ccnccccccncccc.............',
      '....cccccccccccccc.............',
      '....ccccccccccccc..............',
      '.....ccccccccccc...............',
      '......ccccccccc................',
      '.......cc...cc.................',
      '.......cc...cc.................',
      '......ccc...ccc................',
      '......HHH...HHH................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  },
  cowboy: {
    colors: COWBOY_COLORS,
    grid: [
      '..........hhhhhhhh.............',
      '.........hhhhhhhhhh............',
      '........hhdhhhhhdhhh...........',
      '.......hhhhhhhhhhhhhh..........',
      '......HhhhhhhhhhhhhhHH........',
      '.....HHHHhhhhhhhhhHHHH........',
      '....HHHHHHHHHHHHHHHHHHHH.......',
      '....HHHHHttttttttHHHHHH.......',
      '........ssssssssssss...........',
      '.......sSswe.sSswe.Ss..........',
      '.......sSswp.sSswp.Ss..........',
      '.......sSksssssssskSs..........',
      '........sSbbbbbbSss............',
      '.........sSsmmsSs..............',
      '..........ssssss...............',
      '.........nnnnnnnnn.............',
      '........rrRrrrRrrr.............',
      '.......rrRrrrrRrrrrr...........',
      '.......rrrrrrrrrrrrrr..........',
      '.......rqrrrrrrrqrrrr..........',
      '.......rrrrrrrrrrrrrr..........',
      '........rrrrrrrrrrrr...........',
      '.........rrrrrrrrrr............',
      '..........rr...rr..............',
      '..........rr...rr..............',
      '.........rrr...rrr.............',
      '.........hhh...hhh.............',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  },
  grandma: {
    colors: GRANDMA_COLORS,
    grid: [
      '.........ggggggggg.............',
      '........GgggggggggGg...........',
      '.......GgggjgggjgggGg..........',
      '......GgggggggggggggG..........',
      '......GgGg.ggggg.gGgG..........',
      '.......gsssssssssssg...........',
      '......sSfwefsSsfwefsSs..........',
      '......sSfwpfsSsfwpfsSs..........',
      '......sSksssssssssskSs..........',
      '.......sSkssnnnsskSs...........',
      '........sSssssssSs.............',
      '.........ssssss................',
      '........dddddddddd............',
      '.......dDddddddDddd...........',
      '......dDddddddddDdddd.........',
      '......dxddddddddxdddd.........',
      '......ddddddddddddddd.........',
      '......dDdddddddddDddd.........',
      '......ddddddddddddddd.........',
      '.......ddddddddddddd..........',
      '........ddddddddddd...........',
      '.........ddddddddd............',
      '..........dd...dd..............',
      '..........dd...dd..............',
      '.........ddd...ddd.............',
      '.........ggg...ggg.............',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  },
  "conspiracy-nut": {
    colors: CONSPIRACY_COLORS,
    grid: [
      '...............f................',
      '..............fff...............',
      '.............fffff..............',
      '............fFfFffF.............',
      '...........fFfffffFf............',
      '..........ffffffffff...........',
      '.........ffffffffffff..........',
      '........ffffffffffffff.........',
      '.........ssssssssssss..........',
      '........sSswe.sSswe.Ss.........',
      '........sSswp.sSswp.Ss.........',
      '........sSksssssssskSs.........',
      '.........sSsbbbbbSss...........',
      '..........sSsbBbSss............',
      '...........sSssSs..............',
      '............ssss...............',
      '..........gggttggggg...........',
      '.........gGggtggGgggg..........',
      '........gGggttggGggggg.........',
      '........ggqgggggqggggg.........',
      '........ggggggggggggggg........',
      '........gGgggggggggGggg........',
      '.........ggggggggggggg.........',
      '..........ggggggggggg..........',
      '...........gg...gg.............',
      '...........gg...gg.............',
      '..........ggg...ggg............',
      '..........kkk...kkk............',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  },
  "florida-man": {
    colors: FLORIDA_MAN_COLORS,
    grid: [
      '.........ddddddddd.............',
      '........DdddjddjddD............',
      '.......DddddddddddDd..........',
      '......DdddddddddddddD.........',
      '......DddDdddddDdddD..........',
      '.......ssssssssssssss..........',
      '......sSswe.ssSsswe.sSs........',
      '......sSswp.ssSsswp.sSs........',
      '......sSksssssssssskSs.........',
      '.......sSssssssssSss...........',
      '........sSsWWWWsSs.............',
      '.........sSsmmsSs..............',
      '..........ssssss...............',
      '.........gggggg................',
      '........oofoofooooo............',
      '.......oOoooooOooooo...........',
      '......oOfFoooofFOooooo.........',
      '......oooooooooooooooo.........',
      '......oqoooooooooqoooo.........',
      '......oofooooooofoooo..........',
      '......oooooooooooooooo.........',
      '.......oooooooooooooo..........',
      '........ooooooooooo............',
      '.........oo...oo...............',
      '.........oo...oo...............',
      '........ooo...ooo..............',
      '........kkk...kkk..............',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  },
};

// ============================================================
// COMPONENT
// ============================================================

export { FULL_BODY_AVATARS };

export function PixelAvatar({
  type,
  size = 32,
  fullBody = false,
  animated = false,
}: {
  type: AvatarType;
  size?: number;
  fullBody?: boolean;
  animated?: boolean;
}) {
  const [frame, setFrame] = useState(0);

  const animData = ANIMATED_AVATARS[type];
  const frameDelay = animData?.frameDelay || 500;

  useEffect(() => {
    if (!animated || fullBody || !animData) return;
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % animData.frames.length);
    }, frameDelay);
    return () => clearInterval(interval);
  }, [animated, fullBody, type, animData, frameDelay]);

  // Choose the grid to render
  let avatar: PixelGrid;
  if (fullBody) {
    avatar = FULL_BODY_AVATARS[type];
  } else if (animated && animData) {
    avatar = animData.frames[frame];
  } else {
    // Static: use first frame
    avatar = animData?.frames[0] || ANIMATED_AVATARS.hillbilly.frames[0];
  }

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
