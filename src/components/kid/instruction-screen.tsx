"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Hand, Pointer } from "lucide-react";
import type { Task } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";
import { Fish, type Direction } from "./fish";
import { KidButton } from "./kid-button";
import { NOGO_FILL, Shape, type ShapeKind } from "./shape";

/** Instructions are read (often aloud by a parent) before anything is clickable. */
const INSTRUCTION_LOCK_MS = 1500;

export function InstructionScreen({
  task,
  taskNumber,
  onContinue,
  quick,
}: {
  task: Task;
  taskNumber: number;
  onContinue: () => void;
  /** Quick demo: no practice round follows, shorter input lock. */
  quick?: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 px-6 text-center md:gap-9">
      <div className="kid-pop">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--kid-ink)]/50">
          Game {taskNumber}
        </p>
        <h2 className="mt-2 text-4xl font-bold tracking-tight text-[var(--kid-ink)] md:text-5xl">
          {task.instructions.title}
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-xl text-[var(--kid-ink)]/75 text-balance md:text-2xl">
          {task.instructions.body}
        </p>
      </div>

      <div className="flex min-h-56 items-center justify-center rounded-[2rem] bg-white/60 px-8 py-6 ring-1 ring-black/5">
        {task.instructions.demo === "go-no-go" && <GoNoGoDemo />}
        {task.instructions.demo === "flanker" && <FlankerDemo />}
        {task.instructions.demo === "span" && <SpanDemo />}
        {task.instructions.demo === "trail" && <TrailDemo />}
      </div>

      <KidButton lockMs={quick ? 700 : INSTRUCTION_LOCK_MS} onClick={onContinue}>
        {quick ? "Start!" : "Let's practice!"}
      </KidButton>
    </div>
  );
}

/** Steps through `n` states every `ms`. */
function useStep(n: number, ms: number) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % n), ms);
    return () => clearInterval(t);
  }, [n, ms]);
  return step;
}

function TrailDemo() {
  const pts = [
    { l: "1", x: 30, y: 110 },
    { l: "2", x: 95, y: 40 },
    { l: "3", x: 165, y: 105 },
    { l: "4", x: 225, y: 45 },
  ];
  const d = pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  return (
    <svg viewBox="0 0 255 150" className="h-40 w-auto md:h-48" aria-hidden>
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="demo-trail" />
      {pts.map((p) => (
        <g key={p.l}>
          <circle cx={p.x} cy={p.y} r={20} fill="white" stroke="var(--kid-ink)" strokeWidth={3} />
          <text x={p.x} y={p.y} dy="0.35em" textAnchor="middle" fontSize={20} fontWeight={700} fill="var(--kid-ink)">
            {p.l}
          </text>
        </g>
      ))}
    </svg>
  );
}

const GNG_DEMO: ShapeKind[] = ["circle", "heart", "star", "square"];

function GoNoGoDemo() {
  const step = useStep(GNG_DEMO.length, 1400);
  const shape = GNG_DEMO[step];
  const stop = shape === "star";
  return (
    <div className="flex w-64 flex-col items-center gap-7">
      <div key={step} className="kid-pop relative">
        <Shape kind={shape} fill={stop ? NOGO_FILL : undefined} className="size-28 md:size-32" />
        {!stop && (
          <Pointer className="demo-finger absolute -bottom-3 left-1/2 -ml-3 size-10 fill-white text-[var(--kid-ink)]" strokeWidth={1.75} />
        )}
      </div>
      <p
        className={cn(
          "flex h-8 items-center gap-2 text-xl font-bold",
          stop ? "text-[oklch(0.55_0.2_27)]" : "text-primary",
        )}
      >
        {stop ? (
          <>
            <Hand className="size-6" /> Don&apos;t tap!
          </>
        ) : (
          "Tap!"
        )}
      </p>
    </div>
  );
}

function FlankerDemo() {
  const step = useStep(2, 2600);
  // Alternate a congruent example (all right) with an incongruent one (middle swims left).
  const target: Direction = step === 0 ? "right" : "left";
  const flankers: Direction = "right";
  return (
    <div key={step} className="kid-pop flex flex-col items-center gap-5">
      <div className="flex items-center gap-1 md:gap-2">
        {[flankers, flankers, target, flankers, flankers].map((d, i) => (
          <div key={i} className={cn("rounded-2xl p-1", i === 2 && "bg-[var(--kid-butter)]/70 ring-2 ring-[var(--kid-ink)]/20")}>
            <Fish direction={d} className="h-10 md:h-14" />
          </div>
        ))}
      </div>
      <div className="flex gap-8">
        {(["left", "right"] as const).map((dir) => (
          <div
            key={dir}
            className={cn(
              "flex h-14 w-24 items-center justify-center rounded-2xl bg-white ring-1 ring-black/5",
              dir === target && "demo-glow",
            )}
          >
            {dir === "left" ? <ArrowLeft className="size-8" /> : <ArrowRight className="size-8" />}
          </div>
        ))}
      </div>
    </div>
  );
}

const SPAN_DEMO_TILES: [number, number][] = [
  [8, 10], [44, 4], [77, 14], [20, 38], [57, 33], [80, 47], [6, 68], [41, 64], [70, 79],
];
const SPAN_DEMO_SEQ = [4, 0, 8];

function SpanDemo() {
  // 0–2 watch, 3 pause, 4–6 taps, 7 pause
  const step = useStep(8, 650);
  const watching = step < 3;
  const tapping = step >= 4 && step <= 6;
  const lit = watching ? SPAN_DEMO_SEQ[step] : tapping ? SPAN_DEMO_SEQ[step - 4] : null;
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="h-6 text-lg font-bold text-[var(--kid-ink)]/70">{step < 4 ? "Watch…" : "Your turn!"}</p>
      <div className="relative size-48 rounded-3xl bg-[oklch(0.33_0.04_250)] md:size-56">
        {SPAN_DEMO_TILES.map(([x, y], i) => (
          <div
            key={i}
            className={cn(
              "absolute rounded-xl transition-colors duration-100",
              lit === i ? "bg-[var(--kid-butter)] shadow-[0_0_18px_4px_oklch(0.93_0.12_92/0.6)]" : "bg-[oklch(0.45_0.04_250)]",
            )}
            style={{ left: `${x}%`, top: `${y}%`, width: "16%", height: "16%" }}
          >
            {tapping && lit === i && (
              <Pointer className="absolute left-1/2 top-1/2 size-8 fill-white text-[var(--kid-ink)]" strokeWidth={1.75} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
