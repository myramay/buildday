import type { RawEvent } from "@/lib/events";
import type { ValidityFlag } from "./types";

/** Input logged for completeness (before onset, after the window filled) — never scored as a response. */
export function isFlaggedInput(e: RawEvent): boolean {
  return !!(e.d?.early || e.d?.extra);
}

export function earlyResponseCount(events: RawEvent[]): number {
  return events.filter((e) => e.d?.early).length;
}

/** `interrupted` when the tab was hidden at any point during the phase. */
export function interruptionFlag(events: RawEvent[]): ValidityFlag[] {
  const hidden = events.filter((e) => e.type === "visibility_hidden").length;
  if (!hidden) return [];
  const paused = events.filter((e) => e.type === "visibility_visible").reduce((s, e) => s + ((e.d?.pausedMs as number) ?? 0), 0);
  return [{ code: "interrupted", label: "Interrupted", detail: `Task left the screen ${hidden}× (${(paused / 1000).toFixed(1)} s away).` }];
}

/** Per-press pointer types recorded by the runtime (`input_device`), plus Trail Making's own pointer_down. */
export function usedMouse(events: RawEvent[], sessionInputType?: string): boolean {
  const types = events.filter((e) => e.type === "input_device" || e.type === "pointer_down").map((e) => e.d?.pointerType).filter(Boolean);
  return types.length ? types.includes("mouse") : sessionInputType === "mouse";
}
