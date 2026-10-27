import { gunzipSync, gzipSync } from "node:zlib";
import { prisma } from "@/lib/db";
import { isTaskType, TASK_TYPES, type RawEvent, type TaskType } from "@/lib/events";
import { computeMetrics, type TaskMetrics } from "@/lib/metrics";
import { compareToNorms, type NormComparison } from "@/lib/norms";

/** Raw events are stored as gzip-compressed JSON. */
export const packEvents = (events: RawEvent[]) => new Uint8Array(gzipSync(JSON.stringify(events)));
export const unpackEvents = (data: Uint8Array): RawEvent[] => JSON.parse(gunzipSync(data).toString("utf8"));

export async function storeEvents(sessionId: string, taskType: TaskType, phase: "practice" | "test", taskVersion: string, events: RawEvent[]) {
  const data = packEvents(events);
  return prisma.rawEventLog.upsert({
    where: { sessionId_taskType_phase: { sessionId, taskType, phase } },
    create: { sessionId, taskType, phase, taskVersion, eventCount: events.length, data },
    update: { taskVersion, eventCount: events.length, data },
  });
}

export async function loadEvents(sessionId: string, taskType: TaskType, phase: "practice" | "test" = "test") {
  const log = await prisma.rawEventLog.findUnique({ where: { sessionId_taskType_phase: { sessionId, taskType, phase } } });
  return log ? { taskVersion: log.taskVersion, events: unpackEvents(log.data) } : null;
}

/**
 * (Re)compute a task's metrics from its stored raw events and save the result.
 * The server is the single source of truth for scoring; clients only upload events.
 */
export async function computeAndStoreResult(sessionId: string, taskType: TaskType) {
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { patient: true } });
  if (!session) throw new HttpError(404, "Session not found");
  const raw = await loadEvents(sessionId, taskType);
  if (!raw) throw new HttpError(409, `No test events uploaded for ${taskType}`);

  const metrics = computeMetrics(taskType, raw.events, { taskVersion: raw.taskVersion, inputType: session.inputType });
  const norms = compareToNorms(taskType, metrics.metrics, session.patient.age);
  const result = await prisma.taskResult.upsert({
    where: { sessionId_taskType: { sessionId, taskType } },
    create: { sessionId, taskType, version: metrics.metricsVersion, metrics: JSON.stringify(metrics), normComparison: JSON.stringify(norms) },
    update: { version: metrics.metricsVersion, metrics: JSON.stringify(metrics), normComparison: JSON.stringify(norms) },
  });

  // Session is complete once every task in the battery has a result.
  const count = await prisma.taskResult.count({ where: { sessionId } });
  if (count >= TASK_TYPES.length && !session.completedAt) {
    await prisma.session.update({ where: { id: sessionId }, data: { completedAt: new Date() } });
  }
  return parseResult(result);
}

export type ParsedResult = {
  id: string;
  taskType: TaskType;
  version: string;
  metrics: TaskMetrics;
  normComparison: Record<string, NormComparison>;
  createdAt: Date;
};

export function parseResult(r: { id: string; taskType: string; version: string; metrics: string; normComparison: string; createdAt: Date }): ParsedResult {
  if (!isTaskType(r.taskType)) throw new Error(`Unknown task type ${r.taskType}`);
  return { id: r.id, taskType: r.taskType, version: r.version, metrics: JSON.parse(r.metrics), normComparison: JSON.parse(r.normComparison), createdAt: r.createdAt };
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Wrap a route handler: HttpError → JSON error with status; anything else → 500. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {}
  throw new HttpError(400, "Body must be a JSON object");
}
