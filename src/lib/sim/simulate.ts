/**
 * Synthetic raw-event generators for fictional sample data (seed script, tests).
 * Emits the same event vocabulary as the live tasks, so metrics are computed
 * by exactly the same code path. Parameters are simulation settings, not norms.
 */
import type { RawEvent } from "@/lib/events";
import {
  GNG_ISI_MAX,
  GNG_ISI_MIN,
  GNG_STIMULUS_MS,
  GO_SHAPES,
  SPAN_MAX,
  SPAN_OFF_MS,
  SPAN_ON_MS,
  SPAN_START,
  TRAIL_BOARD_TARGET_MM,
  flankerSequence,
  gngSequence,
  spanSequence,
  spanTileCenter,
  trailLayout,
  trailRadius,
} from "@/lib/tasks/protocol";

export type Rand = () => number;

export function mulberry32(seed: number): Rand {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rand: Rand, mean: number, sd: number) {
  const z = Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
  return mean + z * sd;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

/* ---------------- Trail Making ---------------- */

export type TrailSimParams = {
  /** Drawing speed, board widths per second. */
  speedA: number;
  speedB: number;
  /** Mean dwell before leaving a circle (ms). */
  dwell: number;
  pauseA: number;
  pauseB: number;
  /** Extra pause probability before letter targets in Part B. */
  letterPause: number;
  errorA: number;
  errorB: number;
  /** Proportional slow-down by the end of a part. */
  fatigue: number;
  startLatency: number;
  /** Probability of lifting the finger at a circle. */
  liftRate: number;
  pointerType: "touch" | "mouse" | "pen";
};

export function trailSimBase(age: number): TrailSimParams {
  return {
    speedA: 0.3 + 0.025 * (age - 6),
    speedB: 0.26 + 0.022 * (age - 6),
    dwell: 320 - 15 * (age - 6),
    pauseA: 0.06,
    pauseB: 0.12,
    letterPause: 0.1,
    errorA: 0.01,
    errorB: 0.05,
    fatigue: 0.08,
    startLatency: 900,
    liftRate: 0.1,
    pointerType: "touch",
  };
}

export function simulateTrail(rand: Rand, p: TrailSimParams, opts: { n: number; form: number; boardMm?: number }): RawEvent[] {
  const events: RawEvent[] = [{ t: 0, type: "task_start", d: { circlesPerPart: opts.n, form: opts.form } }];
  let t = 1500;
  for (const part of ["A", "B"] as const) {
    if (part === "B") t += 5000; // Part B intro screen
    const circles = trailLayout(part, opts.n, opts.form);
    const radius = trailRadius(opts.n);
    const speed = part === "A" ? p.speedA : p.speedB;
    const boardMm = opts.boardMm ?? TRAIL_BOARD_TARGET_MM;
    events.push({
      t,
      type: "part_start",
      d: { part, n: opts.n, form: opts.form, radius, circles, boardPx: Math.round(boardMm * 3.78), boardMm, targetMm: TRAIL_BOARD_TARGET_MM, dpr: 2, viewport: [1180, 820] },
    });
    const ev = (type: string, x?: number, y?: number, d?: Record<string, unknown>) =>
      events.push({ t: r1(t), type, ...(x != null && { x: r3(x) }), ...(y != null && { y: r3(y) }), d: { part, ...d } });

    t += p.startLatency * (0.7 + rand() * 0.6);
    let pos = { x: circles[0].x + normal(rand, 0, 0.01), y: circles[0].y + normal(rand, 0, 0.01) };
    ev("pointer_down", pos.x, pos.y, { pointerType: p.pointerType });
    ev("connect", pos.x, pos.y, { index: 0 });
    let down = true;
    const inside = (q: { x: number; y: number }, c: { x: number; y: number }) => Math.hypot(q.x - c.x, q.y - c.y) <= radius;

    // Curved stroke; fires `onEnter` the first time the pointer enters `target`.
    const strokeTo = (to: { x: number; y: number }, slow: number, target?: { x: number; y: number }, onEnter?: () => void) => {
      if (!down) {
        ev("pointer_down", pos.x, pos.y, { pointerType: p.pointerType });
        down = true;
      }
      const from = pos;
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const dur = Math.max(250, (dist / speed) * 1000 * slow * (0.85 + rand() * 0.35));
      const bend = normal(rand, 0, 0.05) * dist;
      const nx = -(to.y - from.y) / (dist || 1);
      const ny = (to.x - from.x) / (dist || 1);
      const cx = (from.x + to.x) / 2 + nx * bend;
      const cy = (from.y + to.y) / 2 + ny * bend;
      const t0 = t;
      let entered = false;
      const steps = Math.ceil(dur / 16);
      for (let k = 1; k <= steps; k++) {
        const u = k / steps;
        const e = u * u * (3 - 2 * u);
        const x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * cx + e * e * to.x + normal(rand, 0, 0.0015);
        const y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * cy + e * e * to.y + normal(rand, 0, 0.0015);
        t = t0 + u * dur;
        ev("pointer_move", x, y);
        if (target && onEnter && !entered && inside({ x, y }, target)) {
          entered = true;
          onEnter();
        }
      }
      pos = to;
    };

    for (let i = 1; i < opts.n; i++) {
      const target = circles[i];
      const isLetter = /[A-Z]/.test(target.label);
      const slow = 1 + p.fatigue * (i / opts.n);
      t += Math.max(60, normal(rand, p.dwell, p.dwell * 0.3)) * slow;
      ev("pointer_move", pos.x + normal(rand, 0, 0.003), pos.y + normal(rand, 0, 0.003));
      if (rand() < p.liftRate) {
        ev("pointer_up", pos.x, pos.y);
        down = false;
      }
      const pauseP = (part === "A" ? p.pauseA : p.pauseB) + (part === "B" && isLetter ? p.letterPause : 0);
      if (rand() < pauseP) {
        t += 550 + rand() * 1100 * slow;
        if (down) ev("pointer_move", pos.x + normal(rand, 0, 0.003), pos.y + normal(rand, 0, 0.003));
      }
      if (i < opts.n - 1 && rand() < (part === "A" ? p.errorA : p.errorB)) {
        const wrongIdx = Math.min(opts.n - 1, i + 1 + (rand() < 0.3 ? 1 : 0));
        const wrong = circles[wrongIdx];
        strokeTo(wrong, slow, wrong, () => ev("error", pos.x, pos.y, { expected: i, touched: wrongIdx }));
        t += 400 + rand() * 500; // notices the red flash
        const back = circles[i - 1];
        strokeTo({ x: back.x, y: back.y }, slow, back, () => ev("return", back.x, back.y, { index: i - 1 }));
      }
      let connected = false;
      strokeTo({ x: target.x + normal(rand, 0, 0.012), y: target.y + normal(rand, 0, 0.012) }, slow, target, () => {
        connected = true;
        ev("connect", target.x, target.y, { index: i });
      });
      if (!connected) ev("connect", target.x, target.y, { index: i });
    }
    events.push({ t: r1(t), type: "part_end", d: { part } });
    ev("pointer_up", pos.x, pos.y);
    t += 600;
  }
  events.push({ t: r1(t), type: "task_end" });
  return events;
}

/* ---------------- Go/No-Go ---------------- */

export type GngSimParams = { rtMean: number; rtSdFrac: number; omission: number; commission: number };

export const gngSimBase = (age: number): GngSimParams => ({
  rtMean: 540 - 18 * (age - 6),
  rtSdFrac: 0.2,
  omission: 0.02,
  commission: Math.max(0.05, 0.26 - 0.025 * (age - 6)),
});

export function simulateGoNoGo(rand: Rand, p: GngSimParams, total = 40, nogo = 10): RawEvent[] {
  const seq = gngSequence(total, nogo, rand);
  const events: RawEvent[] = [{ t: 0, type: "task_start", d: { trials: total } }];
  let t = 1000;
  seq.forEach((go, i) => {
    const isi = Math.round(GNG_ISI_MIN + rand() * (GNG_ISI_MAX - GNG_ISI_MIN));
    events.push({ t: r1(t), type: "stim_on", d: { i, shape: go ? GO_SHAPES[Math.floor(rand() * GO_SHAPES.length)] : "star", go, isi } });
    events.push({ t: r1(t + GNG_STIMULUS_MS), type: "stim_off", d: { i } });
    const responded = go ? rand() >= p.omission : rand() < p.commission;
    if (responded) {
      const rt = Math.max(180, normal(rand, p.rtMean * (go ? 1 : 0.85), p.rtMean * p.rtSdFrac));
      events.push({ t: r1(t + rt), type: "response", d: { i, input: "touch" } });
    }
    t += GNG_STIMULUS_MS + isi;
    events.push({ t: r1(t), type: "trial_end", d: { i } });
  });
  events.push({ t: r1(t), type: "task_end" });
  return events.sort((a, b) => a.t - b.t);
}

/* ---------------- Flanker ---------------- */

export type FlankerSimParams = { congRt: number; effect: number; sdFrac: number; accC: number; accI: number; omission: number };

export const flankerSimBase = (age: number): FlankerSimParams => ({
  congRt: 900 - 50 * (age - 6),
  effect: 85 - 5 * (age - 6),
  sdFrac: 0.18,
  accC: 0.97,
  accI: 0.92,
  omission: 0.01,
});

export function simulateFlanker(rand: Rand, p: FlankerSimParams, perCell = 8): RawEvent[] {
  const events: RawEvent[] = [{ t: 0, type: "task_start", d: {} }];
  let t = 0;
  flankerSequence(perCell, rand).forEach(({ condition, target }, i) => {
    t += 600 + rand() * 300;
    events.push({ t: r1(t), type: "fixation_on", d: { i } });
    t += 500;
    const inc = condition === "incongruent";
    const other = target === "left" ? "right" : "left";
    events.push({ t: r1(t), type: "stim_on", d: { i, condition, target, flankers: inc ? other : target } });
    if (rand() < p.omission) {
      t += 3000;
      events.push({ t: r1(t), type: "timeout", d: { i } });
      return;
    }
    const base = p.congRt + (inc ? p.effect : 0);
    const rt = Math.max(250, normal(rand, base, base * p.sdFrac));
    const correct = rand() < (inc ? p.accI : p.accC);
    t += rt;
    events.push({ t: r1(t), type: "response", d: { i, dir: correct ? target : other } });
  });
  events.push({ t: r1(t + 200), type: "task_end" });
  return events;
}

/* ---------------- Spatial span ---------------- */

export type SpanSimParams = { capacity: number; tapGap: number };

export const spanSimBase = (age: number): SpanSimParams => ({ capacity: 3.9 + 0.3 * (age - 6), tapGap: 480 });

export function simulateSpan(rand: Rand, p: SpanSimParams): RawEvent[] {
  const events: RawEvent[] = [{ t: 0, type: "task_start", d: { adaptive: true } }];
  let t = 0;
  let length = SPAN_START;
  let ok = 0;
  let fails = 0;
  for (let i = 0; i < 24; i++) {
    const seq = spanSequence(length, rand).map((x) => x + 1);
    t += 900;
    events.push({ t: r1(t), type: "seq_start", d: { i, length, sequence: seq } });
    seq.forEach((tile, k) => {
      events.push({ t: r1(t), type: "tile_on", d: { i, k, tile } });
      t += SPAN_ON_MS;
      events.push({ t: r1(t), type: "tile_off", d: { i, k, tile } });
      t += SPAN_OFF_MS;
    });
    events.push({ t: r1(t), type: "response_start", d: { i } });
    const correct = rand() < 1 / (1 + Math.exp((length - p.capacity) * 2.2));
    const tapped = [...seq];
    if (!correct) {
      const k = Math.floor(rand() * (length - 1));
      if (rand() < 0.6) [tapped[k], tapped[k + 1]] = [tapped[k + 1], tapped[k]];
      else tapped[length - 1] = (tapped[length - 1] % 9) + 1;
    }
    t += Math.max(300, normal(rand, 950, 180));
    tapped.forEach((tile, k) => {
      events.push({ t: r1(t), type: "tap", ...spanTileCenter(tile), d: { i, tile } });
      t += Math.max(200, normal(rand, p.tapGap + (length > 4 ? 70 * Math.max(0, k - 2) : 0), 120));
    });
    events.push({ t: r1(t), type: "seq_end", d: { i, timedOut: false } });
    t += 300;
    if (correct) {
      if (++ok === 2) {
        length++;
        ok = 0;
        fails = 0;
        if (length > SPAN_MAX) break;
      }
    } else if (++fails === 2) break;
  }
  events.push({ t: r1(t), type: "task_end" });
  return events;
}
