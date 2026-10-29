# ASD Programming Website

Interactive versions of teacher-designed programs from the ASD (special ed) program books,
used by students on school iPads in Safari. Owner: Peter (EdTech, Portland ME elementary school).

## Hard rules
- **Web only.** No apps, installs, accounts or logins. Must work in iPad Safari.
- **No student data, ever.** No names, no IDs, no logins. Nothing is saved: no localStorage,
  cookies, IndexedDB, server, or analytics. Session score lives in page memory only and is
  wiped on Reset / reload / exit. Staff record data on paper data sheets.
- **No third-party requests.** No CDNs, web fonts, analytics or trackers. Everything self-contained.
- **Program sets** are anonymous codes (K1, K2, …) that only list which programs appear.
  The student-to-code link lives in a paper staff binder, never on the site.

## Structure
- Plain HTML/CSS/JS, no build step. Hosted as a static site (GitHub Pages planned; confirm
  the school network allows it).
- `programs/<program-id>/index.html` — one folder per program.
- Planned: shared engine (setup screen, praise/correction, staff score panel, audio) and
  a home screen that loads a K-set.

## Shared program conventions (from Color ID)
- Staff setup screen: version (receptive/expressive), step, session (teaching/baseline),
  praise (computer praises = default; staff praises = ding + green highlight only),
  trial count, read-aloud toggle, show-prompt-text toggle.
- Scoring: only the first response per trial counts, as + / −.
- Correction: model the correct answer, re-present; repeat until 1x independent, max 3x.
- Baseline: no prompts, no reinforcement.
- Expressive versions: student answers by voice/AAC; staff tap ✓ / ✗.
- Staff panel: hidden behind a "Staff" button; shows % and marks for this session only.
- End screen notes the mastery rule: 80%+ for 3 consecutive sessions → next step.
- Large touch targets; built-in iPad speech for prompts (not for phoneme/letter-sound work —
  use recorded audio there).

## Programs
- `color-id` — Color ID. Step 1: red, blue, green, yellow. Step 2: purple, orange, black,
  brown, pink. Receptive: 3 choices. Open questions: hide color word by default? Mix Step 1
  colors into Step 2 distractors?
