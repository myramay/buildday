/**
 * FICTIONAL demo reference ranges for the trend-chart overlays (Typical / ADHD / Autism).
 * Simulated children from src/lib/sim, scored by lib/metrics. The group differences
 * below are made-up parameter shifts for demos, not findings. Never used for z-scores or flags.
 *
 * Writes src/lib/norms/demo-references.json. Deterministic (seeded).
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import type { RawEvent, TaskType } from "@/lib/events";
import { computeMetrics } from "@/lib/metrics";
import { mean, round, sd } from "@/lib/metrics/stats";
import { REFERENCE_GROUPS, type NormBand, type ReferenceGroup } from "@/lib/norms";
import {
  flankerSimBase,
  gngSimBase,
  mulberry32,
  simulateFlanker,
  simulateGoNoGo,
  simulateSpan,
  simulateTrail,
  spanSimBase,
  trailSimBase,
  type FlankerSimParams,
  type GngSimParams,
  type Rand,
  type SpanSimParams,
  type TrailSimParams,
} from "@/lib/sim/simulate";
import { TRAIL_FORMS } from "@/lib/tasks/protocol";

const AGE_BANDS = [
  [5, 6],
  [7, 8],
  [9, 10],
  [11, 13],
] as const;
const KIDS_PER_AGE = 30;
/** Between-child variability: each numeric parameter is scaled by up to ±20%. */
const SPREAD = 0.2;
const PROBABILITIES = new Set(["pauseA", "pauseB", "letterPause", "errorA", "errorB", "liftRate", "omission", "commission", "accC", "accI"]);

type Params = { trail: TrailSimParams; gng: GngSimParams; flanker: FlankerSimParams; span: SpanSimParams };

const base = (age: number): Params => ({ trail: trailSimBase(age), gng: gngSimBase(age), flanker: flankerSimBase(age), span: spanSimBase(age) });

/** Made-up group shifts (not findings): roughly the direction often reported, with heavy overlap. */
const GROUPS: Record<ReferenceGroup, (p: Params) => Params> = {
  typical: (p) => p,
  adhd: (p) => ({
    trail: { ...p.trail, speedB: p.trail.speedB * 0.95, pauseA: p.trail.pauseA * 1.2, pauseB: p.trail.pauseB * 1.25, errorA: p.trail.errorA * 1.5, errorB: p.trail.errorB * 1.4, fatigue: p.trail.fatigue + 0.06 },
    gng: { ...p.gng, rtMean: p.gng.rtMean + 20, rtSdFrac: 0.24, omission: 0.04, commission: p.gng.commission * 1.25 },
    flanker: { ...p.flanker, effect: p.flanker.effect + 30, sdFrac: 0.24, accC: p.flanker.accC - 0.02, accI: p.flanker.accI - 0.05, omission: 0.02 },
    span: { ...p.span, capacity: p.span.capacity - 0.3 },
  }),
  autism: (p) => ({
    trail: { ...p.trail, speedA: p.trail.speedA * 0.96, speedB: p.trail.speedB * 0.93, pauseB: p.trail.pauseB * 1.15, letterPause: p.trail.letterPause * 1.3, errorB: p.trail.errorB * 1.15 },
    gng: { ...p.gng, rtMean: p.gng.rtMean + 35, rtSdFrac: 0.22, commission: p.gng.commission * 1.1 },
    flanker: { ...p.flanker, congRt: p.flanker.congRt + 60, effect: p.flanker.effect + 15, accI: p.flanker.accI - 0.03 },
    span: { ...p.span, capacity: p.span.capacity - 0.2 },
  }),
};

/** One simulated child's parameters: the group profile with individual variation. */
function vary<T extends object>(rand: Rand, p: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (typeof v !== "number") out[k] = v;
    else {
      const x = v * (1 + (rand() * 2 - 1) * SPREAD);
      out[k] = PROBABILITIES.has(k) ? Math.min(0.99, Math.max(0, x)) : x;
    }
  }
  return out as T;
}

type GroupData = Partial<Record<TaskType, Record<string, NormBand[]>>>;

function main() {
  const groups = {} as Record<ReferenceGroup, GroupData>;
  let seed = 1;
  for (const group of REFERENCE_GROUPS) {
    // values[task][metric][band] = one value per simulated child
    const values: Partial<Record<TaskType, Record<string, number[][]>>> = {};
    for (const [b, [lo, hi]] of AGE_BANDS.entries()) {
      for (let age = lo; age <= hi; age++) {
        for (let k = 0; k < KIDS_PER_AGE; k++) {
          const rand = mulberry32(seed++ * 7919);
          const p = GROUPS[group](base(age));
          const streams: [TaskType, string, RawEvent[]][] = [
            ["trail-making", "tmt-1", simulateTrail(rand, vary(rand, p.trail), { n: 15, form: k % TRAIL_FORMS })],
            ["go-no-go", "gng-1", simulateGoNoGo(rand, vary(rand, p.gng))],
            ["flanker", "flanker-1", simulateFlanker(rand, vary(rand, p.flanker))],
            ["spatial-span", "span-1", simulateSpan(rand, vary(rand, p.span))],
          ];
          for (const [task, version, events] of streams) {
            for (const m of computeMetrics(task, events, { taskVersion: version, inputType: "touch" }).metrics) {
              if (m.kind !== "score" || m.value == null) continue;
              const byBand = ((values[task] ??= {})[m.key] ??= AGE_BANDS.map(() => []));
              byBand[b].push(m.value);
            }
          }
        }
      }
    }
    groups[group] = Object.fromEntries(
      Object.entries(values).map(([task, metrics]) => [
        task,
        Object.fromEntries(
          Object.entries(metrics).map(([key, byBand]) => [
            key,
            byBand.map((xs, b) => ({ ageMin: AGE_BANDS[b][0], ageMax: AGE_BANDS[b][1], mean: round(mean(xs), 3)!, sd: round(sd(xs), 3)!, n: xs.length })),
          ]),
        ),
      ]),
    );
  }

  const file = path.join(process.cwd(), "src/lib/norms/demo-references.json");
  const out = {
    fictional: true,
    note: "FICTIONAL DEMO DATA. Simulated children with made-up group differences — not real typical, ADHD or autism data. Chart overlays only; never used for z-scores or flags. Regenerate with `npm run demo:references`.",
    groups,
  };
  writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), file)} (${REFERENCE_GROUPS.length} groups × ${AGE_BANDS.length} age bands, ${KIDS_PER_AGE} simulated kids per age).`);
}

main();
