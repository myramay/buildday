"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Zap } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { api, deviceSnapshot, type Clinician, type PatientSummary } from "@/components/test/api";
import { TestRunner, type RunnerSession } from "@/components/test/runner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const GRADES = ["Pre-K", "K", "1", "2", "3", "4", "5", "6", "7", "8"];

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `P-${Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")}`;
}

/** /test — adult setup (pseudonymous patient, clinician, protocol), then the child-facing test. */
export default function TestPage() {
  const [running, setRunning] = useState<RunnerSession | null>(null);
  return running ? <TestRunner s={running} /> : <Setup onStart={setRunning} />;
}

function Setup({ onStart }: { onStart: (s: RunnerSession) => void }) {
  const [clinicians, setClinicians] = useState<Clinician[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [clinicianId, setClinicianId] = useState("");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [patientId, setPatientId] = useState("");
  const [code, setCode] = useState("");
  const [age, setAge] = useState("9");
  const [grade, setGrade] = useState("4");
  const [hand, setHand] = useState<"left" | "right" | "unknown">("right");
  const [protocol, setProtocol] = useState<"standard" | "quick">("standard");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.clinicians(), api.patients()])
      .then(([c, p]) => {
        setClinicians(c);
        setClinicianId(c[0]?.id ?? "");
        setPatients(p);
      })
      .catch((e) => setError(`Couldn't reach the server: ${e.message}`));
  }, []);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.startSession({
        clinicianId,
        ...(mode === "existing" ? { patientId } : { patient: { code, age: Number(age), grade, dominantHand: hand } }),
        protocol,
        device: deviceSnapshot(),
      });
      onStart({ sessionId: res.session.id, patientId: res.patient.id, patientCode: res.patient.code, trailForm: res.trailForm, quick: protocol === "quick" });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const valid = clinicianId && (mode === "existing" ? patientId : code.trim().length >= 3 && Number(age) >= 4);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-10 md:py-14">
        <p className="text-sm font-medium text-primary">Clinician setup</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Start a test session</h1>
        <p className="mt-2 text-muted-foreground">Patients are identified by a pseudonymous code only. Don&apos;t enter names.</p>

        <form onSubmit={start} className="mt-8 flex flex-col gap-6 rounded-2xl border bg-card p-6">
          <Field label="Clinician">
            <select className="h-11 rounded-lg border bg-background px-3 text-base" value={clinicianId} onChange={(e) => setClinicianId(e.target.value)}>
              {clinicians.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="inline-flex w-fit rounded-lg border p-0.5 text-sm">
            {(["new", "existing"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-md px-3 py-1.5 font-medium", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                {m === "new" ? "New patient" : "Existing patient"}
              </button>
            ))}
          </div>

          {mode === "existing" ? (
            <Field label="Patient">
              <select className="h-11 rounded-lg border bg-background px-3 text-base" value={patientId} onChange={(e) => setPatientId(e.target.value)} aria-label="Patient">
                <option value="">Select…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · age {p.age} · {p.sessionCount} session{p.sessionCount === 1 ? "" : "s"}
                    {p.isSample ? " · SAMPLE" : ""}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <>
              <Field label="Patient code" hint="Pseudonymous — letters, digits, dashes">
                <div className="flex gap-2">
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. P-7K3QF"
                    className="h-11 font-mono text-base"
                    aria-label="Patient code"
                  />
                  <Button type="button" variant="outline" className="h-11" onClick={() => setCode(randomCode())}>
                    Generate
                  </Button>
                </div>
              </Field>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Age">
                  <select className="h-11 rounded-lg border bg-background px-3 text-base" value={age} onChange={(e) => setAge(e.target.value)} aria-label="Age">
                    {Array.from({ length: 9 }, (_, i) => i + 5).map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Grade">
                  <select className="h-11 rounded-lg border bg-background px-3 text-base" value={grade} onChange={(e) => setGrade(e.target.value)} aria-label="Grade">
                    {GRADES.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Dominant hand">
                  <select className="h-11 rounded-lg border bg-background px-3 text-base" value={hand} onChange={(e) => setHand(e.target.value as typeof hand)} aria-label="Dominant hand">
                    <option value="right">Right</option>
                    <option value="left">Left</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </Field>
              </div>
            </>
          )}

          <Field label="Protocol">
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["standard", "Standard", "All 4 tasks with practice · ~8 min"],
                  ["quick", "Quick demo", "Shortened, no practice · ~1 min · not comparable"],
                ] as const
              ).map(([value, title, sub]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setProtocol(value)}
                  className={cn("rounded-xl border p-3 text-left", protocol === value ? "border-primary bg-accent/50 ring-1 ring-primary" : "hover:bg-muted/50")}
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    {value === "quick" && <Zap className="size-4 text-primary" />}
                    {title}
                  </span>
                  <span className="block text-xs text-muted-foreground">{sub}</span>
                </button>
              ))}
            </div>
          </Field>

          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={!valid || busy} className="h-12 text-base">
            Start test <ArrowRight />
          </Button>
          <p className="text-center text-xs text-muted-foreground">Then hand the device to the child.</p>
        </form>
      </main>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>
        {label}
        {hint && <span className="font-normal text-muted-foreground">· {hint}</span>}
      </Label>
      {children}
    </div>
  );
}
