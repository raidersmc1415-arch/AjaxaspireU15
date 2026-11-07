# Ajax Aspire · Coaching Platform · Agent Guidelines

Read this whole file before every task. It describes the platform as it is now, the rules that keep player data accurate and private, and how to prove your work. If a request conflicts with a rule here, stop and say so instead of working around it.

---

## 1. What we are building

One platform where the coach plans sessions, tracks matches live, reviews film, sends clips and moments to players, and runs a private development portal for each player. Two teams in our U15 age group: **U15 Aspire (`AJAX Aspire U15`)** and **U15 Girls Academy (`AJAX GA U15`)**. Users are teenage players, their parents, and the coaching staff.

### The loop every feature serves

```
Plan session  →  Track match  →  Review film  →  Send clip / moment  →  Player reflects  →  Coach replies  →  Plan next session
```

> "A player who writes something and hears nothing back stops writing."

A feature that does not move this loop forward, or that breaks a link in it, is the wrong feature.

### Three layers

1. **Sheet (source of truth).** Google Sheets "Ajax Aspire U15 - Master Data Hub". All player, match, film and feedback data lives here and nowhere else.
2. **API (the only door to the Sheet).** Google Apps Script web app, `Code.gs`. Enforces every permission check.
3. **Site (display only).** Static HTML/CSS/JS on Netlify, deployed from GitHub. Holds no player data of its own.

---

## 2. Data truth rules

These exist because each one has already caused a real error in this project.

1. **The Sheet is the only source of truth.** Do not bake player data, film events, stats or notes into HTML or JS files, and do not create new JSON/JS copies of Sheet data. If the site needs data, it fetches it from the API. Browser storage may hold drafts and preferences only, never the record.
   *Why:* film moments currently exist in about eight places (CSV, two canonical files, 578 KB inside match-hub.html, three Sheet tabs, browser storage), and they disagree.

2. **Structured fields drive every number. Never parse coaching notes to score anything.** Goal scored, goal conceded, assist, zone, outcome and players come from their own columns. Free-text notes are for humans.
   *Why:* note-keyword scoring gave a +2.50 goal reward to two plays that conceded goals, because the note described the opponent scoring.

3. **Preserve the raw outcome.** Any transformed copy of a film event must keep the original `Quality / Outcome` value (e.g. `Goal Conceded`), not only the collapsed Glow/Grow.
   *Why:* the canonical file dropped it, so the Film Index recognised 2 of 19 conceded goals.

4. **No hardcoded record IDs in logic.** Never write `if (e.id === 567)`. IDs change when data is re-imported. Mark special records with a field in the Sheet.

5. **One charge per event.** A single film event contributes exactly once to any score. No separate bonuses for something the event already counts.

6. **The roster spells the names.** `Player_IDP` is canonical. Fix exports to match it; never rename a roster entry to match an export. All name comparisons use `normName` (strip diacritics with `.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`, replace commas with spaces, collapse whitespace, lowercase). Name matching in free text uses word boundaries and ignores nicknames under three characters.

7. **Column names are exact.** Code finds columns by header text. Never rename a header without updating every reader.

8. **Writes are idempotent.** Any action that adds to totals (committing a match, logging a check-in) carries a stable ID and is rejected if already applied. Wrap Sheet writes in `LockService`.

9. **Never auto-create roster rows.** Unknown names are returned to the coach for confirmation.

---

## 3. Privacy and security rules

1. **No secrets in client code, ever.** No PINs, tokens or passwords in HTML/JS, including as fallback or default values. The coach token lives in Apps Script Script Properties and is compared server side. A missing credential means the request fails, never that a default is used.
2. **Every per-player read requires that player's name and PIN, checked server side**, and returns only that player's own data. This includes coach ratings, report cards, reflections, coaching videos, film moments and IDP data.
3. **Every per-player write requires that player's PIN.** IDP submissions and reflections cannot be written under another player's name.
4. **Coach-only routes require the coach token**, including reads such as match actions and film overrides.
5. **Public files contain no coaching notes, ratings or evaluations.** Anything served from Netlify is readable by anyone. Filtering in the browser is not privacy.
6. **Throttle PIN checks** with `CacheService`: at most 10 attempts per name per 15 minutes.
7. **Only our age-group teams (`AJAX Aspire U15` & `AJAX GA U15`).** Do not publish data for unrelated teams.

