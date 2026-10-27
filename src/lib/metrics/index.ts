/**
 * lib/metrics — pure, versioned metric computation from raw events.
 * No React, no DOM, no I/O: runs identically in the browser, the API and tests.
 */
import type { RawEvent, TaskType } from "@/lib/events";
import { computeFlanker, computeGoNoGo } from "./rt-tasks";
import { computeSpan } from "./span";
import { computeTrail } from "./trail";
import { METRICS_VERSION, type MetricsContext, type TaskMetrics } from "./types";

export * from "./types";
export { trailHesitations, trailParts, trailPartMetrics, type TrailPartData } from "./trail";

const COMPUTE: Record<TaskType, (events: RawEvent[], ctx: MetricsContext) => TaskMetrics> = {
  "trail-making": computeTrail,
  "go-no-go": computeGoNoGo,
  flanker: computeFlanker,
  "spatial-span": computeSpan,
};

export function computeMetrics(taskType: TaskType, events: RawEvent[], ctx: MetricsContext): TaskMetrics {
  return { ...COMPUTE[taskType](events, ctx), metricsVersion: METRICS_VERSION };
}
