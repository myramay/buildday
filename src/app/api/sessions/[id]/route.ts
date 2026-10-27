import { prisma } from "@/lib/db";
import { HttpError, handle, parseResult } from "@/lib/server/results";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await prisma.session.findUnique({
    where: { id },
    include: { patient: true, clinician: true, results: true, events: { select: { taskType: true, phase: true, eventCount: true, taskVersion: true } } },
  });
  if (!s) throw new HttpError(404, "Session not found");
  return Response.json({ ...s, deviceInfo: JSON.parse(s.deviceInfo), results: s.results.map(parseResult) });
});
