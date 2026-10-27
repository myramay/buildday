import { prisma } from "@/lib/db";
import { handle } from "@/lib/server/results";

export const GET = handle(async () => Response.json(await prisma.clinician.findMany({ orderBy: { name: "asc" } })));
