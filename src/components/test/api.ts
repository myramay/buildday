"use client";

import type { RawEvent, TaskType } from "@/lib/events";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body as T;
}

export type Clinician = { id: string; name: string };
export type PatientSummary = { id: string; code: string; age: number; grade: string; dominantHand: string; isSample: boolean; sessionCount: number; completedCount: number; lastSessionAt: string | null };

export const api = {
  clinicians: () => call<Clinician[]>("/api/clinicians"),
  patients: () => call<PatientSummary[]>("/api/patients"),
  startSession: (body: unknown) =>
    call<{ session: { id: string }; patient: { id: string; code: string }; trailForm: number }>("/api/sessions", { method: "POST", body: JSON.stringify(body) }),
  uploadEvents: (sessionId: string, taskType: TaskType, phase: "practice" | "test", taskVersion: string, events: RawEvent[]) =>
    call(`/api/sessions/${sessionId}/events`, { method: "POST", body: JSON.stringify({ taskType, phase, taskVersion, events }) }),
  scoreTask: (sessionId: string, taskType: TaskType) => call(`/api/sessions/${sessionId}/results`, { method: "POST", body: JSON.stringify({ taskType }) }),
};

/** Retry transient failures (flaky Wi-Fi during a home session) before surfacing an error. */
export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
  throw last;
}

export function deviceSnapshot() {
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  return {
    info: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      devicePixelRatio: window.devicePixelRatio,
      maxTouchPoints: navigator.maxTouchPoints,
      viewport: [window.innerWidth, window.innerHeight],
    },
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    inputType: coarse ? "touch" : "mouse",
  };
}
