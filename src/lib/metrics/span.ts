import type { RawEvent } from "@/lib/events";
import { earlyResponseCount, interruptionFlag, isFlaggedInput, usedMouse } from "./shared";
import { mean, round } from "./stats";
import { ANTICIPATION_MS, HESITATION_MS, type Hesitation, type Metric, type MetricsContext, type TaskMetrics, type ValidityFlag } from "./types";

type Seq = { i: number; length: number; sequence: number[]; respStart: number | null; taps: { t: number; tile: number }[]; timedOut: boolean; correct: boolean };

export function spanSequences(events: RawEvent[]): Seq[] {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  return sorted
    .filter((e) => e.type === "seq_start")
    .map((e) => {
      const i = e.d!.i as number;
      const sequence = e.d!.sequence as number[];
      const taps = sorted.filter((x) => x.type === "tap" && !isFlaggedInput(x) && x.d?.i === i).map((x) => ({ t: x.t, tile: x.d!.tile as number }));
      const timedOut = !!sorted.find((x) => x.type === "seq_end" && x.d?.i === i)?.d?.timedOut;
      return {
        i,
        length: e.d!.length as number,
        sequence,
        respStart: sorted.find((x) => x.type === "response_start" && x.d?.i === i)?.t ?? null,
        taps,
        timedOut,
        correct: !timedOut && taps.length === sequence.length && taps.every((t, k) => t.tile === sequence[k]),
      };
    });
}

export function computeSpan(events: RawEvent[], ctx: MetricsContext): TaskMetrics {
  const seqs = spanSequences(events);
  const correct = seqs.filter((s) => s.correct);
  const firstTap = (s: Seq) => (s.respStart != null && s.taps[0] ? round(s.taps[0].t - s.respStart) : null);
  const duration = (s: Seq) => (s.respStart != null && s.taps.length ? round(s.taps.at(-1)!.t - s.respStart) : null);

  const hesitations: Hesitation[] = [];
  for (const s of seqs)
    for (let k = 1; k < s.taps.length; k++) {
      const gap = s.taps[k].t - s.taps[k - 1].t;
      if (gap >= HESITATION_MS)
        hesitations.push({ startMs: round(s.taps[k - 1].t - (s.respStart ?? 0))!, durationMs: round(gap)!, location: `seq ${s.i + 1} (len ${s.length}) · before item ${k + 1}` });
    }


  const validity: ValidityFlag[] = [];
  const fast = seqs.filter((s) => (firstTap(s) ?? Infinity) < ANTICIPATION_MS).length;
  if (fast >= 2) validity.push({ code: "too_fast", label: "Implausibly fast", detail: `First tap under ${ANTICIPATION_MS} ms on ${fast} sequences.` });
  const idle = seqs.filter((s) => s.timedOut);
  if (idle.length) validity.push({ code: "inactivity", label: "Timed out", detail: `${idle.length} sequence${idle.length === 1 ? "" : "s"} timed out.` });
  if (usedMouse(events, ctx.inputType)) validity.push({ code: "mouse_input", label: "Mouse input", detail: "Taps made with a mouse; tap timing is not comparable to touch." });
  validity.push(...interruptionFlag(events));

  const m = (key: string, label: string, value: number | null, unit: Metric["unit"], kind: Metric["kind"], worse?: Metric["worse"], na?: string): Metric => ({
    key,
    label,
    value,
    unit,
    kind,
    ...(worse && { worse }),
    ...(value == null && na && { na }),
  });

  return {
    taskType: "spatial-span",
    metricsVersion: "",
    taskVersion: ctx.taskVersion,
    metrics: [
      m("maxSpan", "Max span", correct.length ? Math.max(...correct.map((s) => s.length)) : 0, "items", "score", "lower"),
      m("sequencesCorrect", "Sequences correct", correct.length, "count", "score", "lower"),
      m("sequences", "Sequences attempted", seqs.length, "count", "score"),
      m("errors", "Incorrect sequences (incl. timeouts)", seqs.length - correct.length, "count", "score"),
      m("ttfr", "Time to first tap (seq 1)", seqs[0] ? firstTap(seqs[0]) : null, "ms", "process"),
      m("meanResponseMs", "Mean response duration", round(mean(seqs.map(duration).filter((v): v is number => v != null))), "ms", "process"),
      m("earlyResponses", "Taps before the response window", earlyResponseCount(events), "count", "process"),
      m("hesitations", "Pauses ≥ 500 ms between taps", hesitations.length, "count", "process"),
      m("hesitationMs", "Pause total time", round(hesitations.reduce((s, h) => s + h.durationMs, 0)), "ms", "process"),
      m("recoveryMs", "Error recovery (first-tap Δ after error)", null, "ms", "process", undefined, "not meaningful: confounded by sequence length"),
      m("slowing", "Slowing first→last third", null, "fraction", "process", undefined, "not meaningful: sequence length increases"),
    ],
    validity,
    charts: {
      trials: seqs.map((s) => ({ i: s.i, rtMs: duration(s), correct: s.correct, kind: `len ${s.length}` })),
      hesitations,
    },
  };
}
