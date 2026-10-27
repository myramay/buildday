import type { ReactNode } from "react";
import type { RawEvent, TaskType } from "@/lib/events";

export type Domain = "attention" | "inhibition" | "working_memory" | "motor" | "processing_speed";

export type TaskMode = "practice" | "real";
export type TaskVariant = "standard" | "quick";

export type TaskInstructions = {
  /** Short kid-facing headline. */
  title: string;
  /** One or two short sentences a 6-year-old can follow (read aloud by a parent if needed). */
  body: string;
  /** Which looping animation the instruction screen plays. */
  demo: "go-no-go" | "flanker" | "span" | "trail";
};

/** Responses carry the input event's `timeStamp` (same clock as performance.now()) when available. */
export type RespondFn<R extends string> = (response: R, eventTimeStamp?: number) => void;

/** `stimulus` until `hideAfterMs` has elapsed, then `post` (e.g. the ISI) while still accepting input. */
export type ViewPhase = "stimulus" | "post";

export type RespondOptions = {
  /** Window closes as "no response" this many ms after onset. Omit to wait indefinitely. */
  timeoutMs?: number;
  /** Swap the view to its `post` phase this many ms after onset (frame-accurate). */
  hideAfterMs?: number;
  /** Keep the window open until `timeoutMs` even after a response (fixed SOA). Later responses are ignored. */
  fixedDuration?: boolean;
};

export type Responded<R extends string = string> = {
  response: R | null;
  reactionTimeMs: number | null;
  /** Onset and response on the performance clock — pass to ctx.log({ t }). */
  onsetPerf: number;
  responsePerf: number | null;
  /** Measured on-screen duration of the stimulus phase when `hideAfterMs` was used. */
  stimulusDurationMs: number | null;
};

export type Collected<R extends string = string> = {
  responses: { response: R; rtMs: number; tPerf: number }[];
  onsetPerf: number;
  timedOut: boolean;
};

export type LogOptions = {
  /** Performance-clock time of the event (defaults to now). */
  t?: number;
  x?: number;
  y?: number;
  d?: Record<string, unknown>;
};

/**
 * Handed to a task's `run()` by the runner. Tasks drive their own trial loop
 * imperatively, render through `ctx`, and record what happens with `ctx.log` —
 * the event stream is what gets stored and scored.
 *
 * Timing model: `render` commits synchronously; onset is the requestAnimationFrame
 * timestamp of the frame that paints the change; responses use the input event's
 * own timeStamp. Input arriving before onset is ignored.
 */
export type TaskContext = {
  mode: TaskMode;
  /** "quick" = shortened demo administration (fewer items, no practice). */
  variant: TaskVariant;
  /** Alternate-form index assigned by the server (rotates across a patient's sessions). */
  form: number;
  signal: AbortSignal;
  render(node: ReactNode): void;
  show(node: ReactNode, durationMs: number): Promise<{ durationMs: number; onsetPerf: number }>;
  respond<R extends string>(
    view: (respond: RespondFn<R>, phase: ViewPhase) => ReactNode,
    options?: RespondOptions,
  ): Promise<Responded<R>>;
  collect<R extends string>(
    view: (respond: RespondFn<R>) => ReactNode,
    options: { count: number; timeoutMs?: number },
  ): Promise<Collected<R>>;
  wait(ms: number): Promise<void>;
  progress(fraction: number): void;
  /** Append a raw event. Times are converted to ms from the start of this phase. */
  log(type: string, opts?: LogOptions): void;
  /** Events recorded so far (read by the runner when the task finishes). */
  readonly events: RawEvent[];
};

export type Task = {
  id: TaskType;
  /** Protocol version recorded with the raw events (bump when stimuli/timing change). */
  version: string;
  name: string;
  domain: Domain;
  instructions: TaskInstructions;
  run(ctx: TaskContext): Promise<void>;
};
