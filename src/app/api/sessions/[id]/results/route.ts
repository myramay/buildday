import { isTaskType } from "@/lib/events";
import { HttpError, computeAndStoreResult, handle, readJson } from "@/lib/server/results";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Score a task. Body: { taskType }. Metrics are computed server-side from the
 * uploaded raw events (lib/metrics), compared to norms (lib/norms), and stored
 * with the metrics version.
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const b = await readJson(req);
  if (!isTaskType(b.taskType)) throw new HttpError(400, "Unknown taskType");
  return Response.json(await computeAndStoreResult(id, b.taskType), { status: 201 });
});
