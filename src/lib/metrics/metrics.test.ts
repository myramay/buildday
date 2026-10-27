import { describe, expect, it } from "vitest";
import type { RawEvent } from "@/lib/events";
import { computeMetrics, METRICS_VERSION, type TaskMetrics } from "@/lib/metrics";
import { mulberry32, simulateFlanker, simulateGoNoGo, simulateSpan, simulateTrail, trailSimBase } from "@/lib/sim/simulate";
import { TRAIL_PATH_TARGET, TRAIL_PATH_TOLERANCE, trailLayout, trailPathLength } from "@/lib/tasks/protocol";

const val = (m: TaskMetrics, key: string) => m.metrics.find((x) => x.key === key)?.value;
const ctx = { taskVersion: "test", inputType: "touch" };

/** Hand-built Trail Making part: 4 circles, known timings, one 800 ms stationary pause, one error. */
function handTrail(): RawEvent[] {
  const A = trailLayout("A", 4, 0);
  const B = trailLayout("B", 4, 0);
  const ev: RawEvent[] = [{ t: 0, type: "task_start" }];
  const part = (id: "A" | "B", circles: typeof A, t0: number, segMs: number, withError: boolean) => {
    const d = (x: Record<string, unknown> = {}) => ({ part: id, ...x });
    ev.push({ t: t0, type: "part_start", d: d({ n: 4, radius: 0.07, circles, form: 0, boardMm: 130, targetMm: 130 }) });
    let t = t0 + 500;
    ev.push({ t, type: "pointer_down", x: circles[0].x, y: circles[0].y, d: d({ pointerType: "touch" }) });
    ev.push({ t, type: "connect", d: d({ index: 0 }) });
    for (let i = 1; i < 4; i++) {
      if (i === 2) {
        // Hold still for 800 ms at circle 2 → one hesitation.
        t += 800;
        ev.push({ t, type: "pointer_move", x: circles[1].x + 0.001, y: circles[1].y, d: d() });
      }
      if (withError && i === 2) ev.push({ t: t + 50, type: "error", x: circles[3].x, y: circles[3].y, d: d({ expected: 2, touched: 3 }) });
      // Straight line in 10 steps
      for (let k = 1; k <= 10; k++) {
        const u = k / 10;
        ev.push({
          t: t + (segMs * k) / 10,
          type: "pointer_move",
          x: circles[i - 1].x + (circles[i].x - circles[i - 1].x) * u,
          y: circles[i - 1].y + (circles[i].y - circles[i - 1].y) * u,
          d: d(),
        });
      }
      t += segMs;
      ev.push({ t, type: "connect", d: d({ index: i }) });
    }
    ev.push({ t, type: "part_end", d: d() });
    ev.push({ t: t + 10, type: "pointer_up", x: circles[3].x, y: circles[3].y, d: d() });
    return t;
  };
  const endA = part("A", A, 1000, 400, false);
  part("B", B, endA + 2000, 800, true);
  return ev;
}

describe("trail making metrics", () => {
  it("computes times, B−A, B/A, errors, hesitations and efficiency from raw events", () => {
    const m = computeMetrics("trail-making", handTrail(), ctx);
    expect(m.metricsVersion).toBe(METRICS_VERSION);
    // A: 500 ms to first touch + 800 ms pause + 3 × 400 ms = 2500 ms
    expect(val(m, "timeA")).toBe(2500);
    // B: 500 + 800 + 3 × 800 = 3700 ms
    expect(val(m, "timeB")).toBe(3700);
    expect(val(m, "diffBA")).toBe(1200);
    expect(val(m, "ratioBA")).toBe(1.48);
    expect(val(m, "errorsA")).toBe(0);
    expect(val(m, "errorsB")).toBe(1);
    expect(val(m, "ttfrA")).toBe(500);
    // One 800 ms stationary pause per part.
    expect(val(m, "hesitations")).toBe(2);
    expect(m.charts.hesitations?.map((h) => [h.part, h.location])).toEqual([
      ["A", "2→3"],
      ["B", "A→2"],
    ]);
    expect(m.charts.hesitations?.every((h) => h.durationMs >= 800)).toBe(true);
    // Straight-line drawing → efficiency ≈ 1.
    expect(val(m, "pathEfficiencyA")).toBeGreaterThan(0.97);
    expect(m.charts.segments).toHaveLength(6);
    expect(m.validity).toEqual([]);
  });

  it("flags mouse input, excessive lifts and inactivity", () => {
    const ev = handTrail().map((e) => (e.type === "pointer_down" ? { ...e, d: { ...e.d, pointerType: "mouse" } } : e));
    // 6 extra lifts in Part A (> 4 circles) and a 12 s silence before the end.
    const startA = ev.find((e) => e.type === "part_start")!;
    for (let k = 0; k < 6; k++) {
      ev.push({ t: startA.t + 600 + 2 * k, type: "pointer_up", x: 0.5, y: 0.5, d: { part: "A" } });
      ev.push({ t: startA.t + 601 + 2 * k, type: "pointer_down", x: 0.5, y: 0.5, d: { part: "A", pointerType: "mouse" } });
    }
    const endA = ev.find((e) => e.type === "part_end" && e.d?.part === "A")!;
    endA.t += 12_000;
    const m = computeMetrics("trail-making", ev, ctx);
    const codes = m.validity.map((v) => v.code);
    expect(codes).toContain("mouse_input");
    expect(codes).toContain("pen_lifts");
    expect(codes).toContain("inactivity");
  });

  it("handles simulated full sessions (15 circles) for every alternate form", () => {
    for (const form of [0, 1, 2]) {
      const m = computeMetrics("trail-making", simulateTrail(mulberry32(form + 1), trailSimBase(9), { n: 15, form }), ctx);
      expect(m.form).toBe(form);
      expect(m.charts.segments).toHaveLength(28);
      expect(val(m, "ratioBA")).toBeGreaterThan(1);
    }
  });
});

