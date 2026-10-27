/**
 * Seed: fictional SAMPLE data for demos. Three pseudonymous sample patients,
 * each with several sessions over months. Raw events come from the simulator
 * (src/lib/sim) and are scored by the same server code path as real sessions.
 *
 * Idempotent: removes previous sample patients before re-creating them.
 */
import { prisma } from "@/lib/db";
import type { RawEvent, TaskType } from "@/lib/events";
import { computeAndStoreResult, storeEvents } from "@/lib/server/results";
import {
  flankerSimBase,
  gngSimBase,
  mulberry32,
  simulateFlanker,
  simulateGoNoGo,
  simulateSpan,
  simulateTrail,
  spanSimBase,
  trailSimBase,
  type FlankerSimParams,
  type GngSimParams,
  type SpanSimParams,
  type TrailSimParams,
} from "@/lib/sim/simulate";
import { TRAIL_FORMS } from "@/lib/tasks/protocol";

type SessionPlan = {
  date: string;
  input: "touch" | "mouse";
  trail?: Partial<TrailSimParams>;
  gng?: Partial<GngSimParams>;
  flanker?: Partial<FlankerSimParams>;
  span?: Partial<SpanSimParams>;
  /** Simulate a long idle period in Trail Making Part B (validity flag demo). */
  idleB?: boolean;
};

type PatientPlan = { code: string; age: number; grade: string; hand: "left" | "right"; clinician: number; sessions: SessionPlan[] };

const PATIENTS: PatientPlan[] = [
  {
    // Improves across sessions (e.g. during an intervention): faster Part B, fewer commissions.
    code: "SAMPLE-A01",
    age: 9,
    grade: "4",
    hand: "right",
    clinician: 0,
    sessions: [
      { date: "2026-04-14T15:10:00-04:00", input: "touch", trail: { speedB: 0.2, pauseB: 0.3, letterPause: 0.3, errorB: 0.15, fatigue: 0.35 }, gng: { commission: 0.5, rtSdFrac: 0.34 }, flanker: { effect: 190, accI: 0.8 } },
      { date: "2026-06-16T15:05:00-04:00", input: "touch", trail: { speedB: 0.23, pauseB: 0.24, letterPause: 0.22, errorB: 0.1, fatigue: 0.25 }, gng: { commission: 0.4, rtSdFrac: 0.3 }, flanker: { effect: 160, accI: 0.85 } },
      { date: "2026-08-18T15:20:00-04:00", input: "touch", trail: { speedB: 0.26, pauseB: 0.16, letterPause: 0.14, errorB: 0.07, fatigue: 0.15 }, gng: { commission: 0.28, rtSdFrac: 0.25 }, flanker: { effect: 130, accI: 0.9 } },
      { date: "2026-10-20T15:15:00-04:00", input: "touch", trail: { speedB: 0.28, pauseB: 0.12, letterPause: 0.1, errorB: 0.05, fatigue: 0.1 }, gng: { commission: 0.2, rtSdFrac: 0.22 }, flanker: { effect: 110, accI: 0.92 } },
    ],
  },
  {
    // Stable profile with frequent errors in Part B; working-memory span lower.
    code: "SAMPLE-B02",
    age: 7,
    grade: "2",
    hand: "left",
    clinician: 1,
    sessions: [
      { date: "2026-05-05T10:30:00-04:00", input: "touch", trail: { errorA: 0.08, errorB: 0.22, liftRate: 0.35 }, span: { capacity: 3.2 } },
      { date: "2026-07-07T10:15:00-04:00", input: "touch", trail: { errorA: 0.06, errorB: 0.2, liftRate: 0.3 }, span: { capacity: 3.4 } },
      { date: "2026-09-08T10:40:00-04:00", input: "touch", trail: { errorA: 0.07, errorB: 0.21, liftRate: 0.32 }, span: { capacity: 3.3 } },
    ],
  },
  {
    // Typical-looking data; one session done with a mouse and a long pause (validity flags).
    code: "SAMPLE-C03",
    age: 11,
    grade: "6",
    hand: "right",
    clinician: 0,
    sessions: [
      { date: "2026-06-02T16:00:00-04:00", input: "touch" },
      { date: "2026-08-04T16:10:00-04:00", input: "mouse", trail: { pointerType: "mouse", liftRate: 0 }, idleB: true },
      { date: "2026-10-06T16:05:00-04:00", input: "touch" },
    ],
  },
];

const CLINICIANS = ["Dr. Rivera", "Dr. Chen"];

const DEVICE = {
  touch: { info: { userAgent: "Sample data (simulated iPad)", platform: "iPad", devicePixelRatio: 2, maxTouchPoints: 5 }, screenWidth: 1180, screenHeight: 820 },
  mouse: { info: { userAgent: "Sample data (simulated laptop)", platform: "MacIntel", devicePixelRatio: 2, maxTouchPoints: 0 }, screenWidth: 1440, screenHeight: 900 },
};

/** Insert an idle gap into Part B (shift everything after a point by `ms`). */
function insertIdle(events: RawEvent[], ms: number): RawEvent[] {
  const startB = events.find((e) => e.type === "part_start" && e.d?.part === "B")!;
  const cut = startB.t + 6000;
  return events.map((e) => (e.t > cut ? { ...e, t: e.t + ms } : e));
}

async function main() {
  // Clean previous sample data.
  await prisma.patient.deleteMany({ where: { isSample: true } });
  const clinicians = [];
  for (const name of CLINICIANS) {
    clinicians.push((await prisma.clinician.findFirst({ where: { name } })) ?? (await prisma.clinician.create({ data: { name } })));
  }

  let seed = 1;
  for (const p of PATIENTS) {
    const patient = await prisma.patient.create({
      data: { code: p.code, age: p.age, grade: p.grade, dominantHand: p.hand, isSample: true, createdAt: new Date(p.sessions[0].date) },
    });
    for (const [k, plan] of p.sessions.entries()) {
      const startedAt = new Date(plan.date);
      const device = DEVICE[plan.input];
      const session = await prisma.session.create({
        data: {
          patientId: patient.id,
          clinicianId: clinicians[p.clinician].id,
          startedAt,
          deviceInfo: JSON.stringify(device.info),
          screenWidth: device.screenWidth,
          screenHeight: device.screenHeight,
          inputType: plan.input,
        },
      });
      const rand = mulberry32(seed++ * 7919);
      const form = k % TRAIL_FORMS;
      let trail = simulateTrail(rand, { ...trailSimBase(p.age), ...plan.trail }, { n: 15, form });
      if (plan.idleB) trail = insertIdle(trail, 12_000);
      const streams: [TaskType, string, RawEvent[]][] = [
        ["trail-making", "tmt-1", trail],
        ["go-no-go", "gng-1", simulateGoNoGo(rand, { ...gngSimBase(p.age), ...plan.gng })],
        ["flanker", "flanker-1", simulateFlanker(rand, { ...flankerSimBase(p.age), ...plan.flanker })],
        ["spatial-span", "span-1", simulateSpan(rand, { ...spanSimBase(p.age), ...plan.span })],
      ];
      for (const [taskType, version, events] of streams) {
        await storeEvents(session.id, taskType, "test", version, events);
        await computeAndStoreResult(session.id, taskType);
      }
      await prisma.session.update({ where: { id: session.id }, data: { completedAt: new Date(startedAt.getTime() + 9 * 60_000) } });
    }
    console.log(`  ${p.code}: ${p.sessions.length} sessions`);
  }
  console.log("Seeded sample data (fictional).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
