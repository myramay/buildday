"use client";

import type { Hesitation } from "@/lib/metrics/types";
import { cn } from "@/lib/utils";

/** Clickable hesitation list for tasks without a replay; selecting one highlights it on the card's chart. */
export function HesitationList({ hesitations, selected, onSelect }: { hesitations: Hesitation[]; selected: number | null; onSelect: (index: number) => void }) {
  if (!hesitations.length) return <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">No hesitations.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
        <tr>
          <th className="font-medium">Where</th>
          <th className="text-right font-medium">At</th>
          <th className="text-right font-medium">Length</th>
        </tr>
      </thead>
      <tbody>
        {hesitations.map((h, i) => (
          <tr key={i} className={cn("border-t hover:bg-muted", i === selected && "bg-status-warn/10")}>
            <td className="py-1">
              <button type="button" onClick={() => onSelect(i)} aria-pressed={i === selected} className="text-left underline decoration-dotted underline-offset-2">
                {h.location}
              </button>
            </td>
            <td className="py-1 text-right tabular-nums text-muted-foreground">{(h.startMs / 1000).toFixed(1)} s</td>
            <td className="py-1 text-right tabular-nums">{(h.durationMs / 1000).toFixed(1)} s</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
