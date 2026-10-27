# Pathwise — Project Specification

Version 0.1 · Metrics v1.0.0 · Task protocols `tmt-1`, `gng-1`, `flanker-1`, `span-1`

> Sections 1–15 describe what is built. §16 lists v0.2 changes that are decided but **not yet implemented**; where they conflict, §16 is the target.

## 1. Purpose

Pathwise administers short, game-like cognitive tasks to children (ages 5–13) on a tablet or laptop and gives clinicians the resulting **data**: conventional task scores, process measures derived from the full pointer/response stream, validity flags, charts, and change across sessions.

It is a screening and process-data tool to support clinical judgment. **It is not a diagnostic instrument.** The clinician view contains data, charts and flags only; the system never generates narrative interpretation.

### Goals

1. Capture every stimulus and response event with high-resolution timing, so any metric can be recomputed later.
2. Compute metrics in one pure, versioned, unit-tested module.
3. Compare to normative data **only** where published norms apply to the exact administration, with the citation shown.
4. Make data quality visible (validity flags) next to every score.
5. Support repeated administration (alternate forms, session-over-session trends).

### Non-goals (this version)

- Diagnosis, risk scores, or auto-written reports.
- Invented or estimated norms.
- Camera, microphone or any computer vision.
- External services, accounts or API keys (runs locally on SQLite).
- Authentication and multi-tenant access control (see §12).

## 2. Users and surfaces

| Surface | User | Purpose |
|---|---|---|
| `/test` setup | Clinician / supervising adult | Choose clinician; create or select a pseudonymous patient (code, age, grade, dominant hand); choose protocol |
| `/test` runner | Child | Instructions → practice (with feedback) → test (no feedback) for each task; large touch targets |
| `/dashboard` | Clinician | Patient list |
| `/dashboard/patients/:id` | Clinician | Score tables, norm comparison and flags, validity flags, charts, path replay, session-over-session trend, CSV/JSON export |

## 3. Battery

Administered in this order. "Quick" is a shortened demo protocol (no practice; not comparable to standard and labeled as such everywhere).

| # | Task (child-facing name) | Domain | Standard test round | Practice | Quick |
|---|---|---|---|---|---|
| 1 | Trail Making A/B ("Dot Trails") | processing speed / set-shifting | Part A 15 circles (1–15); Part B 15 circles (1-A-2-B…8) | 4 + 4 circles | 8 + 8 circles |
| 2 | Go/No-Go ("Star Stopper") | inhibition | 40 trials, 10 no-go (red star) | 8 trials (2 no-go) | 8 trials (2 no-go) |
| 3 | Flanker ("Fish Friends") | selective attention | 32 trials: 2 conditions × 2 directions × 8 | 6 trials | 6 trials |
| 4 | Spatial span, Corsi-style ("Firefly Path") | visuospatial working memory | Adaptive (below) | 2 sequences of length 2 | lengths 2 and 3, one each |

All paradigms are open/public-domain designs implemented with original stimuli.

### 3.1 Trail Making

