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

/** One score metric across other patients' standard sessions (GET /api/patients/:id/cohort, keyed "taskType:metricKey"). */
export type CohortStatDTO = { q1: number; median: number; q3: number; sessions: number; kids: number; sampleKids: number; ageMin: number; ageMax: number };

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