### Open to everyone (no login)
Team Hub, game model, positions, tactics boards, glossary, team film room (clips and prompts, no notes about individuals), Moments that Matter, competition leaderboard, public team stats, parent hub.

### Player portal (name + PIN)
Her IDP, self-ratings, coach ratings, report card, reflections and coach replies, her assigned clips, her attendance.

### Coach only (coach token)
Match Hub, sideline tracker, Film Index, raw coaching notes, all-player views.

---

## 4. Design system

Light theme. Token names describe the colour they hold.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F4F6F9` | page background |
| `--surface` | `#E9EEF4` | secondary panels |
| `--card` | `#FFFFFF` | cards |
| `--ink` | `#0B111A` | headings |
| `--text` | `#182230` | body text |
| `--muted` | `#2D3748` | secondary text |
| `--border` | `#CBD5E1` | borders |
| `--slate` | `#1A2330` | dark contrast blocks |
| `--green` | `#15803D` | AJAX green, positive |
| `--teal` | `#008496` | primary accent on light backgrounds |
| `--cyan` | `#00C2D6` | accent on dark blocks only |

The current `index.html` holds these values under legacy names (`--navy` is light grey, `--white` is near-black, `--gold` is teal). When you touch a file, migrate it to the names above; never add new uses of the legacy names.

Type: Bebas Neue for display, DM Sans for body, DM Mono for labels and metadata.

Every page in the suite (Team Hub, Match Hub, tracker, session planner, film logger) uses this one system.

### Responsive and touch
- Mobile first. Players and parents use phones; the coach uses an iPad pitchside.
- Tap targets at least 44×44 px. No horizontal scroll at 390 px wide.
- Text contrast at least 4.5:1.
- Video embeds keep a 16:9 ratio and always offer a direct "watch on" link.

### Match-day tools must work on bad signal
The sideline tracker cannot depend on a runtime CDN to render. Ship its CSS with the page. Autosave state locally, queue commits made while offline, and show plainly whether a commit reached the Sheet.

---

## 5. Engineering conventions

- Plain HTML, CSS and vanilla JS. No framework, bundler, package.json or new CDN dependency without the coach's approval.
- Do not use the Tailwind Play CDN (`cdn.tailwindcss.com`) in new work; it is not meant for production.
- Targeted edits. Never rewrite a whole file to make a small change.
- Apps Script: always deploy as a **new version of the existing deployment** (Manage deployments → pencil → New version). A new deployment changes the URL and breaks the site.
- Content is Sheet rows (challenges, clips, moments, announcements). Code changes are for structure and design only.

---

## 6. How to prove your work

1. **Show the diff.** For every file you change, show the changed lines. Do not summarise instead.
2. **Run it before you claim it.** Open the page, perform the action, report what you saw. If you could not test something, say exactly that.
3. **Run the regression checks** in `tests/` (create them if missing) before finishing:
   - Every `Goal Conceded` row in the film log is scored as a conceded goal, and no `Goal Conceded` row receives a positive score.
   - No string matching a PIN or token appears in any `.html` or `.js` file.
   - A per-player API request without the right PIN returns no data.
   - Committing the same match twice changes the Sheet once.
   - "Alexa steps to the ball" tags #50 only; "Alex Marigorda switches play" tags #36 only.
4. **Update the docs you invalidate.** If your change makes `match_day_user_guide.md` or this file wrong, fix them in the same branch.
5. Work in a branch. Never deploy. The coach reviews and deploys.

---

## 7. Repository map

| File | Audience | Purpose |
|---|---|---|
| `index.html` | public + player portal | Team Hub, game model, player portal |
| `match-hub.html` | coach | match analysis, Film Index, report cards |
| `ajax-match-tracker.html` | coach | live sideline tracking |
| `ajax-session-planner.html` | coach | session design |
| `film-moment-logger.html` | coach | film tagging |
| `Code.gs` | server | the API; all permission checks live here |
| `netlify/functions/` | server | session planner AI proxy |
| `match_day_user_guide.md` | coach | how to run match day |
