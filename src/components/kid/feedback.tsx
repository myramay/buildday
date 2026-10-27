import { cn } from "@/lib/utils";

/** Practice-round feedback. Never shown in real rounds. */
export function Feedback({ correct, message }: { correct: boolean; message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div
        className={cn(
          "kid-pop flex size-28 items-center justify-center rounded-full text-5xl text-[var(--kid-ink)]",
          correct ? "bg-[var(--kid-mint)]" : "bg-[var(--kid-butter)]",
        )}
      >
        {correct ? "✓" : "↻"}
      </div>
      <p className="max-w-md text-2xl font-semibold text-[var(--kid-ink)] text-balance">{message}</p>
    </div>
  );
}

export function Fixation() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="size-3 rounded-full bg-[var(--kid-ink)]/25" />
    </div>
  );
}
