import { flanker } from "./flanker";
import { goNoGo } from "./go-no-go";
import { spatialSpan } from "./spatial-span";
import { trailMaking } from "./trail-making";
import type { Task } from "./types";

/** The battery, in administration order. */
export const BATTERY: Task[] = [trailMaking, goNoGo, flanker, spatialSpan];

export function getTask(id: string): Task | undefined {
  return BATTERY.find((t) => t.id === id);
}
