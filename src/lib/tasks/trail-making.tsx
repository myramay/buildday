"use client";

import { useEffect, useRef, useState } from "react";
import { Feedback } from "@/components/kid/feedback";
import { KidButton } from "@/components/kid/kid-button";
import { cn } from "@/lib/utils";
import { CSS_PX_PER_MM, TRAIL_BOARD_TARGET_MM, TRAIL_BOARD_TARGET_PX, trailCircleCount, trailLayout, trailRadius, type TrailCircle, type TrailPartId } from "./protocol";
import type { LogOptions, Task, TaskContext } from "./types";

/**
 * Trail Making (open paradigm; the original 1944 test is public domain).
 * Part A: connect 1 → 2 → 3 …  Part B: alternate numbers and letters 1 → A → 2 → B …
 * The child draws with a finger, pen or mouse. Entering the wrong circle is an
 * error: it flashes, the line back to the last correct circle is erased, and
 * the child must return to that circle before continuing (as an examiner
 * would correct on paper).
 *
 * Events: part_start {part, n, radius, circles} · pointer_down / pointer_move / pointer_up (x, y) ·
 * connect {part, index} · error {part, expected, touched} (x, y) · return {part, index} · part_end {part}
 */

export const trailMaking: Task = {
  id: "trail-making",
  version: "tmt-1",
  name: "Dot Trails",
  domain: "processing_speed",
  instructions: {
    title: "Dot Trails",
    body: "Draw a line from 1 to 2 to 3, in order, as fast as you can. Try to keep your finger down!",
    demo: "trail",
  },

  async run(ctx) {
    const practice = ctx.mode === "practice";
    const n = trailCircleCount(ctx.mode, ctx.variant);
    // Practice always uses form 0; test parts use the assigned alternate form.
    const form = practice ? 0 : ctx.form;
    ctx.log("task_start", { d: { circlesPerPart: n, form } });

    for (const part of ["A", "B"] as const) {
      if (part === "B") await ctx.respond<"go">((respond) => <PartBIntro onGo={() => respond("go")} />);
      const errors = await runPart(ctx, part, n, form);
      ctx.progress(part === "A" ? 0.5 : 1);
      if (practice) {
        ctx.render(<Feedback correct={errors === 0} message={errors === 0 ? "Great job!" : "Nice! Remember to go in order."} />);
        await ctx.wait(1300);
      }
    }
    ctx.log("task_end");
  },
};

/** Runs one part; returns the number of errors (for practice feedback only). */
async function runPart(ctx: TaskContext, part: TrailPartId, n: number, form: number): Promise<number> {
  const circles = trailLayout(part, n, form);
  const radius = trailRadius(n);
  let errors = 0;
  const log = (type: string, o: LogOptions) => {
    if (type === "error") errors++;
    ctx.log(type, { ...o, d: { part, ...o.d } });
  };
  let boardPx = 0;
  const r = await ctx.respond<"done">((respond) => (
    <TrailBoard
      circles={circles}
      radius={radius}
      part={part}
      log={log}
      onSize={(px) => (boardPx = px)}
      onDone={(t) => respond("done", t)}
    />
  ));
  ctx.log("part_start", {
    t: r.onsetPerf,
    d: {
      part,
      n,
      form,
      radius,
      circles,
      boardPx: Math.round(boardPx),
      boardMm: Math.round(boardPx / CSS_PX_PER_MM),
      targetMm: TRAIL_BOARD_TARGET_MM,
      dpr: window.devicePixelRatio,
      viewport: [window.innerWidth, window.innerHeight],
    },
  });
  ctx.log("part_end", { t: r.responsePerf ?? undefined, d: { part } });
  // Hold the finished board briefly so the child sees the last connection land.
  await ctx.wait(500);
  return errors;
}

/* ---------------- Kid-facing screens ---------------- */

function PartBIntro({ onGo }: { onGo: () => void }) {
  const seq = ["1", "A", "2", "B", "3", "C"];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--kid-ink)]/50">Part 2</p>
      <h2 className="kid-pop text-4xl font-bold tracking-tight md:text-5xl">Now switch back and forth!</h2>
      <p className="max-w-lg text-xl text-[var(--kid-ink)]/75 text-balance md:text-2xl">Go number, letter, number, letter — in order.</p>
      <div className="flex flex-wrap items-center justify-center gap-2 text-2xl font-bold">
        {seq.map((l, i) => (
          <span key={l} className="flex items-center gap-2">
            <span className={cn("flex size-14 items-center justify-center rounded-full border-[3px] border-[var(--kid-ink)] bg-white", i % 2 && "bg-[var(--kid-sky)]")}>
              {l}
            </span>
            {i < seq.length - 1 && <span className="text-[var(--kid-ink)]/40">→</span>}
          </span>
        ))}
        <span className="text-[var(--kid-ink)]/40">…</span>
      </div>
      <KidButton lockMs={1200} onClick={onGo}>
        Start!
      </KidButton>
    </div>
  );
}

