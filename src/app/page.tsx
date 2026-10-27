import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <>
      <SiteHeader>
        <Link href="/dashboard" className={buttonVariants({ variant: "ghost" })}>
          Dashboard
        </Link>
      </SiteHeader>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-16 md:px-8">
        <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">Pathwise</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground text-pretty">
          Touch-based Trail Making, Go/No-Go, Flanker and spatial span for children, with every pointer event recorded and
          scored by versioned, testable metrics.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/test" className={cn(buttonVariants({ size: "lg" }), "h-12 px-5 text-base")}>
            Start a test <ArrowRight />
          </Link>
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 px-5 text-base")}>
            <LayoutDashboard /> Clinician dashboard
          </Link>
        </div>
        <p className="mt-10 text-xs text-muted-foreground">Screening and process data to support clinical judgment. Not a diagnostic instrument.</p>
      </main>
    </>
  );
}
