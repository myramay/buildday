import type { RawEvent } from "@/lib/events";
import { interruptionFlag, usedMouse } from "./shared";
import { mean, round, slowing, thirds } from "./stats";
import {
  HESITATION_EPS,
  HESITATION_MS,
  INACTIVITY_MS,
  type Hesitation,
  type Metric,
  type MetricsContext,
  type SegmentTiming,
  type TaskMetrics,
  type ThirdsPoint,
  type ValidityFlag,
} from "./types";

type Circle = { label: string; x: number; y: number };
type PartId = "A" | "B";

export type TrailPartData = {
  part: PartId;
  onset: number;
  end: number;
  circles: Circle[];
  radius: number;
  form: number;
  boardMm: number | null;
  targetMm: number | null;
  /** pointer samples: [t (ms from part onset), x, y, down] */
  samples: [number, number, number, boolean][];
  connects: number[];
  errors: { t: number; expected: number; touched: number; x?: number; y?: number }[];
  lifts: number;
  pointerTypes: string[];
};

/** Group the raw stream into parts. Times become ms from each part's onset. */
export function trailParts(events: RawEvent[]): TrailPartData[] {
  const out: TrailPartData[] = [];
  for (const id of ["A", "B"] as const) {
    const ev = events.filter((e) => e.d?.part === id).sort((a, b) => a.t - b.t);
    const start = ev.find((e) => e.type === "part_start");
    const end = ev.find((e) => e.type === "part_end");
    if (!start || !end) continue;
    const d = start.d!;
    const rel = (t: number) => round(t - start.t, 1)!;
    const samples: TrailPartData["samples"] = [];
    let down = false;
    let lifts = 0;
    const pointerTypes = new Set<string>();
    for (const e of ev) {
      if (e.x == null || e.y == null) continue;
      if (e.type === "pointer_down") {
        down = true;
        if (typeof e.d?.pointerType === "string") pointerTypes.add(e.d.pointerType);
      }
      if (e.type === "pointer_up") {
        if (down && e.t < end.t) lifts++;
        down = false;
      }
      if (e.type.startsWith("pointer_")) samples.push([rel(e.t), e.x, e.y, e.type === "pointer_up" ? false : down]);
    }
    out.push({
      part: id,
      onset: start.t,
      end: rel(end.t),
      circles: d.circles as Circle[],
      radius: d.radius as number,
      form: (d.form as number) ?? 0,
      boardMm: (d.boardMm as number) ?? null,
      targetMm: (d.targetMm as number) ?? null,
      samples,
      connects: ev.filter((e) => e.type === "connect").map((e) => rel(e.t)),
      errors: ev
        .filter((e) => e.type === "error")
        .map((e) => ({ t: rel(e.t), expected: e.d!.expected as number, touched: e.d!.touched as number, x: e.x, y: e.y })),
      lifts,
      pointerTypes: [...pointerTypes],
    });
  }
  return out;
}

/**
 * Hesitation = ≥ 500 ms during which the pointer stays within HESITATION_EPS of
 * where it was (held still or lifted — a lifted finger produces no samples, so a
 * gap counts as no movement), between first touch and completion.
 */
export function trailHesitations(p: TrailPartData): Hesitation[] {
  const out: Hesitation[] = [];
  const first = p.samples.find((s) => s[3]);
  if (!first) return out;
  const s = p.samples.filter(([t]) => t >= first[0] && t <= p.end);
  let anchor = s[0];
  for (let i = 1; i <= s.length; i++) {
    const cur = s[i];
    if (cur && Math.hypot(cur[1] - anchor[1], cur[2] - anchor[2]) <= HESITATION_EPS) continue;
    const endT = cur ? cur[0] : p.end;
    if (endT - anchor[0] >= HESITATION_MS) {
      const reached = p.connects.filter((c) => c <= anchor[0]).length;
      const target = p.circles[Math.min(reached, p.circles.length - 1)];
      const prev = reached > 0 ? p.circles[reached - 1] : null;
      out.push({
        part: p.part,
        startMs: anchor[0],
        durationMs: round(endT - anchor[0])!,
        x: anchor[1],
        y: anchor[2],
        location: prev ? `${prev.label}→${target.label}` : `before ${target.label}`,
        beforeLetter: /[A-Z]/.test(target.label),
      });
    }
    if (cur) anchor = cur;
  }
  return out;
}