function TrailBoard({
  part,
  circles,
  radius,
  log,
  onSize,
  onDone,
}: {
  part: TrailPartId;
  circles: TrailCircle[];
  radius: number;
  log: (type: string, o: LogOptions) => void;
  onSize: (boardPx: number) => void;
  onDone: (eventTimeStamp: number) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef<SVGPathElement>(null);
  const currentRef = useRef<SVGPathElement>(null);
  const live = useRef({ committed: "", current: "", down: false, connected: 0, needsReturn: false, inside: -1, done: false });
  const [connected, setConnected] = useState(0);
  const [errorAt, setErrorAt] = useState<number | null>(null);
  const [needsReturn, setNeedsReturn] = useState(false);

  useEffect(() => {
    if (boardRef.current) onSize(boardRef.current.getBoundingClientRect().width);
  }, [onSize]);

  useEffect(() => {
    if (errorAt == null) return;
    const t = setTimeout(() => setErrorAt(null), 600);
    return () => clearTimeout(t);
  }, [errorAt]);

  const point = (e: { clientX: number; clientY: number }) => {
    const rect = boardRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  };

  const redraw = () => {
    committedRef.current?.setAttribute("d", live.current.committed);
    currentRef.current?.setAttribute("d", live.current.current);
  };

  const hitTest = (x: number, y: number, t: number) => {
    const L = live.current;
    const idx = circles.findIndex((c) => Math.hypot(c.x - x, c.y - y) <= radius);
    if (idx === L.inside) return;
    L.inside = idx;
    if (idx === -1) return;

    if (L.needsReturn) {
      if (idx === L.connected - 1) {
        L.needsReturn = false;
        setNeedsReturn(false);
        L.current = `M ${x} ${y}`;
        log("return", { t, x, y, d: { index: idx } });
        redraw();
      }
      return;
    }
    if (idx === L.connected) {
      L.committed += ` ${L.current}`;
      L.current = `M ${x} ${y}`;
      L.connected++;
      log("connect", { t, x, y, d: { index: idx } });
      setConnected(L.connected);
      redraw();
      if (L.connected === circles.length && !L.done) {
        L.done = true;
        onDone(t);
      }
    } else if (idx > L.connected) {
      log("error", { t, x, y, d: { expected: L.connected, touched: idx } });
      setErrorAt(idx);
      L.current = "";
      if (L.connected > 0) {
        L.needsReturn = true;
        setNeedsReturn(true);
      }
      redraw();
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (live.current.done) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const { x, y } = point(e);
    log("pointer_down", { t: e.timeStamp, x, y, d: { pointerType: e.pointerType } });
    const L = live.current;
    L.down = true;
    L.inside = -1;
    L.current += `${L.current ? " " : ""}M ${x} ${y}`;
    redraw();
    hitTest(x, y, e.timeStamp);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (live.current.done) return;
    const L = live.current;
    const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of coalesced.length ? coalesced : [e.nativeEvent]) {
      const { x, y } = point(ev);
      // Hover moves (mouse, pen) are recorded too: they show where attention went between strokes.
      log("pointer_move", { t: ev.timeStamp, x, y, d: L.down ? undefined : { hover: true } });
      if (!L.down) continue;
      if (!L.needsReturn) L.current += ` L ${x} ${y}`;
      hitTest(x, y, ev.timeStamp);
    }
    redraw();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (live.current.done) return;
    const { x, y } = point(e);
    log("pointer_up", { t: e.timeStamp, x, y });
    live.current.down = false;
    live.current.inside = -1;
  };

  const last = circles[connected - 1];
  const hint = part === "A" ? "1 → 2 → 3 → …" : "1 → A → 2 → B → …";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 pb-4 pt-12 md:gap-4">
      <p className={cn("h-9 text-2xl font-bold tracking-tight transition-colors md:text-3xl", needsReturn ? "text-[oklch(0.55_0.2_27)]" : "text-[var(--kid-ink)]/70")}>
        {needsReturn && last ? `Oops! Go back to ${last.label}` : hint}
      </p>
      <div
        ref={boardRef}
        className="relative aspect-square touch-none select-none rounded-[2rem] bg-white shadow-sm ring-1 ring-black/5"
        // Fixed nominal physical size; shrinks only if the screen can't fit it (recorded + flagged).
        style={{ width: `min(${TRAIL_BOARD_TARGET_PX}px, 78vh, 92vw)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="application"
        aria-label={`Trail board, part ${part}`}
      >
        <svg viewBox="0 0 1 1" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <path ref={committedRef} fill="none" stroke="var(--primary)" strokeWidth={0.012} strokeLinecap="round" strokeLinejoin="round" />
          <path ref={currentRef} fill="none" stroke="var(--primary)" strokeOpacity={0.75} strokeWidth={0.012} strokeLinecap="round" strokeLinejoin="round" />
          {circles.map((c, i) => {
            const isDone = i < connected;
            const isError = errorAt === i;
            const isReturn = needsReturn && i === connected - 1;
            return (
              <g key={c.label}>
                {isReturn && <circle cx={c.x} cy={c.y} r={radius * 1.35} fill="none" stroke="var(--kid-butter)" strokeWidth={0.012} className="animate-pulse" />}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={radius}
                  fill={isError ? "oklch(0.75 0.16 27)" : isDone ? "var(--kid-mint)" : "white"}
                  stroke="var(--kid-ink)"
                  strokeWidth={0.006}
                />
                <text x={c.x} y={c.y} dy="0.35em" textAnchor="middle" fontSize={radius * 0.95} fontWeight={700} fill="var(--kid-ink)">
                  {c.label}
                </text>
                {(i === 0 || i === circles.length - 1) && (
                  <text x={c.x} y={c.y + radius + 0.035} textAnchor="middle" fontSize={0.028} fontWeight={600} fill="var(--kid-ink)" opacity={0.55}>
                    {i === 0 ? "Start" : "End"}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
