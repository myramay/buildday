import { cn } from "@/lib/utils";

export type Direction = "left" | "right";

/** Simple friendly fish, facing right by default. */
export function Fish({ direction, className }: { direction: Direction; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 80"
      className={cn("h-14 w-auto md:h-20", className)}
      style={{ transform: direction === "left" ? "scaleX(-1)" : undefined }}
      aria-hidden
    >
      <g stroke="var(--kid-ink)" strokeWidth="4" strokeLinejoin="round">
        <path d="M30 40 L6 18 Q4 40 6 62 Z" fill="var(--kid-peach)" />
        <path d="M24 40 C34 14 70 8 96 24 C108 31 114 36 114 40 C114 44 108 49 96 56 C70 72 34 66 24 40 Z" fill="var(--kid-sky)" />
        <path d="M58 22 Q66 12 78 18" fill="none" />
      </g>
      <circle cx="94" cy="36" r="5" fill="var(--kid-ink)" />
      <circle cx="95.5" cy="34.5" r="1.6" fill="white" />
    </svg>
  );
}