export type TrailPartMetrics = {
  completionMs: number;
  errors: number;
  firstTouchMs: number | null;
  segments: number[];
  hesitations: Hesitation[];
  pathEfficiency: number | null;
  recoveryMs: number | null;
  thirds: { first: number; last: number } | null;
  lifts: number;
  longestGapMs: number;
};

export function trailPartMetrics(p: TrailPartData): TrailPartMetrics {
  const segments = p.connects.slice(1).map((t, i) => round(t - p.connects[i], 1)!);
  let drawn = 0;
  for (let i = 1; i < p.samples.length; i++) {
    const a = p.samples[i - 1];
    const b = p.samples[i];
    if (a[3] && b[3] && b[0] <= p.end) drawn += Math.hypot(b[1] - a[1], b[2] - a[2]);
  }
  let ideal = 0;
  for (let i = 1; i < p.circles.length; i++) ideal += Math.hypot(p.circles[i].x - p.circles[i - 1].x, p.circles[i].y - p.circles[i - 1].y);
  const recovery = p.errors.map((e) => p.connects.find((c) => c > e.t)).flatMap((c, i) => (c == null ? [] : [c - p.errors[i].t]));
  const firstDown = p.samples.find((s) => s[3]);
  // Longest stretch with no pointer activity at all (including onset → first touch).
  const times = [0, ...p.samples.map((s) => s[0]).filter((t) => t <= p.end), p.end];
  let longestGapMs = 0;
  for (let i = 1; i < times.length; i++) longestGapMs = Math.max(longestGapMs, times[i] - times[i - 1]);
  return {
    completionMs: p.end,
    errors: p.errors.length,
    firstTouchMs: firstDown ? firstDown[0] : null,
    segments,
    hesitations: trailHesitations(p),
    pathEfficiency: drawn > 0 ? round(Math.min(1, ideal / drawn), 3) : null,
    recoveryMs: round(mean(recovery)),
    thirds: thirds(segments),
    lifts: p.lifts,
    longestGapMs: round(longestGapMs)!,
  };
}

/**
 * Hesitations per letter-target segment ÷ hesitations per number-target segment
 * (Part B alternates, so a raw count before letters is confounded by base rate).
 */
function letterHesitationRatio(p: TrailPartData, m: TrailPartMetrics): number | null {
  const letters = p.circles.filter((c) => /[A-Z]/.test(c.label)).length;
  const numbers = p.circles.length - letters;
  const hL = m.hesitations.filter((h) => h.beforeLetter).length;
  const hN = m.hesitations.length - hL;
  return letters && numbers && hN ? round(hL / letters / (hN / numbers), 2) : null;
}

