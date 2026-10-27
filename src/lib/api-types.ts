import type { TaskType } from "@/lib/events";
import type { TaskMetrics } from "@/lib/metrics/types";
import type { NormComparison } from "@/lib/norms";

/** Shapes returned by the JSON API (dates arrive as ISO strings). */
export type ResultDTO = {
  id: string;
  taskType: TaskType;
  version: string;
  metrics: TaskMetrics;
  normComparison: Record<string, NormComparison>;
  createdAt: string;
};

export type SessionDTO = {
  id: string;
  patientId: string;
  protocol: "standard" | "quick";
  startedAt: string;
  completedAt: string | null;
  deviceInfo: { userAgent?: string; platform?: string; devicePixelRatio?: number; maxTouchPoints?: number; viewport?: number[] };
  screenWidth: number;
  screenHeight: number;
  inputType: string;
  clinician: { id: string; name: string };
  results: ResultDTO[];
};

export type PatientDTO = {
  id: string;
  code: string;
  age: number;
  grade: string;
  dominantHand: string;
  isSample: boolean;
  createdAt: string;
  sessions: SessionDTO[];
};
