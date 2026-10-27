/**
 * Recompute every TaskResult from its stored raw test events with the current
 * METRICS_VERSION (run after changing a metric definition). Overwrites results
 * in place.
 */
import { prisma } from "@/lib/db";
import { isTaskType } from "@/lib/events";
import { METRICS_VERSION } from "@/lib/metrics";
import { computeAndStoreResult } from "@/lib/server/results";

async function main() {
  const logs = await prisma.rawEventLog.findMany({ where: { phase: "test" }, select: { sessionId: true, taskType: true } });
  let n = 0;
  for (const { sessionId, taskType } of logs) {
    if (!isTaskType(taskType)) continue;
    await computeAndStoreResult(sessionId, taskType);
    n++;
  }
  console.log(`Rescored ${n} task results with metrics v${METRICS_VERSION}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
