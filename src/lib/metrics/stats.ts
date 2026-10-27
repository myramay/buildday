export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;
}

/** Sample SD (n − 1). */
export function sd(xs: number[]): number | null {
  const m = mean(xs);
  if (m == null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
}

export function round(v: number | null | undefined, digits = 0): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** Mean of the first and last thirds of an ordered series. Needs ≥ 6 values. */
export function thirds(xs: number[]): { first: number; last: number } | null {
  if (xs.length < 6) return null;
  const k = Math.floor(xs.length / 3);
  return { first: mean(xs.slice(0, k))!, last: mean(xs.slice(-k))! };
}

/** (last − first) / first, as a fraction. */
export function slowing(t: { first: number; last: number } | null): number | null {
  return t && t.first > 0 ? round((t.last - t.first) / t.first, 3) : null;
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf), for percentiles. */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}
