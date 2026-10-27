# Pathwise

Touch-based pediatric cognitive tasks (Trail Making A/B, Go/No-Go, Flanker, Corsi-style spatial span) with full raw-event capture, versioned metrics, and a clinician dashboard.

Next.js (App Router) · TypeScript · Tailwind · Prisma + SQLite · Recharts. No external services or API keys.

> Screening and process data to support clinical judgment. **Not a diagnostic instrument.** No norms are applied yet (all entries are labeled placeholders), and there is no authentication — don't store real patient data. Full specification: [`docs/SPEC.md`](docs/SPEC.md).

## Run it

Requires Node.js 20+ and npm.

```bash
npm install            # also runs `prisma generate`
npm run db:setup       # creates prisma/dev.db and seeds 3 fictional SAMPLE patients
npm run dev            # http://localhost:3000
```

- `/test` — clinician setup (pseudonymous code, age, grade, hand, protocol), then the child-facing test
- `/dashboard` — patients → patient page (scores, flags, charts, replay, trends, export)

Other commands:

```bash
npm test               # unit tests for lib/metrics and lib/norms (vitest)
npm run lint
npm run build && npm start
npx prisma db seed     # re-seed sample data (idempotent)
npx prisma studio      # browse the database
```

## Project layout

```
prisma/            schema.prisma, seed.ts (fictional sample data)
docs/SPEC.md       project specification (protocols, events, metric definitions, API)
src/app/
  test/            clinician setup + child-facing test runner
  dashboard/       patient list, patient page
  api/             route handlers (sessions, events, results, export, patients, clinicians)
src/components/
  kid/             child-facing UI pieces (buttons, shapes, instruction demos)
  test/            runner + API client (upload queue with retries)
  dashboard/       score table, Recharts charts, path replay
src/lib/
  tasks/           task UIs, runtime (timing), protocol.ts (pure sequences/layouts)
  metrics/         pure, versioned metric computation + tests
  norms/           norms.json (placeholders) + comparison + tests
  sim/             synthetic event generators (seed, tests)
  server/          event storage (gzip), scoring service, route helpers
```

## Architecture

```
child device (/test)                     server (route handlers)                      SQLite
  task UI ── ctx.log(event) ──▶ POST /api/sessions/:id/events  ──gzip──▶ RawEventLog (per task × phase)
                                POST /api/sessions/:id/results ──▶ lib/metrics + lib/norms ──▶ TaskResult
dashboard ◀── GET /api/patients[/:id], /api/sessions/:id[/events|/export]
```

- **Raw events are the source of truth.** Every task records `{ t, type, x?, y?, d? }` (t = ms on the high-resolution clock, x/y normalized to the board). Trail Making stores every pointer sample, connection, error and return. Events are stored gzip-compressed so metrics can be recomputed later.
- **`src/lib/metrics`** — pure TypeScript (no React/DOM/IO): `computeMetrics(taskType, events, ctx)`. `METRICS_VERSION` is stored with every result; the dashboard shows it on each result and warns when a trend mixes versions. The server computes metrics; clients only upload events.
- **`src/lib/norms`** — `norms.json` + comparison (z, percentile, flag when > 1.5 SD in the worse direction). **Every entry is currently a labeled placeholder**: no published norms apply to these adapted digital administrations. Add a published norm (citation + age bands) to `norms.json` and z-scores/flags appear automatically. Process metrics (hesitations, path efficiency, recovery time, slowing) are always "exploratory — no established norms".
- **`src/lib/tasks`** — task UIs + runtime (frame-accurate timing; onset = rAF timestamp of the painted frame; RT from the input event's own timestamp). `protocol.ts` holds the pure stimulus sequences/layouts shared with metrics and the seed.
- **`src/lib/sim`** — synthetic event generators for the seed script and tests (same event vocabulary as the live tasks).

### Validity flags (heuristics, not norms)

| Flag | Rule |
|---|---|
| Implausibly fast | TMT mean segment < 150 ms; Go/No-Go / Flanker ≥ 20% responses < 150 ms; span first tap < 150 ms on ≥ 2 sequences |
| Inactivity > 10 s | longest stretch with no input (TMT pointer events; RT tasks: no responses) > 10 s; span timeouts |
| Excessive pen lifts | TMT lifts > number of circles in a part |
| Mouse input | pointerType `mouse` in TMT, or session input type `mouse` |
| Board smaller than standard | TMT board < 85% of the 130 mm nominal size (screen too small) |

### Trail Making forms and sizing

- 3 alternate layouts per part (seeded), rotated across a patient's sessions by the server (`trailForm` = prior sessions mod 3); the form is recorded in the events and shown on results. All forms/parts are constrained to the same straight-line path length (±4%) so times are comparable.
- The board targets **130 mm nominal** (96 CSS px/in); circles are defined in board units, so size and spacing scale with it. Browsers don't expose true physical size, so actual board px/mm, viewport, screen size and devicePixelRatio are recorded.

### Data model

`Clinician`, `Patient` (pseudonymous `code`, age, grade, dominant hand, `isSample`), `Session` (protocol, device info, screen size, input type), `TaskResult` (taskType, metrics `version`, metrics JSON, normComparison JSON), `RawEventLog` (gzip JSON per task × phase). See `prisma/schema.prisma`.

## API

| Method | Path | |
|---|---|---|
| POST | `/api/sessions` | `{ clinicianId, patientId? \| patient: { code, age, grade, dominantHand }, protocol?, device }` → `{ session, patient, trailForm }` |
| POST | `/api/sessions/:id/events` | `{ taskType, phase, taskVersion, events }` |
| POST | `/api/sessions/:id/results` | `{ taskType }` → computes + stores metrics from uploaded events |
| GET | `/api/sessions/:id` | session with results |
| GET | `/api/sessions/:id/events?taskType=…` | raw events (used by path replay) |
| GET | `/api/sessions/:id/export?format=csv\|json` | CSV: one row per metric; JSON: everything incl. raw events |
| GET | `/api/patients`, `/api/patients/:id` | list; patient with session history |
| GET | `/api/clinicians` | for the test setup screen |

## Sample data

`npm run db:setup` creates 3 fictional patients (`SAMPLE-A01/B02/C03`, flagged `isSample`, labeled "SAMPLE DATA" in the UI) with 3–4 sessions each: one improving over time, one stable with frequent errors, one including a mouse-input session with a long pause (validity flags).

## Testing

- `npm test` — unit tests for `lib/metrics` (Trail Making timing, hesitations, path efficiency, validity flags, alternate-form layouts; Go/No-Go, Flanker, span scoring) and `lib/norms` (placeholder policy; z/percentile/flag math against a marked test fixture).
- End-to-end was verified in Chromium with scripted input: `/test` → all four tasks (standard with practice, and quick) → results saved → dashboard → path replay → CSV/JSON export, with no console errors.

## Known limitations

- No applicable published norms yet; z-scores and >1.5 SD flags appear only after validated norms are added to `src/lib/norms/norms.json`.
- Board size is nominal (CSS mm); true physical size varies by device (device data is recorded).
- Validity and hesitation thresholds are heuristics.
- No authentication, authorization or encryption at rest.
- Not yet tested with children or on iPad Safari hardware.
