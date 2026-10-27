import { prisma } from "@/lib/db";
import { isTaskType, type RawEvent } from "@/lib/events";
import { HttpError, handle, loadEvents, readJson, storeEvents } from "@/lib/server/results";

type Ctx = { params: Promise<{ id: string }> };

/** Upload the raw event stream for one task phase. Body: { taskType, phase: "practice"|"test", taskVersion, events: RawEvent[] } */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await readJson(req);
  if (!isTaskType(b.taskType)) throw new HttpError(400, "Unknown taskType");
  const phase = b.phase === "practice" ? "practice" : "test";
  if (!Array.isArray(b.events) || b.events.some((e) => typeof e?.t !== "number" || typeof e?.type !== "string"))
    throw new HttpError(400, "events must be an array of { t, type, x?, y?, d? }");
  if (!(await prisma.session.findUnique({ where: { id } }))) throw new HttpError(404, "Session not found");
  const events = (b.events as RawEvent[]).slice().sort((a, c) => a.t - c.t);
  const log = await storeEvents(id, b.taskType, phase, String(b.taskVersion ?? "unknown"), events);
  return Response.json({ id: log.id, eventCount: log.eventCount, bytes: log.data.length }, { status: 201 });
});

/** Read back a task's raw events (used by the dashboard's path replay). Query: ?taskType=…&phase=test */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const url = new URL(req.url);
  const taskType = url.searchParams.get("taskType");
  if (!isTaskType(taskType)) throw new HttpError(400, "Unknown taskType");
  const raw = await loadEvents(id, taskType, url.searchParams.get("phase") === "practice" ? "practice" : "test");
  if (!raw) throw new HttpError(404, "No events");
  return Response.json(raw);
});