export function computeTrail(events: RawEvent[], ctx: MetricsContext): TaskMetrics {
  const parts = trailParts(events);
  const by = Object.fromEntries(parts.map((p) => [p.part, { data: p, m: trailPartMetrics(p) }])) as Partial<
    Record<PartId, { data: TrailPartData; m: TrailPartMetrics }>
  >;
  const A = by.A?.m;
  const B = by.B?.m;

  const metric = (key: string, label: string, value: number | null, unit: Metric["unit"], kind: Metric["kind"], worse?: Metric["worse"], na?: string): Metric => ({
    key,
    label,
    value,
    unit,
    kind,
    ...(worse && { worse }),
    ...(value == null && na && { na }),
  });

  const hes = [...(A?.hesitations ?? []), ...(B?.hesitations ?? [])];
  const metrics: Metric[] = [
    metric("timeA", "Part A time", A?.completionMs ?? null, "ms", "score", "higher"),
    metric("timeB", "Part B time", B?.completionMs ?? null, "ms", "score", "higher"),
    metric("errorsA", "Part A errors", A?.errors ?? null, "count", "score", "higher"),
    metric("errorsB", "Part B errors", B?.errors ?? null, "count", "score", "higher"),
    metric("diffBA", "B − A", A && B ? round(B.completionMs - A.completionMs) : null, "ms", "score", "higher"),
    metric("ratioBA", "B / A", A && B && A.completionMs > 0 ? round(B.completionMs / A.completionMs, 2) : null, "ratio", "score", "higher"),
    metric("ttfrA", "Time to first touch (A)", A?.firstTouchMs ?? null, "ms", "process"),
    metric("ttfrB", "Time to first touch (B)", B?.firstTouchMs ?? null, "ms", "process"),
    metric("hesitations", "Hesitations (count)", hes.length, "count", "process"),
    metric("hesitationMs", "Hesitations (total time)", round(hes.reduce((s, h) => s + h.durationMs, 0)), "ms", "process"),
    metric("letterHesitationRatio", "Part B hesitation rate, letter ÷ number targets", by.B ? letterHesitationRatio(by.B.data, by.B.m) : null, "ratio", "process", undefined, "no hesitations before numbers"),
    metric("recoveryMs", "Error recovery time", round(mean([A?.recoveryMs, B?.recoveryMs].filter((v): v is number => v != null))), "ms", "process", undefined, "no errors"),
    metric("slowingA", "Slowing first→last third (A)", slowing(A?.thirds ?? null), "fraction", "process", undefined, "too few segments"),
    metric("slowingB", "Slowing first→last third (B)", slowing(B?.thirds ?? null), "fraction", "process", undefined, "too few segments"),
    metric("pathEfficiencyA", "Path efficiency (A)", A?.pathEfficiency ?? null, "fraction", "process"),
    metric("pathEfficiencyB", "Path efficiency (B)", B?.pathEfficiency ?? null, "fraction", "process"),
    metric("liftsA", "Pen lifts (A)", A?.lifts ?? null, "count", "process"),
    metric("liftsB", "Pen lifts (B)", B?.lifts ?? null, "count", "process"),
  ];

  // Validity heuristics (not norms): data-quality checks on the administration itself.
  const validity: ValidityFlag[] = [];
  for (const p of parts) {
    const m = by[p.part]!.m;
    const fastSegs = m.segments.filter((ms) => ms < 150).length;
    if (fastSegs >= 3)
      validity.push({ code: "too_fast", label: "Implausibly fast", detail: `Part ${p.part}: ${fastSegs} segments under 150 ms.` });
    if (m.longestGapMs > INACTIVITY_MS)
      validity.push({ code: "inactivity", label: "Inactivity > 10 s", detail: `Part ${p.part}: no input for ${(m.longestGapMs / 1000).toFixed(1)} s.` });
    if (m.lifts > p.circles.length)
      validity.push({ code: "pen_lifts", label: "Excessive pen lifts", detail: `Part ${p.part}: ${m.lifts} lifts for ${p.circles.length} circles.` });
    if (p.boardMm != null && p.targetMm != null && p.boardMm < p.targetMm * 0.85)
      validity.push({ code: "small_board", label: "Board smaller than standard", detail: `Part ${p.part}: ${p.boardMm} mm vs ${p.targetMm} mm target (nominal).` });
  }
  if (usedMouse(events, ctx.inputType))
    validity.push({ code: "mouse_input", label: "Mouse input", detail: "Drawn with a mouse; timing and path are not comparable to touch/pen." });
  validity.push(...interruptionFlag(events));

  const segmentsChart: SegmentTiming[] = parts.flatMap((p) => {
    const m = by[p.part]!.m;
    return m.segments.map((ms, i) => {
      const t0 = p.connects[i];
      const t1 = p.connects[i + 1];
      return {
        part: p.part,
        label: `${p.circles[i].label}→${p.circles[i + 1].label}`,
        ms,
        errors: p.errors.filter((e) => e.t > t0 && e.t <= t1).length,
        hesitations: m.hesitations.filter((h) => h.startMs >= t0 && h.startMs < t1).length,
      };
    });
  });
  const thirdsChart: ThirdsPoint[] = parts.flatMap((p) => {
    const t = by[p.part]!.m.thirds;
    return t ? [{ label: `Part ${p.part}`, firstMs: round(t.first)!, lastMs: round(t.last)! }] : [];
  });

  return {
    taskType: "trail-making",
    metricsVersion: "",
    taskVersion: ctx.taskVersion,
    form: parts[0]?.form,
    metrics,
    validity,
    charts: { segments: segmentsChart, thirds: thirdsChart, hesitations: hes },
  };
}
