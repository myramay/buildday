import type { RawEvent } from "@/lib/events";
import { mean, round, sd, slowing, thirds } from "./stats";
import { ANTICIPATION_MS, INACTIVITY_MS, type Metric, type MetricsContext, type TaskMetrics, type TrialPoint, type ValidityFlag } from "./types";

/* Shared helpers for the single-response RT tasks (Go/No-Go, Flanker). */

type Trial = { i: number; onset: number; rt: number | null; data: Record<string, unknown> };

/** Pair stim_on with its response (by trial index). */
function trialsFrom(events: RawEvent[]): Trial[] {
  const responses = new Map<number, number>();
  for (const e of events) if (e.type === "response" && typeof e.d?.i === "number" && !responses.has(e.d.i)) responses.set(e.d.i, e.t);
  return events
    .filter((e) => e.type === "stim_on")
    .sort((a, b) => a.t - b.t)
    .map((e) => {
      const i = e.d!.i as number;
      const r = responses.get(i);
      return { i, onset: e.t, rt: r == null ? null : round(r - e.t), data: { ...e.d, response: events.find((x) => x.type === "response" && x.d?.i === i)?.d } };
    });
}

/** Mean RT right after an error minus mean RT elsewhere (post-error slowing). */
function postErrorDelta(rts: { rt: number | null; error: boolean; valid: boolean }[]) {
  const after: number[] = [];
  const other: number[] = [];
  rts.forEach((t, k) => {
    if (!t.valid || t.rt == null) return;
    (k > 0 && rts[k - 1].error ? after : other).push(t.rt);
  });
  const a = mean(after);
  const o = mean(other);
  return a != null && o != null ? round(a - o) : null;
}

/** Longest stretch with no response while the task was presenting stimuli. */
function longestSilence(trials: Trial[], end: number): number {
  const marks = [trials[0]?.onset ?? 0, ...trials.filter((t) => t.rt != null).map((t) => t.onset + t.rt!), end];
  let gap = 0;
  for (let k = 1; k < marks.length; k++) gap = Math.max(gap, marks[k] - marks[k - 1]);
  return gap;
}

function commonValidity(trials: Trial[], events: RawEvent[], ctx: MetricsContext): ValidityFlag[] {
  const flags: ValidityFlag[] = [];
  const responded = trials.filter((t) => t.rt != null);
  const antic = responded.filter((t) => t.rt! < ANTICIPATION_MS).length;
  if (responded.length >= 4 && antic / responded.length >= 0.2)
    flags.push({ code: "too_fast", label: "Implausibly fast", detail: `${antic} of ${responded.length} responses faster than ${ANTICIPATION_MS} ms.` });
  const end = events.find((e) => e.type === "task_end")?.t ?? (trials.at(-1)?.onset ?? 0);
  const gap = longestSilence(trials, end);
  if (gap > INACTIVITY_MS) flags.push({ code: "inactivity", label: "Inactivity > 10 s", detail: `No response for ${(gap / 1000).toFixed(1)} s.` });
  if (ctx.inputType === "mouse") flags.push({ code: "mouse_input", label: "Mouse input", detail: "Session used a mouse/keyboard; RTs are not comparable to touch." });
  return flags;
}

const m = (key: string, label: string, value: number | null, unit: Metric["unit"], kind: Metric["kind"], worse?: Metric["worse"], na?: string): Metric => ({
  key,
  label,
  value,
  unit,
  kind,
  ...(worse && { worse }),
  ...(value == null && na && { na }),
});

