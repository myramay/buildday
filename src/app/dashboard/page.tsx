"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { PatientSummary } from "@/components/test/api";
import { SampleBadge } from "@/components/dashboard/sample-badge";
import { useApi } from "@/components/dashboard/use-api";

export default function PatientsPage() {
  const { data, error, loading } = useApi<PatientSummary[]>("/api/patients");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Patients</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pseudonymous codes only.</p>
      </div>
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Couldn&apos;t load patients: {error}</p>}
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-3 py-3 font-medium">Age</th>
              <th className="px-3 py-3 font-medium">Grade</th>
              <th className="px-3 py-3 font-medium">Hand</th>
              <th className="px-3 py-3 text-right font-medium">Sessions</th>
              <th className="px-3 py-3 font-medium">Last session</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 3 }, (_, i) => (
                <tr key={i} className="border-t">
                  <td colSpan={7} className="h-14 animate-pulse bg-muted/20" />
                </tr>
              ))}
            {data?.map((p) => (
              <tr key={p.id} className="relative border-t hover:bg-accent/40">
                <td className="px-5 py-3">
                  <Link href={`/dashboard/patients/${p.id}`} className="font-mono font-medium after:absolute after:inset-0">
                    {p.code}
                  </Link>
                  {p.isSample && <SampleBadge />}
                </td>
                <td className="px-3 py-3 tabular-nums">{p.age}</td>
                <td className="px-3 py-3">{p.grade}</td>
                <td className="px-3 py-3 capitalize">{p.dominantHand}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {p.completedCount}
                  {p.sessionCount > p.completedCount && <span className="text-muted-foreground"> (+{p.sessionCount - p.completedCount} incomplete)</span>}
                </td>
                <td className="px-3 py-3 text-muted-foreground">{p.lastSessionAt ? new Date(p.lastSessionAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—"}</td>
                <td className="pr-4 text-muted-foreground">
                  <ChevronRight className="size-4" />
                </td>
              </tr>
            ))}
            {data && !data.length && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                  No patients yet. Run <code className="rounded bg-muted px-1">npm run db:setup</code> for sample data, or start a test.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
