"use client";

import { Feedback, Fixation } from "@/components/kid/feedback";
import { NOGO_FILL, Shape, type ShapeKind } from "@/components/kid/shape";
import { useKeys } from "@/components/kid/use-keys";
import { GNG_ISI_MAX, GNG_ISI_MIN, GNG_STIMULUS_MS, GO_SHAPES, gngSequence } from "./protocol";
import { jitter } from "./sequence";
import type { RespondFn, Task, ViewPhase } from "./types";

/**
 * Go/No-Go (open paradigm). Shapes appear one at a time for 500 ms with a
 * jittered 1000–1500 ms ISI. Respond to every shape except the red star (~25%).
 * The response window runs from onset until the next stimulus (fixed SOA), so
 * late taps during the ISI still count for the current trial.
 *
 * Events: stim_on {i, shape, go, isi} · stim_off {i} · response {i, input} · trial_end {i}
 */

export const goNoGo: Task = {
  id: "go-no-go",
  version: "gng-1",
  name: "Star Stopper",
  domain: "inhibition",
  instructions: {
    title: "Star Stopper",
    body: "Tap the screen (or press space) for every shape — but NOT the red star!",
    demo: "go-no-go",
  },

  async run(ctx) {
    const practice = ctx.mode === "practice";
    const quick = ctx.variant === "quick";
    // Quick demo: 8 trials (2 no-go), same 25% ratio and timing.
    const total = practice || quick ? 8 : 40;
    const seq = gngSequence(total, practice || quick ? 2 : 10);
    ctx.log("task_start", { d: { trials: total, stimulusMs: GNG_STIMULUS_MS, isiMin: GNG_ISI_MIN, isiMax: GNG_ISI_MAX } });

    ctx.render(<Fixation />);
    await ctx.wait(1000);

    let lastShape: ShapeKind | null = null;
    for (let i = 0; i < total; i++) {
      const go = seq[i];
      const shape: ShapeKind = go ? pick<ShapeKind>(GO_SHAPES.filter((s) => s !== lastShape)) : "star";
      lastShape = shape;
      const isi = jitter(GNG_ISI_MIN, GNG_ISI_MAX);

      const r = await ctx.respond<"touch" | "space">(
        (respond, phase) => <GngView shape={shape} phase={phase} onRespond={respond} />,
        { hideAfterMs: GNG_STIMULUS_MS, timeoutMs: GNG_STIMULUS_MS + isi, fixedDuration: true },
      );
      ctx.log("stim_on", { t: r.onsetPerf, d: { i, shape, go, isi } });
      if (r.stimulusDurationMs != null) ctx.log("stim_off", { t: r.onsetPerf + r.stimulusDurationMs, d: { i } });
      if (r.responsePerf != null) ctx.log("response", { t: r.responsePerf, d: { i, input: r.response } });
      ctx.log("trial_end", { d: { i } });
      ctx.progress((i + 1) / total);

      if (practice) {
        const responded = r.response !== null;
        const ok = go === responded;
        ctx.render(
          <Feedback
            correct={ok}
            message={go ? (responded ? "Great tap!" : "Tap a little faster!") : responded ? "Oops! Don't tap the red star." : "Nice stop — you didn't tap the red star!"}
          />,
        );
        await ctx.wait(1100);
        ctx.render(<Fixation />);
        await ctx.wait(600);
      }
    }
    ctx.log("task_end");
  },
};

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}

function GngView({ shape, phase, onRespond }: { shape: ShapeKind; phase: ViewPhase; onRespond: RespondFn<"touch" | "space"> }) {
  useKeys([" "], (_, t) => onRespond("space", t));
  return (
    // The whole stage is the response target.
    <div
      className="kid-press flex h-full items-center justify-center"
      onPointerDown={(e) => onRespond("touch", e.timeStamp)}
      role="button"
      aria-label="Tap for any shape except the red star"
    >
      {phase === "stimulus" ? (
        <Shape kind={shape} fill={shape === "star" ? NOGO_FILL : undefined} className="size-44 md:size-56" />
      ) : (
        <div className="size-3 rounded-full bg-[var(--kid-ink)]/25" />
      )}
    </div>
  );
}
