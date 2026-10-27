import { prisma } from "@/lib/db";
import { HttpError, handle, parseResult } from "@/lib/server/results";

type Ctx = { params: Promise<{ id: string }> };

/** Patient with full session history (oldest → newest), results parsed. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const p = await prisma.patient.findUnique({
    where: { id },
    include: { sessions: { orderBy: { startedAt: "asc" }, include: { clinician: true, results: true } } },
  });
  if (!p) throw new HttpError(404, "Patient not found");
  return Response.json({
    ...p,
    sessions: p.sessions.map((s) => ({ ...s, deviceInfo: JSON.parse(s.deviceInfo), results: s.results.map(parseResult) })),
  });
});
