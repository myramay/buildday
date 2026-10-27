/**
 * lib/norms — normative comparison. Values come only from norms.json, which may
 * contain only published norms (with citations) for the exact administration.
 * Process metrics are always "exploratory — no established norms".
 */
import type { TaskType } from "@/lib/events";
import type { Metric } from "@/lib/metrics/types";
import { normalCdf, round } from "@/lib/metrics/stats";
import NORMS_JSON from "./norms.json";

export const EXPLORATORY_NOTE = "Exploratory — no established norms.";
export const FLAG_SD = 1.5;

export type NormBand = { ageMin: number; ageMax: number; mean: number; sd: number; n: number };
export type PublishedNorm = { citation: string; administration: string; bands: NormBand[] };
export const REFERENCE_GROUPS = ["typical", "adhd", "autism"] as const;
export type ReferenceGroup = (typeof REFERENCE_GROUPS)[number];
export type TaskNorms = {
  status: "placeholder" | "published";
  note: string;
  metrics: Record<string, PublishedNorm>;
  /** Published clinical-group references, same citation policy. Display only — never used for z-scores or flags. */
  groups?: Partial<Record<Exclude<ReferenceGroup, "typical">, Record<string, PublishedNorm>>>;
};
export type NormsFile = { schema: number; policy: string; tasks: Record<string, TaskNorms> };

export type NormComparison =
  | { status: "compared"; z: number; percentile: number; flag: boolean; citation: string; band: NormBand }
  | { status: "no_band"; note: string; citation: string }
  | { status: "placeholder"; note: string }
  | { status: "exploratory"; note: string }
  | { status: "missing_value" };

export const NORMS = NORMS_JSON as NormsFile;

/** Flag when the score is more than 1.5 SD from the mean in the worse direction. */
export function isFlagged(z: number, worse: Metric["worse"]): boolean {
  if (worse === "higher") return z > FLAG_SD;
  if (worse === "lower") return z < -FLAG_SD;
  return Math.abs(z) > FLAG_SD;
}

export function compareMetric(taskType: TaskType, metric: Metric, age: number, norms: NormsFile = NORMS): NormComparison {
  if (metric.kind === "process") return { status: "exploratory", note: EXPLORATORY_NOTE };
  const task = norms.tasks[taskType];
  const entry = task?.metrics[metric.key];
  if (!entry) return { status: "placeholder", note: task?.note ?? "No norms entered for this task." };
  if (metric.value == null) return { status: "missing_value" };
  const band = entry.bands.find((b) => age >= b.ageMin && age <= b.ageMax);
  if (!band) return { status: "no_band", note: `No published band for age ${age}.`, citation: entry.citation };
  const z = (metric.value - band.mean) / band.sd;
  return {
    status: "compared",
    z: round(z, 2)!,
    percentile: round(normalCdf(z) * 100, 1)!,
    flag: isFlagged(z, metric.worse),
    citation: entry.citation,
    band,
  };
}

export type ReferenceRange = { status: "available"; band: NormBand; citation: string } | { status: "unavailable"; note: string };

/** Published reference band at the child's age for chart overlays. "typical" is the task's published norm. */
export function referenceRange(taskType: TaskType, metricKey: string, group: ReferenceGroup, age: number, norms: NormsFile = NORMS): ReferenceRange {
  const task = norms.tasks[taskType];
  const entry = group === "typical" ? task?.metrics[metricKey] : task?.groups?.[group]?.[metricKey];
  if (!entry) return { status: "unavailable", note: "No published data for this task yet." };
  const band = entry.bands.find((b) => age >= b.ageMin && age <= b.ageMax);
  if (!band) return { status: "unavailable", note: `No published band for age ${age}.` };
  return { status: "available", band, citation: entry.citation };
}

export function compareToNorms(taskType: TaskType, metrics: Metric[], age: number, norms: NormsFile = NORMS): Record<string, NormComparison> {
  return Object.fromEntries(metrics.map((m) => [m.key, compareMetric(taskType, m, age, norms)]));
}
