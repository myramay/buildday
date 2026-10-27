import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="relative flex size-7 items-center justify-center rounded-full bg-primary">
        <span className="size-2.5 rounded-full bg-primary-foreground" />
      </span>
      <span className="text-lg">Pathwise</span>
    </Link>
  );
}

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
        <Logo />
        <div className="flex items-center gap-2 text-sm">{children}</div>
      </div>
    </header>
  );
}
