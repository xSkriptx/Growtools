export const ST2 = [
  [255, 0, 0, 8], [248, 1, 0, 5], [31, 2, 0, 5], [214, 3, 0, 5], [107, 4, 0, 5],
  [208, 5, 0, 3], [104, 6, 0, 3], [22, 7, 0, 3], [11, 0, 1, 3], [66, 1, 1, 2],
  [64, 2, 1, 1], [2, 3, 1, 1], [0, 4, 1, 0], [254, 5, 1, 7], [251, 6, 1, 7],
  [223, 7, 1, 7], [127, 0, 2, 7], [250, 1, 2, 6], [95, 2, 2, 6], [222, 3, 2, 6],
  [123, 4, 2, 6], [126, 5, 2, 6], [219, 6, 2, 6], [91, 7, 2, 5], [94, 0, 3, 5],
  [122, 1, 3, 5], [218, 2, 3, 5], [90, 3, 3, 4], [24, 4, 3, 2], [16, 5, 3, 1],
  [8, 6, 3, 1], [210, 7, 3, 4], [86, 0, 4, 4], [82, 1, 4, 3], [106, 2, 4, 4],
  [75, 3, 4, 4], [74, 4, 4, 3], [120, 6, 4, 4], [88, 7, 4, 3], [30, 0, 5, 4],
  [27, 1, 5, 4], [26, 2, 5, 3], [18, 3, 5, 2], [10, 4, 5, 2], [80, 5, 5, 2], [72, 6, 5, 2],
];

export const ST5 = [
  [255, 0, 0, 8], [248, 1, 0, 5], [31, 2, 0, 5], [214, 3, 0, 5], [107, 4, 0, 5],
  [208, 5, 0, 3], [104, 6, 0, 3], [22, 7, 0, 3], [11, 0, 1, 3], [66, 1, 1, 2],
  [64, 2, 1, 1], [2, 3, 1, 1], [0, 4, 1, 0], [24, 5, 1, 2], [16, 6, 1, 1], [8, 7, 1, 1],
];

export const ST14 = [[24, 1, 0, 2], [16, 0, 0, 1], [8, 2, 0, 1], [0, 3, 0, 0]];

const AUTOTILE_EDGE: Record<number, number> = { 2: 10, 8: 10, 16: 10, 64: 10 };
const HORIZ_BITS = new Set([8, 16]);
const VERT_BITS = new Set([2, 64]);
const DIAG_BITS = new Set([1, 4, 32, 128]);

export function scoreRule(activeMask: number, reqMask: number): number {
  let s = 0;
  for (let b = 1; b <= 128; b <<= 1) {
    const w = AUTOTILE_EDGE[b] || 1;
    const inRule = reqMask & b;
    const inActive = activeMask & b;
    if (inRule) {
      s += inActive ? w : -w * 2;
    } else if (inActive) {
      s -= w;
    }
  }
  return s;
}

export function bestAutotile(rules: number[][], activeMask: number, isolX: number, isolY: number): [number, number] {
  let bc = isolX;
  let br = isolY;
  let bs = -Infinity;
  for (let i = 0; i < rules.length; i++) {
    const [req, c, r] = rules[i];
    if (req === 0) continue;
    const s = scoreRule(activeMask, req);
    if (s > bs) {
      bs = s;
      bc = c;
      br = r;
    }
  }
  return bs > 0 ? [bc, br] : [isolX, isolY];
}

export function bestAutotileAxis(rules: number[][], activeMask: number, isolC: number, isolR: number): [number, number] {
  let bc = isolC;
  let br = isolR;
  let bs = -Infinity;
  for (let i = 0; i < rules.length; i++) {
    const [req, c, r] = rules[i];
    if (req === 0) continue;
    
    let hasH = false;
    let hasV = false;
    let hasD = false;
    if ((req & 8) || (req & 16)) hasH = true;
    if ((req & 2) || (req & 64)) hasV = true;
    if ((req & 1) || (req & 4) || (req & 32) || (req & 128)) hasD = true;

    let s = 0;
    for (let b = 1; b <= 128; b <<= 1) {
      const w = AUTOTILE_EDGE[b] || 1;
      if (req & b) {
        s += (activeMask & b) ? w : -w * 2;
      } else if (activeMask & b) {
        if (HORIZ_BITS.has(b) && !hasH) continue;
        if (VERT_BITS.has(b) && !hasV) continue;
        if (DIAG_BITS.has(b) && !hasD) continue;
        s -= w;
      }
    }
    if (s > bs) {
      bs = s;
      bc = c;
      br = r;
    }
  }
  return bs > 0 ? [bc, br] : [isolC, isolR];
}
