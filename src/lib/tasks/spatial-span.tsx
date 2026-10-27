"use client";

import { useEffect, useRef, useState } from "react";
import { Feedback } from "@/components/kid/feedback";
import { cn } from "@/lib/utils";
import { SPAN_MAX, SPAN_OFF_MS, SPAN_ON_MS, SPAN_START, SPAN_TILE_SIZE, SPAN_TILES, spanSequence, spanTileCenter } from "./protocol";
import type { RespondFn, Task } from "./types";

/**
 * Spatial span (Corsi-style, open paradigm). Nine tiles; a sequence lights up
 * and the child taps it back in order. Starts at length 2; two correct at a
 * length → length + 1; two failures at one length → stop.
 * Max span = longest sequence reproduced correctly.
 *
 * Events: seq_start {i, length, sequence (1-based tiles)} · tile_on/tile_off {i, k, tile} ·
 * response_start {i} · tap {i, tile} (x, y = tile centre) · seq_end {i, timedOut}
 */

const MAX_TRIALS = 24; // hard ceiling keeps the task under ~3 minutes

export const spatialSpan: Task = {
  id: "spatial-span",
  version: "span-1",
  name: "Firefly Path",
  domain: "working_memory",
  instructions: {
    title: "Firefly Path",
    body: "Watch the fireflies light up. Then tap them in the same order!",
    demo: "span",
  },

  async run(ctx) {
    const practice = ctx.mode === "practice";
    // Quick demo: one sequence at length 2, one at length 3, no staircase.
    const quick = ctx.variant === "quick";
    ctx.log("task_start", { d: { onMs: SPAN_ON_MS, offMs: SPAN_OFF_MS, start: SPAN_START, max: SPAN_MAX, adaptive: !practice && !quick } });

    let length = SPAN_START;
    let correctAtLength = 0;
    let failsAtLength = 0;

    for (let i = 0; i < (practice || quick ? 2 : MAX_TRIALS); i++) {
      const sequence = spanSequence(length);

      // Presentation: frame-accurate on/off for each tile.
      ctx.render(<Board label="Watch!" />);
      await ctx.wait(900);
      ctx.log("seq_start", { d: { i, length, sequence: sequence.map((t) => t + 1) } });
      for (let k = 0; k < sequence.length; k++) {
        const tile = sequence[k] + 1;
        const on = await ctx.show(<Board label="Watch!" lit={sequence[k]} />, SPAN_ON_MS);
        ctx.log("tile_on", { t: on.onsetPerf, d: { i, k, tile } });
        const off = await ctx.show(<Board label="Watch!" />, SPAN_OFF_MS);
        ctx.log("tile_off", { t: off.onsetPerf, d: { i, k, tile } });
      }

      const r = await ctx.collect<string>(
        (respond) => <Board label="Your turn!" interactive onRespond={respond} />,
        { count: length, timeoutMs: 4000 + length * 2500 },
      );
      ctx.log("response_start", { t: r.onsetPerf, d: { i } });
      for (const tap of r.responses) {
        const tile = Number(tap.response) + 1;
        ctx.log("tap", { t: tap.tPerf, ...spanTileCenter(tile), d: { i, tile } });
      }
      ctx.log("seq_end", { d: { i, timedOut: r.timedOut } });

      const correct = !r.timedOut && r.responses.every((x, k) => Number(x.response) === sequence[k]);

      if (practice) {
        ctx.progress((i + 1) / 2);
        // Let the last tap's flash finish before feedback replaces the board.
        await ctx.wait(300);
        ctx.render(<Feedback correct={correct} message={correct ? "Perfect memory!" : "Good try! Watch carefully next time."} />);
        await ctx.wait(1300);
        continue;
      }

      await ctx.wait(300);
      if (quick) {
        length++;
        ctx.progress((i + 1) / 2);
        continue;
      }
      if (correct) {
        correctAtLength++;
        if (correctAtLength === 2) {
          length++;
          correctAtLength = 0;
          failsAtLength = 0;
          if (length > SPAN_MAX) break;
        }
      } else if (++failsAtLength === 2) {
        break;
      }
      ctx.progress(Math.min(0.95, (i + 1) / 14));
    }
    ctx.progress(1);
    ctx.log("task_end");
  },
};

function Board({
  label,
  lit,
  interactive,
  onRespond,
}: {
  label: string;
  lit?: number;
  interactive?: boolean;
  onRespond?: RespondFn<string>;
}) {
  // Brief tap flash so the child sees their tap registered (not correctness feedback).
  const [flash, setFlash] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 md:gap-6">
      <p
        className={cn(
          "text-2xl font-bold tracking-tight md:text-3xl",
          interactive ? "text-primary" : "text-[var(--kid-ink)]/60",
        )}
      >
        {label}
      </p>
      <div
        className="relative aspect-square rounded-[2rem] bg-[oklch(0.33_0.04_250)] shadow-inner"
        style={{ width: "min(76vh, 92vw, 640px)" }}
      >
        {SPAN_TILES.map(([x, y], i) => {
          const on = lit === i || flash === i;
          return (
            <button
              key={i}
              type="button"
              disabled={!interactive}
              aria-label={`Firefly ${i + 1}`}
              onPointerDown={(e) => {
                if (!interactive) return;
                onRespond?.(String(i), e.timeStamp);
                setFlash(i);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => setFlash(null), 250);
              }}
              className={cn(
                "kid-press absolute rounded-2xl transition-[background-color,box-shadow] duration-75 md:rounded-3xl",
                on
                  ? "bg-[var(--kid-butter)] shadow-[0_0_32px_8px_oklch(0.93_0.12_92/0.65)]"
                  : "bg-[oklch(0.45_0.04_250)]",
                interactive && "cursor-pointer",
              )}
              style={{ left: `${x}%`, top: `${y}%`, width: `${SPAN_TILE_SIZE}%`, height: `${SPAN_TILE_SIZE}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
