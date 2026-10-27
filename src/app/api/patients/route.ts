import { prisma } from "@/lib/db";
import { handle } from "@/lib/server/results";

export const GET = handle(async () => {
  const patients = await prisma.patient.findMany({
    orderBy: [{ isSample: "asc" }, { createdAt: "desc" }],
    include: { sessions: { select: { id: true, startedAt: true, completedAt: true, protocol: true }, orderBy: { startedAt: "desc" } } },
  });
  return Response.json(
    patients.map(({ sessions, ...p }) => ({
      ...p,
      sessionCount: sessions.length,
      completedCount: sessions.filter((s) => s.completedAt).length,
      lastSessionAt: sessions[0]?.startedAt ?? null,
    })),
  );
});
