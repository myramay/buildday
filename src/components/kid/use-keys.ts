import { useEffect, useRef } from "react";

/**
 * Listen for specific keys while mounted. Passes the event's timeStamp (same
 * clock as performance.now()) for precise RT. Auto-repeat is ignored so a held
 * key counts once.
 */
export function useKeys(keys: string[], onKey: (key: string, timeStamp: number) => void) {
  const handler = useRef(onKey);
  useEffect(() => {
    handler.current = onKey;
  });
  const keyList = keys.join("|");

  useEffect(() => {
    const wanted = new Set(keyList.split("|"));
    const listener = (e: KeyboardEvent) => {
      if (!wanted.has(e.key)) return;
      e.preventDefault();
      if (e.repeat) return;
      handler.current(e.key, e.timeStamp);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [keyList]);
}