describe("trail layouts", () => {
  it("every part × size × form generates, with matched path length", () => {
    for (const part of ["A", "B"] as const)
      for (const n of [4, 8, 15])
        for (const form of [0, 1, 2]) {
          const c = trailLayout(part, n, form);
          expect(c).toHaveLength(n);
          expect(Math.abs(trailPathLength(c) - TRAIL_PATH_TARGET[n]) / TRAIL_PATH_TARGET[n]).toBeLessThanOrEqual(TRAIL_PATH_TOLERANCE);
        }
  });

  it("forms differ from each other", () => {
    expect(trailLayout("A", 15, 0)).not.toEqual(trailLayout("A", 15, 1));
  });
});

describe("rt tasks", () => {
  it("go/no-go: hits, omissions, commissions, RT", () => {
    const ev: RawEvent[] = [
      { t: 0, type: "stim_on", d: { i: 0, go: true } },
      { t: 400, type: "response", d: { i: 0 } },
      { t: 2000, type: "stim_on", d: { i: 1, go: true } },
      { t: 2600, type: "response", d: { i: 1 } },
      { t: 4000, type: "stim_on", d: { i: 2, go: false } },
      { t: 4300, type: "response", d: { i: 2 } },
      { t: 6000, type: "stim_on", d: { i: 3, go: true } },
      { t: 8000, type: "stim_on", d: { i: 4, go: false } },
      { t: 9500, type: "task_end" },
    ];
    const m = computeMetrics("go-no-go", ev, ctx);
    expect(val(m, "hits")).toBe(2);
    expect(val(m, "omissions")).toBe(1);
    expect(val(m, "commissions")).toBe(1);
    expect(val(m, "meanRt")).toBe(500);
    expect(val(m, "ttfr")).toBe(400);
  });

  it("flanker: accuracy per condition and flanker effect", () => {
    const ev: RawEvent[] = [];
    let t = 0;
    for (let i = 0; i < 8; i++) {
      const inc = i % 2 === 1;
      ev.push({ t, type: "stim_on", d: { i, condition: inc ? "incongruent" : "congruent", target: "left" } });
      ev.push({ t: t + (inc ? 700 : 600), type: "response", d: { i, dir: i === 7 ? "right" : "left" } });
      t += 2000;
    }
    const m = computeMetrics("flanker", ev, ctx);
    expect(val(m, "rtCongruent")).toBe(600);
    expect(val(m, "rtIncongruent")).toBe(700);
    expect(val(m, "flankerEffect")).toBe(100);
    expect(val(m, "accIncongruent")).toBe(0.75);
    expect(val(m, "errors")).toBe(1);
  });

  it("flags anticipatory responding", () => {
    const ev: RawEvent[] = [];
    for (let i = 0; i < 10; i++) {
      ev.push({ t: i * 1700, type: "stim_on", d: { i, go: true } });
      ev.push({ t: i * 1700 + (i < 4 ? 90 : 450), type: "response", d: { i } });
    }
    expect(computeMetrics("go-no-go", ev, ctx).validity.map((v) => v.code)).toContain("too_fast");
  });

  it("simulated go/no-go has the configured structure", () => {
    const m = computeMetrics("go-no-go", simulateGoNoGo(mulberry32(3), { rtMean: 450, rtSdFrac: 0.1, omission: 0, commission: 0 }), ctx);
    expect(val(m, "goTrials")).toBe(30);
    expect(val(m, "nogoTrials")).toBe(10);
    expect(val(m, "commissions")).toBe(0);
  });

  it("simulated flanker has the configured effect direction", () => {
    const m = computeMetrics("flanker", simulateFlanker(mulberry32(5), { congRt: 700, effect: 150, sdFrac: 0.05, accC: 1, accI: 1, omission: 0 }), ctx);
    expect(val(m, "flankerEffect")!).toBeGreaterThan(100);
  });
});

describe("spatial span", () => {
  it("scores sequences from taps and finds inter-tap pauses", () => {
    const ev: RawEvent[] = [
      { t: 0, type: "seq_start", d: { i: 0, length: 2, sequence: [3, 7] } },
      { t: 2000, type: "response_start", d: { i: 0 } },
      { t: 2900, type: "tap", d: { i: 0, tile: 3 } },
      { t: 3300, type: "tap", d: { i: 0, tile: 7 } },
      { t: 3400, type: "seq_end", d: { i: 0, timedOut: false } },
      { t: 4000, type: "seq_start", d: { i: 1, length: 3, sequence: [1, 2, 3] } },
      { t: 7000, type: "response_start", d: { i: 1 } },
      { t: 8000, type: "tap", d: { i: 1, tile: 1 } },
      { t: 8900, type: "tap", d: { i: 1, tile: 3 } },
      { t: 9300, type: "tap", d: { i: 1, tile: 2 } },
      { t: 9400, type: "seq_end", d: { i: 1, timedOut: false } },
    ];
    const m = computeMetrics("spatial-span", ev, ctx);
    expect(val(m, "maxSpan")).toBe(2);
    expect(val(m, "sequencesCorrect")).toBe(1);
    expect(val(m, "hesitations")).toBe(1); // 900 ms gap in sequence 2
    expect(val(m, "ttfr")).toBe(900);
  });

  it("runs on a simulated adaptive session", () => {
    const m = computeMetrics("spatial-span", simulateSpan(mulberry32(9), { capacity: 5, tapGap: 500 }), ctx);
    expect(val(m, "maxSpan")!).toBeGreaterThanOrEqual(2);
  });
});
