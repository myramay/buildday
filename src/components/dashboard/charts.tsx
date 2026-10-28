"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { Hesitation, SegmentTiming, ThirdsPoint, TrialPoint } from "@/lib/metrics/types";

/* Single-hue encodings throughout; correct vs error uses fill vs outline (+ tooltip), never colour alone. */

const PRIMARY = "var(--primary)";
const MUTED = "var(--muted-foreground)";
const WARN = "var(--status-warn)";
const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const grid = <CartesianGrid stroke="var(--border)" vertical={false} />;
const tooltipStyle = { contentStyle: { borderRadius: 10, border: "1px solid var(--border)", fontSize: 12 }, cursor: { fill: "var(--muted)", fillOpacity: 0.4 } };
/** Axis/tooltip time label: ms below 1 s (avoids duplicate rounded ticks), seconds above. */
const sec = (ms: number) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`);

export function ChartFrame({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <figure className="min-w-0 rounded-xl border bg-card p-3">
      <figcaption className="mb-2 text-xs font-semibold">{title}</figcaption>
      {children}
      {note && <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>}
    </figure>
  );
}

/** Trail Making: time per segment, one chart per part. Hollow = segment contained an error; ● above = hesitation. */
export function SegmentChart({ segments, part }: { segments: SegmentTiming[]; part: "A" | "B" }) {
  const data = segments.filter((s) => s.part === part);
  if (!data.length) return null;
  return (
    <ChartFrame title={`Per-segment time · Part ${part}`} note="Outlined bar = segment with an error · dot above = hesitation(s)">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 14, right: 4, bottom: 0, left: -18 }}>
          {grid}
          <XAxis dataKey="label" tick={{ ...axis, fontSize: 9 }} interval="preserveStartEnd" tickLine={false} />
          <YAxis tickFormatter={sec} tick={axis} tickLine={false} axisLine={false} />
          <Tooltip
            {...tooltipStyle}
            formatter={(v: number, _n, item) => [`${(v / 1000).toFixed(2)} s · ${item.payload.errors} err · ${item.payload.hesitations} hes`, item.payload.label]}
            labelFormatter={() => ""}
          />
          <Bar
            dataKey="ms"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            label={(props) => {
              const { x, y, width, index } = props as unknown as { x: number; y: number; width: number; index: number };
              return data[index]?.hesitations ? <circle key={index} cx={x + width / 2} cy={y - 6} r={3} fill={WARN} /> : <g key={index} />;
            }}
          >
            {data.map((s, i) => (
              <Cell key={i} fill={s.errors ? "var(--card)" : PRIMARY} stroke={PRIMARY} strokeWidth={s.errors ? 2 : 0} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Where hesitations happened on the board (dot size = duration), over the circle layout. */
export function HesitationMap({ hesitations, circles, part }: { hesitations: Hesitation[]; circles: { label: string; x: number; y: number }[]; part: "A" | "B" }) {
  const hs = hesitations.filter((h) => h.part === part && h.x != null);
  return (
    <ChartFrame title={`Hesitation locations · Part ${part}`} note={`${hs.length} hesitation${hs.length === 1 ? "" : "s"} · dot area = duration`}>
      <ResponsiveContainer width="100%" aspect={1} maxHeight={260}>
        <ScatterChart margin={{ top: 14, right: 14, bottom: 14, left: 14 }}>
          <XAxis type="number" dataKey="x" domain={[0, 1]} hide />
          <YAxis type="number" dataKey="y" domain={[0, 1]} reversed hide />
          <ZAxis type="number" dataKey="durationMs" range={[40, 600]} domain={[500, 3000]} />
          <Tooltip
            {...tooltipStyle}
            formatter={(_v, _n, item) => [`${(item.payload.durationMs / 1000).toFixed(1)} s`, item.payload.location]}
            labelFormatter={() => ""}
          />
          <Scatter
            data={circles}
            isAnimationActive={false}
            shape={(props: unknown) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: { label: string } };
              return (
              <g>
                <circle cx={cx} cy={cy} r={11} fill="var(--card)" stroke={MUTED} strokeOpacity={0.6} />
                <text x={cx} y={cy} dy="0.35em" textAnchor="middle" fontSize={9} fill="var(--foreground)">
                  {payload.label}
                </text>
              </g>
              );
            }}
            tooltipType="none"
          />
          <Scatter data={hs} fill={WARN} fillOpacity={0.55} stroke={WARN} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** First-third vs last-third mean time (per part / per task). */
export function ThirdsChart({ thirds, unitLabel }: { thirds: ThirdsPoint[]; unitLabel: string }) {
  if (!thirds.length) return null;
  return (
    <ChartFrame title={`First vs last third · ${unitLabel}`} note="Lighter = first third · darker = last third">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={thirds} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barGap={2}>
          {grid}
          <XAxis dataKey="label" tick={axis} tickLine={false} />
          <YAxis tickFormatter={sec} tick={axis} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyle} formatter={(v: number, n) => [`${(v / 1000).toFixed(2)} s`, n]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="firstMs" name="First third" fill={PRIMARY} fillOpacity={0.45} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="lastMs" name="Last third" fill={PRIMARY} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Response time per trial (or per sequence). Filled = correct, outlined = error, × row = no response. Dashed line = `highlight` trial. */
export function TrialChart({ trials, title, highlight }: { trials: TrialPoint[]; title: string; highlight?: number }) {
  const max = Math.max(1000, ...trials.map((t) => t.rtMs ?? 0));
  const data = trials.map((t) => ({ ...t, y: t.rtMs ?? max * 1.08, missing: t.rtMs == null }));
  return (
    <ChartFrame title={title} note="Filled = correct · outlined = error · top row = no response">
      <ResponsiveContainer width="100%" height={180}>
        <ScatterChart margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
          {grid}
          <XAxis type="number" dataKey="i" tickFormatter={(v) => `${v + 1}`} tick={axis} tickLine={false} domain={["dataMin", "dataMax"]} />
          <YAxis type="number" dataKey="y" tickFormatter={sec} tick={axis} tickLine={false} axisLine={false} domain={[0, max * 1.12]} />
          {highlight != null && <ReferenceLine x={highlight} stroke={WARN} strokeWidth={2} strokeDasharray="4 3" />}
          <Tooltip
            {...tooltipStyle}
            formatter={(_v, _n, item) => [
              `${item.payload.missing ? "no response" : `${item.payload.rtMs} ms`} · ${item.payload.correct ? "correct" : "error"} · ${item.payload.kind.replace("_", " ")}`,
              `Trial ${item.payload.i + 1}`,
            ]}
            labelFormatter={() => ""}
          />
          <Scatter
            data={data}
            isAnimationActive={false}
            shape={(props: unknown) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: (typeof data)[number] };
              return payload.missing ? (
                <g stroke={payload.correct ? MUTED : "var(--status-serious)"} strokeWidth={1.8} strokeLinecap="round">
                  {payload.correct ? (
                    <line x1={cx - 3.5} x2={cx + 3.5} y1={cy} y2={cy} />
                  ) : (
                    <>
                      <line x1={cx - 3} y1={cy - 3} x2={cx + 3} y2={cy + 3} />
                      <line x1={cx - 3} y1={cy + 3} x2={cx + 3} y2={cy - 3} />
                    </>
                  )}
                </g>
              ) : (
                <circle cx={cx} cy={cy} r={4} fill={payload.correct ? PRIMARY : "var(--card)"} stroke={PRIMARY} strokeWidth={payload.correct ? 0 : 1.8} />
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export type TrendPoint = { label: string; value: number | null; quick: boolean; flagged: boolean };
/** Horizontal reference range behind the trend line: shaded low–high, dashed labelled line at mid (own dash pattern, not colour alone). */
export type TrendBand = { id: string; label: string; low: number; high: number; mid: number; color: string; dash: string };

/** Session-over-session change for one metric. Hollow points = quick-demo protocol (not comparable). */
export function TrendChart({ data, metricLabel, unit, bands = [] }: { data: TrendPoint[]; metricLabel: string; unit: string; bands?: TrendBand[] }) {
  const fmt = (v: number) => (unit === "ms" ? sec(v) : unit === "fraction" ? `${Math.round(v * 100)}%` : `${v}`);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -8 }}>
        {grid}
        <XAxis dataKey="label" tick={axis} tickLine={false} />
        <YAxis tickFormatter={fmt} tick={axis} tickLine={false} axisLine={false} />
        {bands.map((b) => (
          <ReferenceArea key={`${b.id}-range`} y1={b.low} y2={b.high} fill={b.color} fillOpacity={0.12} ifOverflow="extendDomain" />
        ))}
        {bands.map((b, i) => (
          <ReferenceLine
            key={`${b.id}-mid`}
            y={b.mid}
            stroke={b.color}
            strokeWidth={1.5}
            strokeDasharray={b.dash}
            ifOverflow="extendDomain"
            // Labels are staggered along the line so close-together means stay readable.
            label={(props: unknown) => {
              const { viewBox } = props as { viewBox: { x: number; y: number; width: number } };
              return (
                <text x={viewBox.x + viewBox.width * (0.02 + i * 0.245)} y={viewBox.y - 4} fontSize={10} fontWeight={600} fill={b.color}>
                  {b.label}
                </text>
              );
            }}
          />
        ))}
        <Tooltip {...tooltipStyle} formatter={(v: number) => [fmt(v), metricLabel]} />
        <Line
          dataKey="value"
          stroke={PRIMARY}
          strokeWidth={2}
          connectNulls
          isAnimationActive={false}
          dot={(props: unknown) => {
            const { cx, cy, payload, index } = props as { cx: number; cy: number; payload: TrendPoint; index: number };
            if (payload.value == null) return <g key={index} />;
            return <circle key={index} cx={cx} cy={cy} r={5} fill={payload.quick ? "var(--card)" : PRIMARY} stroke={payload.flagged ? "var(--status-serious)" : PRIMARY} strokeWidth={2} />;
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
