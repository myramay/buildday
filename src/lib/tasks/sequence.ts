export function shuffle<T>(arr: readonly T[], rand: () => number = Math.random): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Longest run of consecutive equal values. */
export function maxRun<T>(arr: readonly T[], key: (x: T) => unknown = (x) => x): number {
  let best = 0;
  let run = 0;
  for (let i = 0; i < arr.length; i++) {
    run = i > 0 && key(arr[i]) === key(arr[i - 1]) ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/** Shuffle until `ok` holds (rejection sampling; constraints here are loose enough to converge fast). */
export function constrainedShuffle<T>(
  arr: readonly T[],
  ok: (seq: T[]) => boolean,
  rand: () => number = Math.random,
): T[] {
  for (let i = 0; i < 1000; i++) {
    const seq = shuffle(arr, rand);
    if (ok(seq)) return seq;
  }
  return shuffle(arr, rand);
}

export function jitter(min: number, max: number, rand: () => number = Math.random): number {
  return Math.round(min + rand() * (max - min));
}
