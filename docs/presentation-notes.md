# Constellate: Pitch + Live Demo (4:00)

Bullets are cues, not lines to read. **Bold** = must say.

## Before you go on

- [ ] **Do one full Quick run today and check it saves.** The latest changes haven't been clicked through in a browser yet.
- [ ] `/test` setup screen already open: clinician picked, patient code typed (e.g. `DEMO-01`, never a real name), **Quick** protocol selected.
- [ ] Second tab: `/dashboard`, then `SAMPLE-A01` (has four sessions, for the trend chart).
- [ ] A teammate plays, not a judge. Explaining the game to a judge costs about 30 seconds.
- [ ] **Why Quick:** the standard protocol (40 Go/No-Go trials, 32 Flanker trials, practice rounds) takes far longer than 4 minutes. Quick runs all four games in about 1.5 minutes.

---

## 0:00–0:40 · Hook and problem (Myra)

*Myra is still editing the intro. Keep it to these beats.*

- Names and majors: Myra, [major]; Rachel, Data Science and Math.
- **Personal story:** waited almost two years for neuropsych testing (around 2015). The backlog is worse now.
- **The stakes:** a child who may have ADHD or a learning difference waits **months to years**, falling further behind with no support plan.
- **The scale:** **about 7 million US kids have a current ADHD diagnosis** (CDC), and **nearly 1 in 3 of them get no ADHD-specific treatment** (CDC).
- **The tools are old:** paper tests, a stopwatch, scoring by hand. The digital versions are proprietary, licensed per seat, and capture little more than paper does.

## 0:40–1:00 · Solution

- **"We built Constellate: four standard clinical tasks, rebuilt as games kids actually want to play."**
- Name them quickly. The demo shows them in action.
  - **Dot Trails** (Trail Making): speed and switching
  - **Star Stopper** (Go/No-Go): impulse control
  - **Fish Friends** (Flanker): focus amid distraction
  - **Firefly Path** (Corsi blocks): visual working memory
- **The data a stopwatch can't capture:** where the child hesitated, how they recovered from mistakes, and whether they slowed down.

## 1:00–2:45 · Live demo (teammate plays; narrate over it)

Narrate one line per game while it runs. Don't explain the rules twice; the on-screen instructions do it.

- **Dot Trails:**
  - "On paper a psychologist does this with a stopwatch. Part A: numbers. Part B: alternate numbers and letters."
  - **"That switch is where executive function shows up."**
  - If you're asked about circle count, Quick uses 8 circles; the full version uses 15.
- **Star Stopper:** "Tap every shape **except the red star**. This measures impulse control."
- **Fish Friends:** "Which way is the **middle** fish swimming? The others try to distract you."
- **Firefly Path:** "Repeat the fireflies' path. The sequences get longer each round."
- While it saves: **"Every tap and stroke is recorded to the millisecond and scored on the server instantly."**
- Wait for **Open in dashboard** to light up. It only enables once everything is saved.

## 2:45–3:25 · Dashboard

- **Trail Making:**
  - Completion times, errors, and the B-versus-A switching cost.
  - **Click the hesitation count.** It jumps to the list; click one and **the replay jumps to that moment.** This is the wow moment.
  - Point at the replay: **"This is the child's actual path."**
- **Validity flags:**
  - **"It tells the clinician when not to trust a score."**
  - On a laptop it will show **"Mouse input"**. Say: "See, it caught that we used a mouse, not touch."
- **Other tasks, one line:** impulsive taps and misses in Star Stopper, the distraction cost in Fish Friends, the longest sequence held in Firefly Path.
- **Switch to the `SAMPLE-A01` tab:** **"Tracked across sessions, so you see progress over time."**
- **Norms, the honest version:**
  - "Published norms only plug in when they match the exact test. Until then, it says placeholder."
  - **Don't say "compared against published norms."** Every norm is currently a placeholder, and it says so on screen.

## 3:25–3:50 · What's next

- **Tablets.** That's how kids are tested in clinics, and the app already supports touch.
- **More of the battery,** including computer vision to score hands-on tasks like block building, which are scored by eye today.
- **HIPAA-ready infrastructure and clinical validation.** Start with private practices and research labs while approval for clinical use is pending.
- **Long term, a "patient brain":** one place where a child's cognitive profile lives and grows.

## 3:50–4:00 · Close

- **"The tests run themselves, so the clinician spends their time interpreting. We connect the dots in how a child thinks."**

---

## Don't say

- "Diagnoses ADHD or autism." It's a **screening and process-data tool** that supports clinicians.
- "Exactly matches the traditional test." Say **"based on"** the standard tasks.
- "Compared against published norms." All norms are **placeholders**.
- "Pauses cluster around the letters." Only say it if you can see it in that run.
- Any impact or outcome numbers. **We have no outcome data yet.**

## Backup: more stats (CDC/WHO, if asked)

- **Late autism diagnosis:** the median age of earliest diagnosis is **47 months**, nearly 4 years, and up to **69.5 months** in some communities. [CDC MMWR, 2025](https://www.cdc.gov/mmwr/volumes/74/ss/ss7402a1.htm)
- **Autism, US:** **1 in 31** eight-year-olds (CDC, 2022 data).
- **ADHD:** **7 million children aged 3–17 (11.7%)** have a *current* diagnosis (CDC, 2024 data); don't call it "ever diagnosed." **30.1%** got no ADHD-specific treatment (2022). [CDC ADHD data](https://www.cdc.gov/adhd/data/index.html) · [CDC study](https://stacks.cdc.gov/view/cdc/160350)
- **Worldwide:**
  - **1 in 127** people are autistic, and prevalence is **unknown** in many low- and middle-income countries. [WHO autism fact sheet](https://www.who.int/news-room/fact-sheets/detail/autism-spectrum-disorders)
  - **1 in 7** 10–19-year-olds has a mental disorder, and these conditions remain **largely unrecognized and untreated**. [WHO adolescent fact sheet](https://www.who.int/news-room/fact-sheets/detail/adolescent-mental-health)
  - **Half** of mental health conditions start before age 18. [WHO/UNICEF, 2024](https://www.who.int/news/item/09-10-2024-who-and-unicef-launch-guidance-to-improve-access-to-mental-health-care-for-children-and-young-people)

## Backup: hard questions

- **"Is this diagnostic?"** No. It's a screening and process-data tool that supports clinical judgment.
- **"Is it validated?"** Not yet. It hasn't been tested with children; a clinical pilot is next. Norm comparisons stay off until validated norms exist.
- **"Can it hold real patient data?"** Not yet. It has no login, audit log or encryption at rest, and those come first. Patients are pseudonymous codes, and no names are stored.
- **"Does it work across devices?"** Screen size and timing vary by device, so we record device details with every session to correct for them later.
- **"Why trust the data?"**
  - Every input is logged, including too-early taps and tab switches.
  - Validity flags sit next to every score.
  - Scoring is versioned, and one command re-scores all stored history.
- **"What about young kids who don't know letters?"** Part B is the hard part under age 8. A color-based version for ages 5–7 is on the roadmap.
