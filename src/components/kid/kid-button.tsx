"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function KidButton({
  className,
  variant = "primary",
  lockMs = 0,
  disabled,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: "primary" | "soft";
  /** Ignore input for this long after mounting, so taps carried over from the previous screen can't skip this one. */
  lockMs?: number;
}) {
  const [locked, setLocked] = useState(lockMs > 0);
  useEffect(() => {
    if (!lockMs) return;
    const t = setTimeout(() => setLocked(false), lockMs);
    return () => clearTimeout(t);
  }, [lockMs]);

  return (
    <button
      type="button"
      disabled={disabled || locked}
      className={cn(
        "kid-press inline-flex h-16 min-w-56 items-center justify-center gap-2 rounded-full px-10 text-xl font-semibold transition-opacity duration-300 md:h-20 md:text-2xl",
        variant === "primary"
          ? "bg-primary text-primary-foreground shadow-[0_5px_0_0_oklch(0.33_0.07_196)]"
          : "bg-white text-[var(--kid-ink)] shadow-[0_5px_0_0_rgba(0,0,0,0.08)] ring-1 ring-black/5",
        (disabled || locked) && "opacity-40",
        className,
      )}
      {...props}
    />
  );
}
