"use client";

import { AlertTriangle, FlaskConical, ShieldAlert } from "lucide-react";
import type { ResultDTO } from "@/lib/api-types";
import type { Metric, ValidityFlag } from "@/lib/metrics/types";
import type { NormComparison } from "@/lib/norms";
import { cn } from "@/lib/utils";

export function formatValue(m: Pick<Metric, "value" | "unit">): string {
  const v = m.value;
  if (v == null) return "—";
  switch (m.unit) {
    case "ms":
      return v >= 10_000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`;
    case "fraction":
      return `${Math.round(v * 100)}%`;
    case "ratio":
      return v.toFixed(2);
    default:
      return `${v}`;
  }
}

export function ValidityChips({ flags }: { flags: ValidityFlag[] }) {
  if (!flags.length)
    return <span className="text-xs text-muted-foreground">No validity flags</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((f, i) => (
        <span
          key={i}
          title={f.detail}
          className="inline-flex items-center gap-1 rounded-full bg-status-warn/15 px-2 py-0.5 text-xs font-medium text-[oklch(0.45_0.1_70)] ring-1 ring-status-warn/40"
        >
          <ShieldAlert className="size-3.5" /> {f.label}
        </span>
      ))}
    </div>
  );
}

function NormCell({ n }: { n: NormComparison | undefined }) {
  if (!n) return <span className="text-muted-foreground">—</span>;
  switch (n.status) {
    case "compared":
      return (
        <span className="tabular-nums" title={`${n.citation} · age ${n.band.ageMin}–${n.band.ageMax}, n=${n.band.n}`}>
          z {n.z > 0 ? "+" : ""}
          {n.z.toFixed(2)} · {n.percentile.toFixed(0)}th %ile
        </span>
      );
    case "exploratory":
      return (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <FlaskConical className="size-3.5" /> exploratory
        </span>
      );
    case "placeholder":
      return (
        <span className="text-muted-foreground" title={n.note}>
          no norms (placeholder)
        </span>
      );
    case "no_band":
      return <span className="text-muted-foreground" title={n.note}>no age band</span>;
    default:
      return <span className="text-muted-foreground">—</span>;
  }
}

/**
 * Score table for one task result. Flags (red) appear only where a published norm comparison exceeds 1.5 SD.
 * Metrics listed in `links` render as buttons (e.g. hesitation counts → the hesitation list).
 */
export function ScoreTable({ result, links = {} }: { result: ResultDTO; links?: Record<string, () => void> }) {
  const scores = result.metrics.metrics.filter((m) => m.kind === "score");
  const process = result.metrics.metrics.filter((m) => m.kind === "process");
  const row = (m: Metric) => {
    const n = result.normComparison[m.key];
    const flagged = n?.status === "compared" && n.flag;
    const link = links[m.key];
    return (
      <tr key={m.key} className={cn("border-t", flagged && "bg-status-serious/8")}>
        <td className="py-1.5 pr-3">
          {link ? (
            <button type="button" onClick={link} className="text-left text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid">
              {m.label}
            </button>
          ) : (
            m.label
          )}
        </td>
        <td className="whitespace-nowrap py-1.5 pr-4 text-right font-medium tabular-nums" title={m.value == null ? m.na : undefined}>
          {formatValue(m)}
        </td>
        <td className="py-1.5 pr-3 text-xs">
          <NormCell n={n} />
        </td>
        <td className="py-1.5 text-right">
          {flagged ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-serious/12 px-2 py-0.5 text-xs font-semibold text-status-serious">
              <AlertTriangle className="size-3.5" /> &gt;1.5 SD
            </span>
          ) : null}
        </td>
      </tr>
    );
  };
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="pb-1 font-medium">Score</th>
          <th className="pb-1 pr-4 text-right font-medium">Value</th>
          <th className="pb-1 font-medium">Norm comparison</th>
          <th className="pb-1 text-right font-medium">Flag</th>
        </tr>
      </thead>
      <tbody>{scores.map(row)}</tbody>
      <tbody>
        <tr>
          <td colSpan={4} className="pt-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <FlaskConical className="size-3.5" /> Process metrics — exploratory, no established norms
            </span>
          </td>
        </tr>
        {process.map(row)}
      </tbody>
    </table>
  );
}
