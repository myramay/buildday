"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CloudOff, Pause } from "lucide-react";
import { InstructionScreen } from "@/components/kid/instruction-screen";
import { KidButton } from "@/components/kid/kid-button";
import { SHAPE_KINDS, Shape } from "@/components/kid/shape";
import { TASK_LABELS } from "@/lib/events";
import { BATTERY } from "@/lib/tasks/registry";
import { TaskAbortedError, createTaskContext } from "@/lib/tasks/runtime";
import type { TaskMode } from "@/lib/tasks/types";
import { api, withRetry } from "./api";

export type RunnerSession = { sessionId: string; patientId: string; patientCode: string; trailForm: number; quick: boolean };

type Phase =
  | { kind: "welcome" }
  | { kind: "intro"; task: number }
  | { kind: "running"; task: number; mode: TaskMode }
  | { kind: "ready"; task: number }
  | { kind: "transition"; completed: number }
  | { kind: "done" };

type SaveState = "idle" | "saving" | "error";

/** Share of each task's progress-bar segment given to the practice round. */
const PRACTICE_WEIGHT = 0.3;

export function TestRunner({ s }: { s: RunnerSession }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(s.quick ? { kind: "intro", task: 0 } : { kind: "welcome" });
  const [stage, setStage] = useState<ReactNode>(null);
  const [roundProgress, setRoundProgress] = useState(0);
  const [save, setSave] = useState<SaveState>("idle");
  const pending = useRef<(() => Promise<unknown>)[]>([]);
  const flushing = useRef(false);

  /** Upload queue: runs in order in the background so the child never waits; failures can be retried. */
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    setSave("saving");
    try {
      while (pending.current.length) {
        await withRetry(pending.current[0]);
        pending.current.shift();
      }
      setSave("idle");
    } catch {
      setSave("error");
    } finally {
      flushing.current = false;
    }
  }, []);
  const enqueue = (job: () => Promise<unknown>) => {
    pending.current.push(job);
    void flush();
  };

  const startRound = (task: number, mode: TaskMode) => {
    setStage(null);
    setRoundProgress(0);
    setPhase({ kind: "running", task, mode });
  };

  useEffect(() => {
    if (phase.kind !== "running") return;
    const { task: index, mode } = phase;
    const task = BATTERY[index];
    const controller = new AbortController();
    const ctx = createTaskContext({
      mode,
      variant: s.quick ? "quick" : "standard",
      form: s.trailForm,
      signal: controller.signal,
      render: setStage,
      progress: setRoundProgress,
    });

    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) throw new TaskAbortedError();
        return task.run(ctx);
      })
      .then(() => {
        if (controller.signal.aborted) return;
        const events = [...ctx.events].sort((a, b) => a.t - b.t);
        if (mode === "practice") {
          enqueue(() => api.uploadEvents(s.sessionId, task.id, "practice", task.version, events));
          setPhase({ kind: "ready", task: index });
          return;
        }
        enqueue(() => api.uploadEvents(s.sessionId, task.id, "test", task.version, events));
        enqueue(() => api.scoreTask(s.sessionId, task.id));
        setPhase(index + 1 < BATTERY.length ? { kind: "transition", completed: index + 1 } : { kind: "done" });
      })
      .catch((err) => {
        if (!(err instanceof TaskAbortedError)) console.error(err);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enqueue is stable in practice (ref-backed)
  }, [phase, s]);

  const transitionTo = phase.kind === "transition" ? phase.completed : null;
  const goNext = useCallback(() => {
    if (transitionTo != null) setPhase({ kind: "intro", task: transitionTo });
  }, [transitionTo]);

  const pause = () => {
    if (window.confirm("Leave the test? Tasks already finished are saved.")) router.push("/");
  };

  const overall = overallProgress(phase, roundProgress, s.quick ? 0 : PRACTICE_WEIGHT);

  return (
    <div className="fixed inset-0 flex select-none flex-col bg-[var(--kid-bg)] text-[var(--kid-ink)]">
      {phase.kind !== "done" && (
        <header className="flex items-center gap-4 px-5 pt-5 md:px-10 md:pt-7">
          {s.quick && <DemoTaskLabel task={currentTask(phase)} />}
          <div className="flex flex-1 items-center gap-1.5" aria-label={`Progress ${Math.round(overall * 100)}%`}>
            {BATTERY.map((t, i) => {
              const fill = Math.min(1, Math.max(0, overall * BATTERY.length - i));
              return (
                <div key={t.id} className="h-3 flex-1 overflow-hidden rounded-full bg-white ring-1 ring-black/5">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${fill * 100}%` }} />
                </div>
              );
            })}
          </div>
          {save === "error" && (
            <button type="button" onClick={() => void flush()} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-medium ring-1 ring-black/5">
              <CloudOff className="size-4" /> Retry save
            </button>
          )}
          <button type="button" onClick={pause} className="kid-press flex size-11 items-center justify-center rounded-full bg-white ring-1 ring-black/5" aria-label="Leave test (for grown-ups)">
            <Pause className="size-5" />
          </button>
        </header>
      )}

      <main className="relative flex-1 overflow-hidden">
        {phase.kind === "welcome" && (
          <Center>
            <FloatingShapes />
            <h1 className="kid-pop text-5xl font-bold tracking-tight md:text-6xl">Hi there!</h1>
            <p className="max-w-md text-xl text-[var(--kid-ink)]/75 text-balance md:text-2xl">
              We&apos;re going to play {BATTERY.length} quick games. There are no wrong answers — just try your best.
            </p>
            <KidButton lockMs={600} onClick={() => setPhase({ kind: "intro", task: 0 })}>
              I&apos;m ready!
            </KidButton>
          </Center>
        )}

        {phase.kind === "intro" && (
          <InstructionScreen
            key={phase.task}
            task={BATTERY[phase.task]}
            taskNumber={phase.task + 1}
            quick={s.quick}
            onContinue={() => startRound(phase.task, s.quick ? "real" : "practice")}
          />
        )}

        {phase.kind === "running" && (
          <div className="h-full">
            {phase.mode === "practice" && (
              <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-white/80 px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--kid-ink)]/60 ring-1 ring-black/5">
                Practice
              </div>
            )}
            {stage}
          </div>
        )}

        {phase.kind === "ready" && (
          <Center>
            <div className="kid-pop flex size-24 items-center justify-center rounded-full bg-[var(--kid-mint)] text-5xl">✓</div>
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl">Great practice!</h2>
            <p className="text-xl text-[var(--kid-ink)]/75 md:text-2xl">Now let&apos;s do the real one.</p>
            <KidButton lockMs={800} onClick={() => startRound(phase.task, "real")}>
              Start!
            </KidButton>
          </Center>
        )}

        {phase.kind === "transition" && <TransitionScreen completed={phase.completed} onNext={goNext} auto={s.quick} />}

        {phase.kind === "done" && <DoneScreen s={s} save={save} onRetry={() => void flush()} />}
      </main>
    </div>
  );
}

/** Index of the task the current screen belongs to (the upcoming one on a transition). */
function currentTask(phase: Phase): number {
  switch (phase.kind) {
    case "intro":
    case "running":
    case "ready":
      return phase.task;
    case "transition":
      return phase.completed;
    default:
      return 0;
  }
}

/** Quick demo only: names the test on screen so observers can follow along. */
function DemoTaskLabel({ task }: { task: number }) {
  const t = BATTERY[Math.min(task, BATTERY.length - 1)];
  return (
    <div className="shrink-0 rounded-xl bg-white px-3 py-1.5 leading-tight ring-1 ring-black/5" data-testid="demo-task-label">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--kid-ink)]/50">
        Demo · Test {task + 1} of {BATTERY.length}
      </div>
      <div className="text-sm font-semibold md:text-base">
        {TASK_LABELS[t.id]} <span className="font-normal text-[var(--kid-ink)]/60">· “{t.name}”</span>
      </div>
    </div>
  );
}

function overallProgress(phase: Phase, round: number, practiceWeight: number): number {
  const n = BATTERY.length;
  switch (phase.kind) {
    case "intro":
      return phase.task / n;
    case "running":
      return (phase.task + (phase.mode === "practice" ? round * practiceWeight : practiceWeight + round * (1 - practiceWeight))) / n;
    case "ready":
      return (phase.task + practiceWeight) / n;
    case "transition":
      return phase.completed / n;
    case "done":
      return 1;
    default:
      return 0;
  }
}

function Center({ children }: { children: ReactNode }) {
  return <div className="relative flex h-full flex-col items-center justify-center gap-6 px-6 text-center">{children}</div>;
}

function FloatingShapes() {
  const spots = ["left-[8%] top-[12%]", "right-[10%] top-[18%]", "left-[14%] bottom-[16%]", "right-[16%] bottom-[12%]", "left-[45%] top-[6%]"];
  return (
    <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden>
      {SHAPE_KINDS.map((kind, i) => (
        <div key={kind} className={`kid-float absolute ${spots[i]}`} style={{ animationDelay: `${-i * 0.7}s` }}>
          <Shape kind={kind} className="size-14 md:size-20" />
        </div>
      ))}
    </div>
  );
}

const CHEERS = ["Nice work!", "Awesome!", "You're on a roll!", "Super job!"];

function TransitionScreen({ completed, onNext, auto }: { completed: number; onNext: () => void; auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(onNext, 1400);
    return () => clearTimeout(t);
  }, [auto, onNext]);
  return (
    <Center>
      <FloatingShapes />
      <div className="flex gap-3">
        {BATTERY.map((t, i) => (
          <div key={t.id} className={i < completed ? "kid-pop" : "opacity-30 grayscale"} style={{ animationDelay: `${i * 120}ms` }}>
            <Shape kind="star" className="size-14 md:size-16" />
          </div>
        ))}
      </div>
      <h2 className="kid-pop text-5xl font-bold tracking-tight md:text-6xl">{CHEERS[(completed - 1) % CHEERS.length]}</h2>
      <p className="text-2xl text-[var(--kid-ink)]/75 md:text-3xl">
        {completed} of {BATTERY.length} done
      </p>
      <KidButton lockMs={auto ? 300 : 1000} onClick={onNext}>
        Next game
      </KidButton>
    </Center>
  );
}

function DoneScreen({ s, save, onRetry }: { s: RunnerSession; save: SaveState; onRetry: () => void }) {
  return (
    <Center>
      <FloatingShapes />
      <h1 className="kid-pop text-5xl font-bold tracking-tight md:text-6xl">All done!</h1>
      <p className="max-w-md text-xl text-[var(--kid-ink)]/75 text-balance md:text-2xl">Thanks for playing. Please hand the device back to your grown-up.</p>
      <div className="relative mt-2 w-full max-w-md rounded-2xl bg-white p-6 text-left text-foreground shadow-sm ring-1 ring-black/5">
        <p className="text-sm font-medium text-primary">For the clinician · {s.patientCode}</p>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="save-status">
          {save === "saving" ? "Saving results…" : save === "error" ? "Some results haven't saved yet." : "All results saved."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {save === "error" ? (
            <button type="button" onClick={onRetry} className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
              Retry saving
            </button>
          ) : (
            <Link
              href={`/dashboard/patients/${s.patientId}?session=${s.sessionId}`}
              aria-disabled={save === "saving"}
              className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground aria-disabled:pointer-events-none aria-disabled:opacity-50"
            >
              Open in dashboard →
            </Link>
          )}
          <Link href="/" className="inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium hover:bg-muted">
            Finish
          </Link>
        </div>
      </div>
    </Center>
  );
}