export function computeGoNoGo(events: RawEvent[], ctx: MetricsContext): TaskMetrics {
  const trials = trialsFrom(events);
  const go = trials.filter((t) => t.data.go);
  const nogo = trials.filter((t) => !t.data.go);
  const hits = go.filter((t) => t.rt != null);
  const commissions = nogo.filter((t) => t.rt != null).length;
  const validHitRts = hits.map((t) => t.rt!).filter((rt) => rt >= ANTICIPATION_MS);
  const third = thirds(validHitRts);
  const seq = trials.map((t) => ({
    rt: t.rt,
    error: t.data.go ? t.rt == null : t.rt != null,
    valid: !!t.data.go && t.rt != null && t.rt >= ANTICIPATION_MS,
  }));
  const kind = (t: Trial) => (t.data.go ? (t.rt != null ? "hit" : "omission") : t.rt != null ? "commission" : "correct_withhold");

  return {
    taskType: "go-no-go",
    metricsVersion: "",
    taskVersion: ctx.taskVersion,
    metrics: [
      m("hits", "Hits", hits.length, "count", "score", "lower"),
      m("goTrials", "Go trials", go.length, "count", "score"),
      m("omissions", "Omission errors", go.length - hits.length, "count", "score", "higher"),
      m("commissions", "Commission errors", commissions, "count", "score", "higher"),
      m("nogoTrials", "No-go trials", nogo.length, "count", "score"),
      m("meanRt", "Mean RT (hits)", round(mean(validHitRts)), "ms", "score", "higher"),
      m("sdRt", "RT SD (hits)", round(sd(validHitRts)), "ms", "score", "higher"),
      m("ttfr", "Time to first response", trials.find((t) => t.rt != null)?.rt ?? null, "ms", "process", undefined, "no responses"),
      m("postErrorMs", "Post-error RT change", postErrorDelta(seq), "ms", "process", undefined, "no errors followed by a hit"),
      m("slowing", "Slowing first→last third", slowing(third), "fraction", "process", undefined, "too few hits"),
    ],
    validity: commonValidity(trials, events, ctx),
    charts: {
      trials: trials.map<TrialPoint>((t) => ({ i: t.i, rtMs: t.rt, correct: !seq[trials.indexOf(t)].error, kind: kind(t) })),
      thirds: third ? [{ label: "Hit RT", firstMs: round(third.first)!, lastMs: round(third.last)! }] : [],
    },
  };
}

export function computeFlanker(events: RawEvent[], ctx: MetricsContext): TaskMetrics {
  const trials = trialsFrom(events);
  const dir = (t: Trial) => (t.data.response as { dir?: string } | undefined)?.dir;
  const correct = (t: Trial) => t.rt != null && dir(t) === t.data.target;
  const valid = (t: Trial) => correct(t) && t.rt! >= ANTICIPATION_MS;
  const of = (c: string) => trials.filter((t) => t.data.condition === c);
  const acc = (ts: Trial[]) => (ts.length ? round(ts.filter(correct).length / ts.length, 3) : null);
  const rtOf = (ts: Trial[]) => round(mean(ts.filter(valid).map((t) => t.rt!)));
  const cong = of("congruent");
  const inc = of("incongruent");
  const rtC = rtOf(cong);
  const rtI = rtOf(inc);
  const third = thirds(trials.filter(valid).map((t) => t.rt!));
  const seq = trials.map((t) => ({ rt: t.rt, error: !correct(t), valid: valid(t) }));

  return {
    taskType: "flanker",
    metricsVersion: "",
    taskVersion: ctx.taskVersion,
    metrics: [
      m("accuracy", "Accuracy", acc(trials), "fraction", "score", "lower"),
      m("errors", "Errors", trials.filter((t) => !correct(t)).length, "count", "score", "higher"),
      m("noResponse", "No response", trials.filter((t) => t.rt == null).length, "count", "score", "higher"),
      m("accCongruent", "Accuracy (congruent)", acc(cong), "fraction", "score", "lower"),
      m("accIncongruent", "Accuracy (incongruent)", acc(inc), "fraction", "score", "lower"),
      m("rtCongruent", "Mean RT congruent", rtC, "ms", "score", "higher"),
      m("rtIncongruent", "Mean RT incongruent", rtI, "ms", "score", "higher"),
      m("flankerEffect", "Flanker effect (I − C)", rtC != null && rtI != null ? rtI - rtC : null, "ms", "score", "higher"),
      m("ttfr", "Time to first response", trials[0]?.rt ?? null, "ms", "process", undefined, "no response on trial 1"),
      m("postErrorMs", "Post-error RT change", postErrorDelta(seq), "ms", "process", undefined, "no errors followed by a correct response"),
      m("slowing", "Slowing first→last third", slowing(third), "fraction", "process", undefined, "too few correct responses"),
    ],
    validity: commonValidity(trials, events, ctx),
    charts: {
      trials: trials.map((t) => ({ i: t.i, rtMs: t.rt, correct: correct(t), kind: String(t.data.condition) })),
      thirds: third ? [{ label: "Correct RT", firstMs: round(third.first)!, lastMs: round(third.last)! }] : [],
    },
  };
}
