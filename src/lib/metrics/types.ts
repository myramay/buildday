import type { TaskType } from "@/lib/events";

/**
 * Bump on any change to a metric's definition or computation. Stored with every
 * TaskResult so results computed by different versions are never silently mixed.
 */
export const METRICS_VERSION = "1.1.0";

export type MetricUnit = "ms" | "count" | "ratio" | "fraction" | "items";

export type Metric = {
  key: string;
  label: string;
  value: number | null;
  unit: MetricUnit;
  /**
   * score   = conventional task score
   * process = process measure — exploratory, no established norms
   */
  kind: "score" | "process";
  /** Which direction is worse, for norm flags (only used when a published norm exists). */
  worse?: "higher" | "lower";
  /** Why the value is missing, when it is. */
  na?: string;
};

export type ValidityCode = "too_fast" | "inactivity" | "pen_lifts" | "mouse_input" | "small_board" | "interrupted";

export type ValidityFlag = {
  code: ValidityCode;
  label: string;
  detail: string;
};

export type Hesitation = {
  part?: "A" | "B";
  /** ms from part/task onset */
  startMs: number;
  durationMs: number;
  x?: number;
  y?: number;
  /** e.g. "3→C" (segment being attempted) or "seq 4 · item 3" */
  location: string;
  /** Part B: the target being sought was a letter. */
  beforeLetter?: boolean;
  /** Spatial span: index of the sequence the pause happened in. */
  trial?: number;
};

export type SegmentTiming = { part?: "A" | "B"; label: string; ms: number; errors: number; hesitations: number };
export type ThirdsPoint = { label: string; firstMs: number; lastMs: number };
export type TrialPoint = { i: number; rtMs: number | null; correct: boolean; kind: string };

export type TaskMetrics = {
  taskType: TaskType;
  metricsVersion: string;
  /** Task protocol version from the raw events (e.g. "tmt-1"). */
  taskVersion: string;
  /** Alternate form used, where the task has forms. */
  form?: number;
  metrics: Metric[];
  validity: ValidityFlag[];
  charts: {
    segments?: SegmentTiming[];
    thirds?: ThirdsPoint[];
    trials?: TrialPoint[];
    hesitations?: Hesitation[];
  };
};

export type MetricsContext = {
  taskVersion: string;
  /** Session-level input type ("touch" | "mouse" | "pen" | "unknown"). */
  inputType?: string;
};

export const INACTIVITY_MS = 10_000;
export const HESITATION_MS = 500;
/** "Near-zero movement" for Trail Making: within 2% of the board width. */
export const HESITATION_EPS = 0.02;
/** Responses faster than this are anticipations, not reactions to the stimulus. */
export const ANTICIPATION_MS = 150;
/** Go/No-Go hits slower than this are counted but excluded from mean/SD RT. */
export const SLOW_RESPONSE_MS = 1500;
/** Post-error RT change needs at least this many post-error trials. */
export const MIN_POST_ERROR_TRIALS = 3;
