"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Feedback } from "@/components/kid/feedback";
import { Fish, type Direction } from "@/components/kid/fish";
import { useKeys } from "@/components/kid/use-keys";
import { cn } from "@/lib/utils";
import { FLANKER_FIXATION_MS, FLANKER_TIMEOUT_MS, flankerSequence } from "./protocol";
import { jitter } from "./sequence";
import type { RespondFn, Task } from "./types";

/**
 * Flanker (open paradigm, child "fish" variant). Five fish in a row; respond to
 * the direction of the middle fish. Congruent: flankers match. Incongruent:
 * flankers face the other way. 50/50, balanced for direction.
 *
 * Events: fixation_on {i} · stim_on {i, condition, target, flankers} · response {i, dir} · timeout {i}
 */

const flip = (d: Direction): Direction => (d === "left" ? "right" : "left");

export const flanker: Task = {
  id: "flanker",
  version: "flanker-1",
  name: "Fish Friends",
  domain: "attention",
  instructions: {
    title: "Fish Friends",
    body: "Which way is the MIDDLE fish swimming? Tap the arrow (or use the arrow keys).",
    demo: "flanker",
  },

  async run(ctx) {
    const practice = ctx.mode === "practice";
    // Practice and quick demo: 6 mixed trials. Real: 32 trials, 8 per condition × direction.
    const seq = practice || ctx.variant === "quick" ? flankerSequence(2).slice(0, 6) : flankerSequence(8);
    ctx.log("task_start", { d: { trials: seq.length, fixationMs: FLANKER_FIXATION_MS, timeoutMs: FLANKER_TIMEOUT_MS } });

    for (let i = 0; i < seq.length; i++) {
      const { condition, target } = seq[i];
      const flankers = condition === "congruent" ? target : flip(target);

      ctx.render(<FlankerStage />);
      await ctx.wait(jitter(600, 900));
      const fix = await ctx.show(<FlankerStage fixation />, FLANKER_FIXATION_MS);
      ctx.log("fixation_on", { t: fix.onsetPerf, d: { i } });

      const r = await ctx.respond<Direction>(
        (respond) => <FlankerStage target={target} flankers={flankers} onRespond={respond} />,
        { timeoutMs: FLANKER_TIMEOUT_MS },
      );
      ctx.log("stim_on", { t: r.onsetPerf, d: { i, condition, target, flankers } });
      if (r.responsePerf != null) ctx.log("response", { t: r.responsePerf, d: { i, dir: r.response } });
      else ctx.log("timeout", { d: { i } });
      ctx.progress((i + 1) / seq.length);

      if (practice) {
        const correct = r.response === target;
        ctx.render(
          <Feedback
            correct={correct}
            message={
              r.response === null
                ? "Try to answer a little faster!"
                : correct
                  ? `Yes! The middle fish swims ${target}.`
                  : `Look at the middle fish — it swims ${target}.`
            }
          />,
        );
        await ctx.wait(1300);
      }
    }
    ctx.log("task_end");
  },
};

function FlankerStage({
  target,
  flankers,
  fixation,
  onRespond,
}: {
  target?: Direction;
  flankers?: Direction;
  fixation?: boolean;
  onRespond?: RespondFn<Direction>;
}) {
  useKeys(["ArrowLeft", "ArrowRight"], (key, t) =>
    onRespond?.(key === "ArrowLeft" ? "left" : "right", t),
  );
  const active = !!onRespond;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center">
        {target && flankers ? (
          <div className="flex items-center gap-1 md:gap-3">
            {[flankers, flankers, target, flankers, flankers].map((d, i) => (
              <Fish key={i} direction={d} />
            ))}
          </div>
        ) : fixation ? (
          <span className="text-5xl font-light text-[var(--kid-ink)]/50">+</span>
        ) : null}
      </div>
      {/* Buttons stay mounted (and in place) for the whole task, only live during the response window. */}
      <div className="flex justify-between gap-6 px-6 pb-8 md:px-16 md:pb-12">
        {(["left", "right"] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            aria-label={`Middle fish swims ${dir}`}
            onPointerDown={(e) => onRespond?.(dir, e.timeStamp)}
            className={cn(
              "kid-press flex h-24 w-36 items-center justify-center rounded-[1.75rem] bg-white shadow-[0_4px_0_0_rgba(0,0,0,0.08)] ring-1 ring-black/5 transition-opacity md:h-28 md:w-48",
              !active && "opacity-60",
            )}
          >
            {dir === "left" ? <ArrowLeft className="size-12" strokeWidth={2.5} /> : <ArrowRight className="size-12" strokeWidth={2.5} />}
          </button>
        ))}
      </div>
    </div>
  );
}
