import { prisma } from "@/lib/db";
import { HttpError, handle, readJson } from "@/lib/server/results";
import { TRAIL_FORMS } from "@/lib/tasks/protocol";

const HANDS = ["left", "right", "unknown"];
const INPUTS = ["touch", "mouse", "pen", "unknown"];

/**
 * Start a session. Body:
 * { clinicianId, patientId? | patient: { code, age, grade, dominantHand }, protocol?, device: { info, screenWidth, screenHeight, inputType } }
 * Returns the session plus the Trail Making form to administer (rotates per patient).
 */
export const POST = handle(async (req: Request) => {
  const b = await readJson(req);
  const clinicianId = String(b.clinicianId ?? "");
  if (!(await prisma.clinician.findUnique({ where: { id: clinicianId } }))) throw new HttpError(400, "Unknown clinicianId");

  let patient;
  if (typeof b.patientId === "string") {
    patient = await prisma.patient.findUnique({ where: { id: b.patientId } });
    if (!patient) throw new HttpError(400, "Unknown patientId");
  } else {
    const p = (b.patient ?? {}) as Record<string, unknown>;
    const code = String(p.code ?? "").trim().toUpperCase();
    const age = Number(p.age);
    if (!/^[A-Z0-9-]{3,20}$/.test(code)) throw new HttpError(400, "Patient code must be 3–20 letters, digits or dashes (no names)");
    if (!Number.isInteger(age) || age < 4 || age > 18) throw new HttpError(400, "Age must be an integer 4–18");
    const hand = HANDS.includes(String(p.dominantHand)) ? String(p.dominantHand) : "unknown";
    const grade = String(p.grade ?? "").slice(0, 20);
    patient = await prisma.patient.upsert({
      where: { code },
      create: { code, age, grade, dominantHand: hand },
      update: { age, grade, dominantHand: hand },
    });
  }

  const device = (b.device ?? {}) as Record<string, unknown>;
  const priorSessions = await prisma.session.count({ where: { patientId: patient.id } });
  const session = await prisma.session.create({
    data: {
      patientId: patient.id,
      clinicianId,
      protocol: b.protocol === "quick" ? "quick" : "standard",
      deviceInfo: JSON.stringify(device.info ?? {}),
      screenWidth: Math.round(Number(device.screenWidth) || 0),
      screenHeight: Math.round(Number(device.screenHeight) || 0),
      inputType: INPUTS.includes(String(device.inputType)) ? String(device.inputType) : "unknown",
    },
  });
  return Response.json({ session, patient, trailForm: priorSessions % TRAIL_FORMS }, { status: 201 });
});
