import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import type { RawEvent } from "@/lib/events";
import type {
  Collected,
  LogOptions,
  RespondFn,
  Responded,
  TaskContext,
  TaskMode,
  TaskVariant,
  ViewPhase,
} from "./types";

export class TaskAbortedError extends Error {
  constructor() {
    super("Task aborted");
    this.name = "TaskAbortedError";
  }
}

/** Half a 60 Hz frame: a deadline is met on the first frame within this of it. */
const HALF_FRAME = 8;

export function createTaskContext(opts: {
  mode: TaskMode;
  variant: TaskVariant;
  form?: number;
  signal: AbortSignal;
  render: (node: ReactNode) => void;
  progress: (fraction: number) => void;
}): TaskContext {
  const { mode, variant, signal, progress } = opts;
  const t0 = performance.now();
  const events: RawEvent[] = [];

  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  function log(type: string, o: LogOptions = {}) {
    const e: RawEvent = { t: Math.round(((o.t ?? performance.now()) - t0) * 10) / 10, type };
    if (o.x != null) e.x = r3(o.x);
    if (o.y != null) e.y = r3(o.y);
    if (o.d) e.d = o.d;
    events.push(e);
  }

  // Commit synchronously so the next animation frame is guaranteed to paint it.
  const render = (node: ReactNode) => {
    if (!signal.aborted) flushSync(() => opts.render(node));
  };

  function onAbort(fn: () => void) {
    signal.addEventListener("abort", fn, { once: true });
    return () => signal.removeEventListener("abort", fn);
  }

  // Interruptions and input device are recorded for every task (validity flags).
  let hiddenAt: number | null = null;
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      hiddenAt = performance.now();
      log("visibility_hidden");
    } else if (hiddenAt != null) {
      log("visibility_visible", { d: { pausedMs: Math.round(performance.now() - hiddenAt) } });
      hiddenAt = null;
    }
  };
  const onPointer = (e: PointerEvent) => log("input_device", { t: e.timeStamp, d: { pointerType: e.pointerType } });
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onPointer, { capture: true });
    onAbort(() => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onPointer, { capture: true });
    });
  }

  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new TaskAbortedError());
      const t = setTimeout(() => {
        off();
        resolve();
      }, ms);
      const off = onAbort(() => {
        clearTimeout(t);
        reject(new TaskAbortedError());
      });
    });

  function show(node: ReactNode, durationMs: number) {
    return new Promise<{ durationMs: number; onsetPerf: number }>((resolve, reject) => {
      if (signal.aborted) return reject(new TaskAbortedError());
      let raf = 0;
      const off = onAbort(() => {
        cancelAnimationFrame(raf);
        reject(new TaskAbortedError());
      });
      render(node);
      raf = requestAnimationFrame((onset) => {
        const tick = (now: number) => {
          if (now - onset >= durationMs - HALF_FRAME) {
            off();
            resolve({ durationMs: Math.round(now - onset), onsetPerf: onset });
          } else raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
    });
  }

  /**
   * Shared response window. Onset = rAF timestamp of the frame that paints the
   * view. A per-frame loop handles the stimulus→post swap and the timeout so both
   * land on frame boundaries.
   */
  function responseWindow<R extends string>(
    view: (respond: RespondFn<R>, phase: ViewPhase) => ReactNode,
    {
      count,
      timeoutMs,
      hideAfterMs,
      fixedDuration,
    }: { count: number; timeoutMs?: number; hideAfterMs?: number; fixedDuration?: boolean },
  ) {
    return new Promise<{
      responses: { response: R; rtMs: number; tPerf: number }[];
      onset: number;
      timedOut: boolean;
      stimulusDurationMs: number | null;
    }>((resolve, reject) => {
      if (signal.aborted) return reject(new TaskAbortedError());
      let onset: number | null = null;
      let settled = false;
      let raf = 0;
      let phase: ViewPhase = "stimulus";
      let stimulusDurationMs: number | null = null;
      const responses: { response: R; rtMs: number; tPerf: number }[] = [];

      const finish = (timedOut: boolean) => {
        if (settled) return;
        settled = true;
        cancelAnimationFrame(raf);
        off();
        resolve({ responses, onset: onset ?? performance.now(), timedOut, stimulusDurationMs });
      };

      const off = onAbort(() => {
        if (settled) return;
        settled = true;
        cancelAnimationFrame(raf);
        reject(new TaskAbortedError());
      });

      const onRespond: RespondFn<R> = (response, eventTimeStamp) => {
        if (settled) return;
        const t = eventTimeStamp && eventTimeStamp > 0 ? eventTimeStamp : performance.now();
        // Input from before the stimulus was on screen, or after the window is
        // full, doesn't count — but it is logged (flagged) rather than dropped.
        if (onset === null || t < onset) return log("response", { t, d: { early: true, input: response } });
        if (responses.length >= count) return log("response", { t, d: { extra: true, input: response } });
        responses.push({ response, rtMs: Math.round(t - onset), tPerf: t });
        if (responses.length >= count && !fixedDuration) finish(false);
      };

      render(view(onRespond, "stimulus"));
      raf = requestAnimationFrame((t0) => {
        if (settled) return;
        onset = t0;
        const tick = (now: number) => {
          if (settled) return;
          const elapsed = now - (onset as number);
          if (phase === "stimulus" && hideAfterMs != null && elapsed >= hideAfterMs - HALF_FRAME) {
            phase = "post";
            stimulusDurationMs = Math.round(elapsed);
            render(view(onRespond, "post"));
          }
          if (timeoutMs != null && elapsed >= timeoutMs - HALF_FRAME) return finish(responses.length < count);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
    });
  }

  async function respond<R extends string>(
    view: (respond: RespondFn<R>, phase: ViewPhase) => ReactNode,
    options: { timeoutMs?: number; hideAfterMs?: number; fixedDuration?: boolean } = {},
  ): Promise<Responded<R>> {
    const w = await responseWindow(view, { count: 1, ...options });
    const first = w.responses[0];
    return {
      response: first?.response ?? null,
      reactionTimeMs: first?.rtMs ?? null,
      onsetPerf: w.onset,
      responsePerf: first?.tPerf ?? null,
      stimulusDurationMs: w.stimulusDurationMs,
    };
  }

  async function collect<R extends string>(
    view: (respond: RespondFn<R>) => ReactNode,
    options: { count: number; timeoutMs?: number },
  ): Promise<Collected<R>> {
    const w = await responseWindow<R>((r) => view(r), options);
    return { responses: w.responses, onsetPerf: w.onset, timedOut: w.timedOut };
  }

  return { mode, variant, form: opts.form ?? 0, signal, render, show, respond, collect, wait, progress, log, events };
}
