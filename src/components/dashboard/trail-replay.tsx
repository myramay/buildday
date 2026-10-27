"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RawEvent } from "@/lib/events";
import { trailHesitations, trailParts } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { useApi } from "./use-api";

const SPEEDS = [1, 2, 4];

/** Replays the child's drawn path from the stored raw events, with hesitations and errors highlighted. */
export function TrailReplay({ sessionId }: { sessionId: string }) {
  const { data, error, loading } = useApi<{ events: RawEvent[] }>(`/api/sessions/${sessionId}/events?taskType=trail-making`);
  const parts = useMemo(() => (data ? trailParts(data.events) : []), [data]);
  const [partId, setPartId] = useState<"A" | "B">("B");

  if (loading) return <div className="aspect-square max-w-md animate-pulse rounded-xl bg-muted/50" />;
  if (error || !parts.length) return <p className="text-sm text-muted-foreground">Replay unavailable{error ? ` (${error})` : ""}.</p>;
  const part = parts.find((p) => p.part === partId) ?? parts[0];
  return (
    <div>
      <div className="mb-2 inline-flex rounded-lg border p-0.5 text-sm">
        {parts.map((p) => (
          <button
            key={p.part}
            type="button"
            onClick={() => setPartId(p.part)}
            className={cn("rounded-md px-3 py-1 font-medium", p.part === part.part ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            Part {p.part}
          </button>
        ))}
      </div>
      <PartReplay key={`${sessionId}-${part.part}`} part={part} />
    </div>
  );
}

function PartReplay({ part }: { part: ReturnType<typeof trailParts>[number] }) {
  const hesitations = useMemo(() => trailHesitations(part), [part]);
  const end = part.end;
  const [t, setT] = useState(end);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const raf = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) * speed;
      last = now;
      setT((prev) => {
        const next = prev + dt;
        if (next >= end) {
          setPlaying(false);
          return end;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, speed, end]);

  const d = useMemo(() => {
    const out: string[] = [];
    let pen = false;
    for (const [st, x, y, down] of part.samples) {
      if (st > t) break;
      if (!down) {
        pen = false;
        continue;
      }
      out.push(`${pen ? "L" : "M"} ${x} ${y}`);
      pen = true;
    }
    return out.join(" ");
  }, [part, t]);

  const cursor = useMemo(() => {
    let c: [number, number] | null = null;
    for (const [st, x, y] of part.samples) {
      if (st > t) break;
      c = [x, y];
    }
    return c;
  }, [part, t]);

  const connected = part.connects.filter((c) => c <= t).length;
  const active = hesitations.find((h) => t >= h.startMs && t <= h.startMs + h.durationMs);
  const r = part.radius;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div>
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border bg-white">
          <svg viewBox="0 0 1 1" className="absolute inset-0 h-full w-full" role="img" aria-label={`Replay of Part ${part.part}`}>
            <path d={d} fill="none" stroke="var(--primary)" strokeWidth={0.008} strokeLinecap="round" strokeLinejoin="round" />
            {part.circles.map((c, i) => (
              <g key={c.label}>
                <circle cx={c.x} cy={c.y} r={r} fill={i < connected ? "oklch(0.95 0.03 165)" : "white"} stroke="var(--foreground)" strokeOpacity={0.6} strokeWidth={0.004} />
                <text x={c.x} y={c.y} dy="0.35em" textAnchor="middle" fontSize={r * 0.9} fontWeight={600} fill="var(--foreground)">
                  {c.label}
                </text>
              </g>
            ))}
            {hesitations.map((h, i) =>
              t >= h.startMs ? (
                <circle
                  key={i}
                  cx={h.x}
                  cy={h.y}
                  r={0.018 + (Math.min(h.durationMs, 3000) / 3000) * 0.035}
                  fill="var(--status-warn)"
                  fillOpacity={h === active ? 0.6 : 0.3}
                  stroke="var(--status-warn)"
                  strokeWidth={0.004}
                />
              ) : null,
            )}
            {part.errors.map((e, i) =>
              t >= e.t && e.x != null && e.y != null ? (
                <g key={i} stroke="var(--status-serious)" strokeWidth={0.007} strokeLinecap="round">
                  <line x1={e.x - 0.018} y1={e.y - 0.018} x2={e.x + 0.018} y2={e.y + 0.018} />
                  <line x1={e.x - 0.018} y1={e.y + 0.018} x2={e.x + 0.018} y2={e.y - 0.018} />
                </g>
              ) : null,
            )}
            {cursor && t < end && <circle cx={cursor[0]} cy={cursor[1]} r={0.012} fill="var(--primary)" stroke="white" strokeWidth={0.004} />}
          </svg>
          {active && (
            <div className="absolute inset-x-3 bottom-3 rounded-lg bg-status-warn/20 px-3 py-1.5 text-xs font-medium ring-1 ring-status-warn/40 backdrop-blur">
              Hesitation · {(active.durationMs / 1000).toFixed(1)} s · {active.location}
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              if (playing) return setPlaying(false);
              if (t >= end) setT(0);
              setPlaying(true);
            }}
            aria-label={playing ? "Pause replay" : "Play replay"}
          >
            {playing ? <Pause /> : <Play />}
          </Button>
          <Button size="icon" variant="ghost" onClick={() => { setT(0); setPlaying(false); }} aria-label="Restart replay">
            <RotateCcw />
          </Button>
          <input
            type="range"
            min={0}
            max={Math.round(end)}
            step={10}
            value={Math.round(t)}
            onChange={(e) => { setT(Number(e.target.value)); setPlaying(false); }}
            className="h-1.5 flex-1 cursor-pointer accent-[var(--primary)]"
            aria-label="Replay position"
          />
          <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
            {(t / 1000).toFixed(1)} / {(end / 1000).toFixed(1)} s
          </span>
          <div className="inline-flex rounded-md border text-xs">
            {SPEEDS.map((s) => (
              <button key={s} type="button" onClick={() => setSpeed(s)} className={cn("px-2 py-1 tabular-nums", s === speed ? "bg-muted font-semibold" : "text-muted-foreground")}>
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-2 text-sm">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-full border border-status-warn bg-status-warn/30" /> Hesitation (size = length)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="font-bold text-status-serious">×</span> Error ({part.errors.length})
          </span>
        </div>
        {hesitations.length ? (
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="font-medium">Segment</th>
                <th className="text-right font-medium">At</th>
                <th className="text-right font-medium">Length</th>
              </tr>
            </thead>
            <tbody>
              {hesitations.map((h, i) => (
                <tr
                  key={i}
                  onClick={() => { setT(h.startMs); setPlaying(false); }}
                  className={cn("cursor-pointer border-t hover:bg-muted", h === active && "bg-status-warn/10")}
                >
                  <td className="py-1">{h.location}</td>
                  <td className="py-1 text-right tabular-nums text-muted-foreground">{(h.startMs / 1000).toFixed(1)} s</td>
                  <td className="py-1 text-right tabular-nums">{(h.durationMs / 1000).toFixed(1)} s</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground">No hesitations in this part.</p>
        )}
      </div>
    </div>
  );
}