- Child draws with finger, pen or mouse from circle to circle in order. Part A: numbers. Part B: alternate number/letter.
- Entering a not-yet-connected circle other than the target is an **error**: it flashes, the line since the last correct circle is erased, and the child must return to the last correct circle (as an examiner would correct on paper). Time keeps running.
- Circles already connected are ignored when crossed.
- **Alternate forms:** 3 fixed layouts per part and size (seeded). The server assigns form = (patient's prior session count) mod 3. Practice always uses form 0.
- **Layout constraints:** circles ≥ 0.16 board widths apart (15 circles); no circle within 1.6 radii of the straight line between consecutive targets; total straight-line path length within ±4% of a fixed target (4.6 board widths for 15 circles, 2.9 for 8, 1.55 for 4) so forms and parts are comparable.
- **Physical size:** board targets 130 mm nominal (96 CSS px/in); circles are defined in board units so size and spacing scale with the board. The board shrinks only if the viewport cannot fit it. Actual board px, nominal mm, viewport and devicePixelRatio are recorded.

### 3.2 Go/No-Go

- Stimulus 500 ms; ISI jittered uniformly 1000–1500 ms; fixed SOA (window stays open after a response; later responses ignored).
- Respond (tap anywhere / Space) to every shape except the red star (25% of trials). First two trials are go; at most 2 no-go in a row.
- Response window = onset → next onset, so late responses during the ISI count for the current trial.

### 3.3 Flanker

- Fixation 500 ms, then five fish; respond to the middle fish's direction (on-screen arrows or ←/→). 3000 ms limit.
- Congruent / incongruent 50/50, balanced for direction; at most 3 of the same condition or direction in a row. Inter-trial blank 600–900 ms.

### 3.4 Spatial span (Corsi-style)

- 9 fixed tiles (original layout). Each item lit 700 ms, 300 ms gap; no repeats within a sequence.
- Start at length 2. Two correct at a length → length + 1. Two incorrect at one length → stop. Maximum length 9; at most 24 sequences.
- Response window: `length` taps; timeout 4000 + 2500 × length ms.

## 4. Timing model

- Stimulus changes are committed synchronously (`flushSync`); **onset** = `requestAnimationFrame` timestamp of the frame that paints the change.
- **Response time** = input event `timeStamp` − onset (same high-resolution clock). Input before onset is ignored; key auto-repeat is ignored.
- Stimulus offsets, presentation durations and deadlines are evaluated every frame and land on the first frame within half a frame of target; measured durations are recorded.
- Verified in Chromium with scripted input: Go/No-Go stimulus 499–501 ms; span tiles 699–701 ms; RTs within ~±20 ms of scripted delays.
- A hidden tab pauses the task (rAF stops) rather than producing invalid trials.

## 5. Raw events

Every task phase produces an ordered array of:

```ts
type RawEvent = { t: number; type: string; x?: number; y?: number; d?: Record<string, unknown> };
// t = ms from the start of the phase (performance clock, 0.1 ms resolution)
// x, y = board-normalized 0–1 (3 decimals) when the event has a position
```

| Task | Event types (`d` payload) |
|---|---|
| all | `task_start` (protocol parameters), `task_end` |
| Trail Making | `part_start` {part, n, form, radius, circles[], boardPx, boardMm, targetMm, dpr, viewport} · `pointer_down` {pointerType} · `pointer_move` {hover?} · `pointer_up` · `connect` {part, index} · `error` {part, expected, touched} · `return` {part, index} · `part_end` {part} |
| Go/No-Go | `stim_on` {i, shape, go, isi} · `stim_off` {i} · `response` {i, input} · `trial_end` {i} |
| Flanker | `fixation_on` {i} · `stim_on` {i, condition, target, flankers} · `response` {i, dir} · `timeout` {i} |
| Spatial span | `seq_start` {i, length, sequence[]} · `tile_on` / `tile_off` {i, k, tile} · `response_start` {i} · `tap` {i, tile} (x, y = tile centre) · `seq_end` {i, timedOut} |

Correctness and outcomes are **not** stored in events; they are derived by `lib/metrics` from stimuli and responses.

Events are stored gzip-compressed per (session, task, phase) and can be exported in full.

## 6. Metrics (`src/lib/metrics`, v1.0.0)

Pure TypeScript: `computeMetrics(taskType, events, { taskVersion, inputType }) → TaskMetrics`. No React, DOM or I/O. Each metric has `kind: "score"` (conventional) or `"process"` (exploratory — no established norms), and for scores a `worse` direction used by norm flags.

Bump `METRICS_VERSION` on any change to a definition. The version is stored with every result and displayed on every result in the dashboard; trends warn when versions are mixed.

Shared constants: anticipation < 150 ms; hesitation ≥ 500 ms; inactivity > 10 s; Trail Making "near-zero movement" = within 0.02 board widths.

### 6.1 Trail Making

| Key | Kind | Definition |
|---|---|---|
| `timeA`, `timeB` | score | `part_end` − `part_start` (ms) — includes time to first touch |
| `errorsA`, `errorsB` | score | count of `error` events |
| `diffBA` | score | timeB − timeA |
| `ratioBA` | score | timeB / timeA |
| `ttfrA`, `ttfrB` | process | first `pointer_down` − `part_start` |
| `hesitations`, `hesitationMs` | process | count / total of intervals ≥ 500 ms where the pointer stays within 0.02 board widths of an anchor sample (held still or lifted — gaps without samples count as no movement), between first touch and completion. Location = segment being attempted (e.g. `3→C`) |
| `hesitationsBeforeLettersB` | process | Part B hesitations whose target is a letter |
| `recoveryMs` | process | mean of (next `connect` after an error − error time), both parts |
| `slowingA`, `slowingB` | process | (mean of last third of segment times − mean of first third) / first third; needs ≥ 6 segments |
| `pathEfficiencyA/B` | process | straight-line centre-to-centre length / pen-down drawn length (capped at 1) |
| `liftsA`, `liftsB` | process | `pointer_up` events while down, before completion |

Chart data: per-segment times with error/hesitation counts; first/last-third means per part; hesitation list with board coordinates.

### 6.2 Go/No-Go

| Key | Kind | Definition |
|---|---|---|
| `hits`, `omissions` | score | go trials with / without a response |
| `commissions` | score | no-go trials with a response |
| `goTrials`, `nogoTrials` | score | counts |
| `meanRt`, `sdRt` | score | mean / sample SD of hit RTs ≥ 150 ms |
| `ttfr` | process | RT of the first response |
| `postErrorMs` | process | mean RT on go trials immediately after an error − mean RT on other valid hits |
| `slowing` | process | first vs last third of valid hit RTs |

### 6.3 Flanker

| Key | Kind | Definition |
|---|---|---|
| `accuracy`, `accCongruent`, `accIncongruent` | score | proportion correct (no response = incorrect) |
| `errors`, `noResponse` | score | counts |
| `rtCongruent`, `rtIncongruent` | score | mean RT of correct responses ≥ 150 ms |
| `flankerEffect` | score | rtIncongruent − rtCongruent |
| `ttfr`, `postErrorMs`, `slowing` | process | as Go/No-Go (on correct responses) |

### 6.4 Spatial span

| Key | Kind | Definition |
|---|---|---|
| `maxSpan` | score | longest sequence reproduced correctly (0 if none) |
| `sequencesCorrect`, `sequences`, `errors` | score | counts |
| `ttfr` | process | first tap − `response_start`, sequence 1 |
| `meanResponseMs` | process | mean (last tap − `response_start`) |
| `hesitations`, `hesitationMs` | process | inter-tap gaps > 500 ms |
| `recoveryMs` | process | mean first-tap latency after an incorrect sequence − after a correct one |
| `slowing` | process | always n/a — sequence length increases across the task |

## 7. Validity flags

Heuristic data-quality checks on the administration (not norms), shown next to scores and exported.

| Code | Trail Making | Go/No-Go, Flanker | Spatial span |
|---|---|---|---|
| `too_fast` | mean segment < 150 ms | ≥ 20% of responses < 150 ms (≥ 4 responses) | first tap < 150 ms on ≥ 2 sequences |
| `inactivity` | any gap > 10 s with no pointer events (incl. onset → first touch) | > 10 s with no response | sequence timed out or first tap > 10 s |
| `pen_lifts` | lifts > circles in the part | — | — |
| `mouse_input` | any `pointer_down` with pointerType `mouse` (or session input type mouse) | session input type mouse | session input type mouse |
| `small_board` | board < 85% of 130 mm nominal | — | — |

## 8. Norms (`src/lib/norms`)

- `norms.json` holds, per task, a status and optional per-metric published norms: `{ citation, administration, bands: [{ ageMin, ageMax, mean, sd, n }] }`.
- **Policy:** only published, public norms for the exact administration, with a full citation. Never estimate or invent values. Process metrics are never normed.
- **Current state:** every task is a labeled **placeholder**. Published child norms exist for the paper Trail Making Test and the physical Corsi board, but item count, layout, timing and input device differ, so they are not applied.
- Comparison: z = (value − mean) / SD; percentile = Φ(z); **flag when |z| > 1.5 in the metric's worse direction**. Statuses: `compared`, `no_band`, `placeholder`, `exploratory`, `missing_value`.
- The z/percentile/flag path is covered by unit tests using a clearly marked test fixture.

## 9. Data model (Prisma, SQLite)

| Model | Fields |
|---|---|
| Clinician | id, name |
| Patient | id, **code** (unique, pseudonymous: 3–20 of A–Z 0–9 -), age, grade, dominantHand, isSample, createdAt — **no names** |
| Session | id, patientId, clinicianId, protocol (`standard`/`quick`), startedAt, completedAt, deviceInfo (JSON: userAgent, platform, devicePixelRatio, maxTouchPoints, viewport), screenWidth, screenHeight, inputType |
| TaskResult | id, sessionId, taskType, version (metrics), metrics (JSON: TaskMetrics incl. validity + chart data), normComparison (JSON), createdAt · unique (sessionId, taskType) |
| RawEventLog | id, sessionId, taskType, phase (`practice`/`test`), taskVersion, eventCount, data (gzip JSON), createdAt · unique (sessionId, taskType, phase) |

A session is marked complete when all four tasks have results.

## 10. API

All JSON; errors are `{ error }` with 4xx/5xx status.

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/clinicians` | — | Clinician[] |
| POST | `/api/sessions` | `{ clinicianId, patientId? \| patient: { code, age, grade, dominantHand }, protocol?, device: { info, screenWidth, screenHeight, inputType } }` | 201 `{ session, patient, trailForm }` (upserts patient by code) |
| POST | `/api/sessions/:id/events` | `{ taskType, phase, taskVersion, events: RawEvent[] }` | 201 `{ id, eventCount, bytes }` |
| GET | `/api/sessions/:id/events?taskType=&phase=` | — | `{ taskVersion, events }` |
| POST | `/api/sessions/:id/results` | `{ taskType }` | 201 parsed TaskResult — **server computes** metrics + norms from stored test events |
| GET | `/api/sessions/:id` | — | session + patient + clinician + results + event-log summary |
| GET | `/api/sessions/:id/export?format=csv\|json` | — | CSV: one row per metric (session, patient code, protocol, input, task/metrics versions, form, value, unit, kind, norm status/z/percentile/flag/citation, validity codes). JSON: session, results and all raw events |
| GET | `/api/patients` | — | patients with session counts |
| GET | `/api/patients/:id` | — | patient + sessions (oldest → newest) with parsed results |

Client upload path: after each round the runner queues `events` (practice and test) and `results` (test) uploads in order, in the background, with retries (3 attempts, exponential backoff) and a visible "Retry save" on failure. The "Open in dashboard" link enables only once everything is saved.

## 11. Dashboard

- **Patient list:** code, SAMPLE badge, age, grade, hand, completed sessions, last session.
- **Patient page:** sample-data banner when applicable; session-over-session line chart for any score metric (hollow point = quick protocol, red outline = norm flag; warns on mixed metrics versions); session picker; session metadata (clinician, protocol, input, screen, DPR); CSV/JSON export.
- **Per task:** metrics version, protocol version, form; validity flag chips; score table (value, norm comparison, red ">1.5 SD" flag); process metrics labeled exploratory; charts (Recharts) —
  - Trail Making: per-segment time (Parts A and B; outlined bar = segment with error; dot = hesitation), hesitation locations on the board (size = duration), first vs last third, path replay (play/pause, 1/2/4×, scrubber, hesitations highlighted, errors marked, click a hesitation to jump).
  - RT tasks / span: per-trial (or per-sequence) times (filled = correct, outlined = error, top row = no response); first vs last third.
- Encodings never rely on colour alone (fill/outline, icons, labels).

## 12. Privacy and security

- Patients are pseudonymous codes; the setup screen instructs not to enter names. No free-text fields besides grade.
- No third-party requests; no camera or microphone.
- **Not production-ready for PHI:** there is no authentication, authorization, audit log or encryption at rest. Add these before any real patient data.

## 13. Sample data

`npm run db:setup` seeds 3 fictional patients (`SAMPLE-A01/B02/C03`, `isSample = true`, labeled "SAMPLE DATA" in the UI and exports) with 3–4 sessions each, generated by `src/lib/sim` (same event vocabulary as live tasks) and scored by the same server path. Profiles: improving over four sessions; stable with frequent Part B errors and more lifts; typical with one mouse-input session including a 12 s pause (validity flags). The seed is idempotent.

## 14. Testing

- `npm test` (Vitest): Trail Making times, B−A, B/A, errors, hesitation detection and location, path efficiency, validity flags; layouts for every part × size × form with matched path length; Go/No-Go and Flanker scoring and anticipation flag; span scoring and pauses; norms placeholder policy, exploratory status, z/percentile/flag math.
- End-to-end (Chromium, scripted): `/test` setup → all four tasks (standard with practice, and quick) → results saved → dashboard renders all tasks with metrics version → replay → CSV and JSON export; zero console errors.

## 15. Known limitations and open items

- No applicable published norms yet; z-scores and flags will appear only once validated norms are entered.
- Physical size is nominal (CSS mm); true size varies by device. Device data is recorded to allow later correction or per-device calibration.
- Input type at session level is inferred from `(pointer: coarse)`; Trail Making also records per-stroke pointerType.
- Hesitation and validity thresholds are fixed heuristics pending empirical work.
- No authentication or PHI safeguards (§12).
- Not yet tested with children or on iPad Safari hardware.
- **Low trial counts.** Go/No-Go has 10 no-go trials (commission rate moves in 10% steps); Flanker has 8 trials per cell, and flanker effects are unreliable at that count, especially with few correct incongruent trials. A 25% no-go rate at a 1.5–2 s pace may produce ceiling effects on commissions.
- **Normality.** Percentile = Φ(z) assumes normal data; completion times and RTs are right-skewed. Any norms added must state whether they are on raw, log-transformed or empirical-percentile scales, and the comparison must follow that.
- **Absolute timing.** The rAF timestamp marks the start of the frame, not when it reaches the display, and touchscreen input latency varies by device by tens of ms. Scripted Chromium tests cannot measure either. Within-device trends are sound; cross-device comparison and any future norms carry this offset.

## 16. v0.2 changes (decided, not yet implemented)

### 16.1 Data integrity

- **Age per session.** `Session` gains `ageYears`, `ageMonths` and `grade`, recorded at administration; norm comparison uses session age. `Patient` keeps `code`, `dominantHand`, `isSample`. `POST /api/sessions` with an existing code whose submitted fields conflict returns **409** with the stored patient; the setup screen asks the clinician to confirm before continuing.
- **Log all input.** Nothing is dropped at capture. Input before onset is logged as `response` / `tap` with `d.early = true`; Go/No-Go responses after the first with `d.extra = true`; key auto-repeat with `d.repeat = true`. Metrics skip flagged events unless a metric names them. New process metric `earlyResponses` (Go/No-Go, Flanker, span).
- **Interruptions.** New events `visibility_hidden` / `visibility_visible` {pausedMs}. New validity flag `interrupted` (any hidden period). Trail Making times exclude paused time; the flag is still raised.
- **Re-scoring.** `npm run rescore` recomputes `TaskResult`s from stored events with the current `METRICS_VERSION`. `TaskResult` becomes unique on (sessionId, taskType, version); the dashboard shows the newest version and older ones are kept.
- **Per-response input type.** Every Go/No-Go, Flanker and span response records `pointerType`; `mouse_input` uses it instead of the session-level `(pointer: coarse)` inference.
- **Patient management.** `PATCH /api/patients/:id` (dominantHand); `DELETE /api/patients/:id` removes the patient and all sessions, results and event logs.

### 16.2 Administration with children

- **Instructions.** The supervising adult reads a fixed script shown on the instruction screen while the child watches an animated demo. (Recorded audio narration is future work.)
- **Practice criterion.** Trail Making: practice completed; Go/No-Go: ≥ 6/8 correct; Flanker: ≥ 4/6; span: ≥ 1/2. If not met, practice repeats once; if still not met, the adult chooses continue or skip. Logged as `practice_repeat` / `task_skipped`.
- **Skip / abort.** The adult can skip the current task via a control hidden from the child (Esc, or long-press a corner). A skipped task gets a `TaskResult` with status `skipped`. A session is complete when every task has a result or a skip. Trail Making form assignment counts only completed standard sessions.
- **Part B age gate.** Part B is off by default under age 8 (setup toggle to override, logged). `hesitationsBeforeLettersB` is replaced by `letterHesitationRatio` = hesitations per letter-target segment ÷ hesitations per number-target segment, reported only at age ≥ 8.
- **Child variant (roadmap, not v0.2).** A Part B variant for ages 5–7 that alternates colour instead of letters (Color Trails–style design, original stimuli), with its own form layouts and no norms.

### 16.3 Definitions resolved

- **Trail Making errors.** One error per departure: further wrong circles crossed before returning to the last correct circle are not counted. After a lift, the child resumes from the last connected circle; touching down elsewhere draws nothing until they touch it.
- **Board.** Square; "board width" = side length.
- **Hesitation threshold.** ≥ 500 ms in every task (span previously > 500 ms).
- **Go/No-Go.** The trial schedule (stimulus onsets) is fixed in advance and does not move with responses — this replaces "fixed SOA". Go responses < 150 ms count as hits, are excluded from RT, and are counted as `anticipations`. RTs > 1500 ms are excluded from `meanRt` / `sdRt` and counted as `slowResponses`.
- **`postErrorMs`.** Go/No-Go: after commissions only. Flanker: after incorrect responses (not timeouts). n/a unless ≥ 3 post-error trials.
- **Span.** Up to 3 sequences per length (e.g. correct, incorrect, correct advances). `errors` = incorrect sequences, timeouts included. `recoveryMs` is always n/a (confounded by sequence length, like `slowing`).
- **Validity thresholds.** Trail Making `too_fast`: ≥ 3 segments < 150 ms (the old "mean segment < 150 ms" could not fire in practice). Span `inactivity`: any sequence timed out.
