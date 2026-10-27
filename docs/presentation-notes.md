# Pathwise — Presentation Notes

## The one-line pitch

Kids wait months for an evaluation. Pathwise gives clinicians objective data from a 15-minute tablet session, so they can decide who needs to be seen first and walk into the appointment with more information.

> Don't call it a diagnostic tool or say it "tests for autism/ADHD." It's a screening and process-data tool that supports clinical judgment, and the tasks measure attention and executive function, not autism.

## The problem (CDC and WHO stats)

- **Autism, US:** about **1 in 31** eight-year-olds (3.2%) were identified with autism in 2022 (CDC ADDM Network, 2025 report). [CDC MMWR](https://www.cdc.gov/mmwr/volumes/74/ss/ss7402a1.htm)
- **Late diagnosis:** the median age of earliest known autism diagnosis was **47 months, nearly 4 years**. By community it ranged from 36 months to **69.5 months** (CDC, same report).
- **ADHD, US:** an estimated **7 million children aged 3–17 (11.7%)** have a current ADHD diagnosis (CDC, from 2024 national survey data). [CDC ADHD data](https://www.cdc.gov/adhd/data/index.html)
- **Treatment gap:** in 2022, **nearly 1 in 3 (30.1%)** US children with current ADHD received **no ADHD-specific treatment** (CDC study of the 2022 national survey). [CDC study](https://stacks.cdc.gov/view/cdc/160350)
- **Autism, worldwide:** about **1 in 127 people** (WHO, 2021 estimate). In many low- and middle-income countries, prevalence is **unknown**. [WHO autism fact sheet](https://www.who.int/news-room/fact-sheets/detail/autism-spectrum-disorders)
- **Children's mental health, worldwide:** **1 in 7** 10–19-year-olds has a mental disorder, and these conditions remain **largely unrecognized and untreated** (WHO). [WHO adolescent fact sheet](https://www.who.int/news-room/fact-sheets/detail/adolescent-mental-health)
- **Early onset:** **one-third** of mental health conditions emerge before age 14, and **half** before 18 (WHO/UNICEF guidance, 2024). [WHO news release](https://www.who.int/news/item/09-10-2024-who-and-unicef-launch-guidance-to-improve-access-to-mental-health-care-for-children-and-young-people)

**Best line for the pitch:** "Autism is identified in about 1 in 31 kids, but the typical diagnosis comes at almost 4, and nearly 1 in 3 kids with ADHD get no treatment for it. Kids are waiting, and clinicians need better data sooner."

> Keep the ADHD wording exact: 7 million is a *current* diagnosis (2024 data). Don't call it "ever diagnosed."

## What Pathwise does

- Four short, game-like tasks for ages 5–13 on a tablet or laptop:
  - **Dot Trails** (Trail Making): processing speed and switching between tasks
  - **Star Stopper** (Go/No-Go): inhibition
  - **Fish Friends** (Flanker): selective attention
  - **Firefly Path** (spatial span): visual working memory
- Gives clinicians **data, not diagnoses**: scores, process measures from every tap and pen stroke, charts, and change across sessions.
- No specialist is needed to run a session. It's built to be repeated, with alternate forms and trends across sessions.

## Why it's trustworthy

- **Every input is recorded** with millisecond timing, including taps that come too early. Scores can always be recomputed from the raw data.
- **Data-quality flags sit next to every score**: responses that are implausibly fast, inactivity, tab switches, mouse instead of touch, a screen that's too small.
- **One versioned scoring module on the server.** When a metric's definition changes, one command re-scores the stored history.
- **Honest about norms.** We don't invent norms. Published child norms exist for the paper versions of these tests but not for this administration, so every comparison is clearly labeled a placeholder.
- **Clinician-friendly:** charts never rely on colour alone, and there's a replay of the child's actual drawing path in Trail Making.

## Impact: say what it does, not results

- About 15 minutes per session, on hardware clinics already own.
- Objective, repeatable data from the waitlist period, which is rarely captured today.
- Process data that paper tests can't capture: where a child hesitated, how they recovered from errors, whether they slowed down.

**We have no outcome data yet. Don't claim any.**

## Demo path (safest)

1. Open `/dashboard`.
2. Click a **SAMPLE** patient (`SAMPLE-A01` shows improvement over four sessions).
3. Show the trend chart, then a session's score table with validity flags, then the Trail Making path replay.
4. Skip a live `/test` run unless it's been tested since the latest changes.

## Roadmap (v0.2)

- Record age at each session for norm comparisons.
- An adult-guided flow for young kids: a read-aloud script, practice pass marks, a hidden "skip task" control.
- Part B of Trail Making turned off by default under age 8, plus a colour-based version for ages 5–7, who may not know their letters yet.
- A clinical pilot with children and testing on iPad hardware.

## Hard questions

- **"Is this diagnostic?"** No. It's a screening and process-data tool that supports clinical judgment.
- **"Is it validated?"** Not yet. It hasn't been tested with children. A clinical pilot is the next step, and we won't show norm comparisons until validated norms exist.
- **"Is it ready for real patient data?"** Not yet. It has no login, audit log or encryption at rest, and those come before any real data. Patients are pseudonymous codes, and no names are stored.
- **"Does it work across devices?"** Screen size and timing vary by device. We record device details with every session, so we can correct for them later.
- **"What's the evidence the tasks work?"** They're well-established, public-domain research tasks (Trail Making, Go/No-Go, Flanker, Corsi-style span), rebuilt with original kid-friendly visuals.
