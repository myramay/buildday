/**
 * Raw event stream — the source of truth for every task. Metrics (lib/metrics)
 * are computed only from these, so they can be recomputed when the metric
 * definitions change.
 *
 * `t` is milliseconds from the start of the task phase on the high-resolution
 * clock (performance.now()). `x`/`y` are normalized to the task's board (0–1)
 * when the event has a position.
 */
export type RawEvent = {
  t: number;
  type: string;
  x?: number;
  y?: number;
  d?: Record<string, unknown>;
};

export const TASK_TYPES = ["trail-making", "go-no-go", "flanker", "spatial-span"] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_LABELS: Record<TaskType, string> = {
  "trail-making": "Trail Making (A/B)",
  "go-no-go": "Go/No-Go",
  flanker: "Flanker",
  "spatial-span": "Spatial span (Corsi-style)",
};

export function isTaskType(v: unknown): v is TaskType {
  return typeof v === "string" && (TASK_TYPES as readonly string[]).includes(v);
}
