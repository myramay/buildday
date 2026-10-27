import { prisma } from "@/lib/db";
import type { CohortStatDTO } from "@/lib/api-types";
import { METRICS_VERSION } from "@/lib/metrics";
import { quantile, round } from "@/lib/metrics/stats";
import { handle, parseResult } from "@/lib/server/results";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Score distributions across every other patient's standard-protocol sessions (current metrics version only),
 * keyed "taskType:metricKey". One value per session; quick-protocol sessions are not comparable and are left out.
 */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const rows = await prisma.taskResult.findMany({
    where: { version: METRICS_VERSION, session: { protocol: "standard", patientId: { not: id } } },
    include: { session: { select: { patientId: true, patient: { select: { age: true, isSample: true } } } } },
  });

  type Group = { values: number[]; kids: Map<string, { age: number; isSample: boolean }> };
  const byMetric = new Map<string, Group>();
  for (const row of rows) {
    const r = parseResult(row);
    for (const m of r.metrics.metrics) {
      if (m.kind !== "score" || m.value == null) continue;
      const key = `${r.taskType}:${m.key}`;
      const g: Group = byMetric.get(key) ?? { values: [], kids: new Map() };
      g.values.push(m.value);
      g.kids.set(row.session.patientId, row.session.patient);
      byMetric.set(key, g);
    }
  }

  const out: Record<string, CohortStatDTO> = {};
  for (const [key, { values, kids }] of byMetric) {
    const ages = [...kids.values()].map((p) => p.age);
    out[key] = {
      q1: round(quantile(values, 0.25), 3)!,
      median: round(quantile(values, 0.5), 3)!,
      q3: round(quantile(values, 0.75), 3)!,
      sessions: values.length,
      kids: kids.size,
      sampleKids: [...kids.values()].filter((p) => p.isSample).length,
      ageMin: Math.min(...ages),
      ageMax: Math.max(...ages),
    };
  }
  return Response.json(out);
});
