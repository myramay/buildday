/**
 * Pure task protocol: stimulus sequences, layouts and timing constants.
 * No React — shared by the task UIs, lib/metrics, and the seed script.
 */
import { constrainedShuffle, maxRun } from "./sequence";

/* ---------------- Go/No-Go ---------------- */

export const GNG_STIMULUS_MS = 500;
export const GNG_ISI_MIN = 1000;
export const GNG_ISI_MAX = 1500;
export const GO_SHAPES = ["circle", "square", "triangle", "heart"] as const;

export function gngSequence(total: number, nogo: number, rand: () => number = Math.random): boolean[] {
  // true = go. First two trials are go so the child settles into responding; max 2 no-go in a row.
  const base = [...Array(total - nogo).fill(true), ...Array(nogo).fill(false)] as boolean[];
  return constrainedShuffle(base, (seq) => seq[0] && seq[1] && maxNoGoRun(seq) <= 2, rand);
}

function maxNoGoRun(seq: boolean[]): number {
  let run = 0;
  let best = 0;
  for (const go of seq) {
    run = go ? 0 : run + 1;
    best = Math.max(best, run);
  }
  return best;
}

/* ---------------- Flanker ---------------- */

export const FLANKER_FIXATION_MS = 500;
export const FLANKER_TIMEOUT_MS = 3000;

export type Direction = "left" | "right";
export type FlankerCondition = "congruent" | "incongruent";
export type FlankerTrialSpec = { condition: FlankerCondition; target: Direction };

export function flankerSequence(perCell: number, rand: () => number = Math.random): FlankerTrialSpec[] {
  const cells: FlankerTrialSpec[] = [];
  for (const condition of ["congruent", "incongruent"] as const)
    for (const target of ["left", "right"] as const)
      for (let i = 0; i < perCell; i++) cells.push({ condition, target });
  return constrainedShuffle(cells, (seq) => maxRun(seq, (t) => t.target) <= 3 && maxRun(seq, (t) => t.condition) <= 3, rand);
}

/* ---------------- Spatial span ---------------- */

export const SPAN_ON_MS = 700;
export const SPAN_OFF_MS = 300;
export const SPAN_START = 2;
export const SPAN_MAX = 9;

/** Our own irregular layout (percent of board, top-left of each tile). */
export const SPAN_TILES: [number, number][] = [
  [8, 10], [44, 4], [77, 14],
  [20, 38], [57, 33], [80, 47],
  [6, 68], [41, 64], [70, 79],
];
export const SPAN_TILE_SIZE = 16;

/** 0-based tile indices, no repeats. */
export function spanSequence(length: number, rand: () => number = Math.random): number[] {
  const pool = SPAN_TILES.map((_, i) => i);
  const seq: number[] = [];
  while (seq.length < length) {
    const i = Math.floor(rand() * pool.length);
    seq.push(pool.splice(i, 1)[0]);
  }
  return seq;
}

/** Tile centre in board units (0–1), 1-based tile id. */
export function spanTileCenter(tile: number): { x: number; y: number } {
  const [x, y] = SPAN_TILES[tile - 1];
  return { x: (x + SPAN_TILE_SIZE / 2) / 100, y: (y + SPAN_TILE_SIZE / 2) / 100 };
}

/* ---------------- Trail Making ---------------- */

export type TrailPartId = "A" | "B";
export type TrailCircle = { label: string; x: number; y: number };

const LETTERS = "ABCDEFGHIJKLMNOP";

export function trailLabels(part: TrailPartId, n: number): string[] {
  return Array.from({ length: n }, (_, i) => (part === "A" ? String(i + 1) : i % 2 === 0 ? String(i / 2 + 1) : LETTERS[(i - 1) / 2]));
}

export function trailRadius(n: number) {
  return n <= 4 ? 0.07 : n <= 8 ? 0.06 : 0.048;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Alternate forms per part (fixed seeds), rotated across a patient's sessions to limit practice effects. */
export const TRAIL_FORMS = 3;

/**
 * Every form and part is constrained to the same total straight-line path
 * length (board widths, ±4%), so completion times are comparable across
 * forms and between Parts A and B.
 */
export const TRAIL_PATH_TARGET: Record<number, number> = { 4: 1.55, 8: 2.9, 15: 4.6 };
export const TRAIL_PATH_TOLERANCE = 0.04;

export function trailPathLength(circles: { x: number; y: number }[]): number {
  let L = 0;
  for (let i = 1; i < circles.length; i++) L += Math.hypot(circles[i].x - circles[i - 1].x, circles[i].y - circles[i - 1].y);
  return L;
}

/**
 * Deterministic layout for a given form (every child sees the same board for
 * that form): circles well apart, and no circle sits on the straight line
 * between two consecutive targets.
 */
export function trailLayout(part: TrailPartId, n: number, form = 0): TrailCircle[] {
  const labels = trailLabels(part, n);
  const r = trailRadius(n);
  const minDist = n <= 4 ? 0.32 : n <= 8 ? 0.22 : 0.16;
  const rand = mulberry32((part === "A" ? 101 : 202) * 1000 + n + form * 7919);
  const clear = (pts: { x: number; y: number }[], a: number, b: number) =>
    pts.every((c, k) => k === a || k === b || distToSegment(c.x, c.y, pts[a].x, pts[a].y, pts[b].x, pts[b].y) >= r * 1.6);

  for (let attempt = 0; attempt < 2000; attempt++) {
    // 1. Scatter well-separated points.
    const pts: { x: number; y: number }[] = [];
    let tries = 0;
    while (pts.length < n && tries++ < 4000) {
      const p = { x: 0.1 + rand() * 0.8, y: 0.1 + rand() * 0.8 };
      if (pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= minDist)) pts.push(p);
    }
    if (pts.length < n) continue;
    // 2. Find a visiting order where no circle sits on the line between consecutive targets.
    for (let walk = 0; walk < 200; walk++) {
      const order = [Math.floor(rand() * n)];
      const used = new Set(order);
      while (order.length < n) {
        const cur = order[order.length - 1];
        const options = pts.map((_, k) => k).filter((k) => !used.has(k) && clear(pts, cur, k));
        if (!options.length) break;
        const next = options[Math.floor(rand() * options.length)];
        order.push(next);
        used.add(next);
      }
      if (order.length < n) continue;
      const circles = order.map((k, i) => ({ label: labels[i], x: r3(pts[k].x), y: r3(pts[k].y) }));
      const target = TRAIL_PATH_TARGET[n];
      if (!target || Math.abs(trailPathLength(circles) - target) / target <= TRAIL_PATH_TOLERANCE) return circles;
    }
  }
  throw new Error(`No trail layout for ${part}${n} form ${form}`);
}

export function trailCircleCount(mode: "practice" | "real", variant: "standard" | "quick"): number {
  return mode === "practice" ? 4 : variant === "quick" ? 8 : 15;
}

/**
 * Board sizing. Browsers don't expose true physical size, so we target a fixed
 * size in nominal CSS millimetres (96 CSS px per inch). Circles are defined in
 * board units, so circle size and spacing scale with the board. The actual
 * board size, screen size and devicePixelRatio are recorded with each part.
 */
export const TRAIL_BOARD_TARGET_MM = 130;
export const CSS_PX_PER_MM = 96 / 25.4;
export const TRAIL_BOARD_TARGET_PX = Math.round(TRAIL_BOARD_TARGET_MM * CSS_PX_PER_MM);
