import { prisma } from "@/lib/db";
import { TASK_LABELS } from "@/lib/events";
import { HttpError, handle, parseResult, unpackEvents } from "@/lib/server/results";

type Ctx = { params: Promise<{ id: string }> };

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * ?format=json — session, patient (pseudonymous), results, norm comparisons, validity flags and full raw events.
 * ?format=csv  — one row per metric (long format), with norm status and validity flags.
 */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const s = await prisma.session.findUnique({ where: { id }, include: { patient: true, clinician: true, results: true, events: true } });
  if (!s) throw new HttpError(404, "Session not found");
  const results = s.results.map(parseResult);
  const base = `pathwise-${s.patient.code}-${s.startedAt.toISOString().slice(0, 10)}-${s.id.slice(-6)}`;

  if (format === "csv") {
    const header = [
      "session_id", "patient_code", "sample", "age", "session_started", "protocol", "input_type", "task", "task_version", "metrics_version", "form",
      "metric", "label", "value", "unit", "kind", "norm_status", "z", "percentile", "norm_flag", "norm_citation", "validity_flags",
    ];
    const rows = results.flatMap((r) =>
      r.metrics.metrics.map((m) => {
        const n = r.normComparison[m.key];
        return [
          s.id, s.patient.code, s.patient.isSample, s.patient.age, s.startedAt.toISOString(), s.protocol, s.inputType,
          TASK_LABELS[r.taskType], r.metrics.taskVersion, r.version, r.metrics.form ?? "",
          m.key, m.label, m.value, m.unit, m.kind,
          n?.status ?? "", n?.status === "compared" ? n.z : "", n?.status === "compared" ? n.percentile : "", n?.status === "compared" ? n.flag : "",
          n && "citation" in n ? n.citation : "",
          r.metrics.validity.map((v) => v.code).join("|"),
        ].map(csvCell).join(",");
      }),
    );
    return new Response([header.join(","), ...rows].join("\n") + "\n", {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${base}.csv"` },
    });
  }
  if (format !== "json") throw new HttpError(400, "format must be csv or json");

  const body = {
    exportedAt: new Date().toISOString(),
    session: { ...s, deviceInfo: JSON.parse(s.deviceInfo), results: undefined, events: undefined },
    results,
    rawEvents: s.events.map((e) => ({ taskType: e.taskType, phase: e.phase, taskVersion: e.taskVersion, events: unpackEvents(e.data) })),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${base}.json"` },
  });
});
