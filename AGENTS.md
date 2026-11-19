# Ajax Aspire · Coaching Platform · Agent Guidelines

Read this whole file before every task. It describes what the platform is for, the rules that keep player data accurate and private, and how changes ship. If a request conflicts with a rule here, stop and say so instead of working around it.

---

## 1. What we are building

A small set of tools that makes player development objective and saves the coach time. The coach plans sessions, tracks matches live, reviews film, sends clips and moments to players, and runs a private development portal for each player. Two teams in our U15 age group: **U15 Aspire (`AJAX Aspire U15`)** and **U15 Girls Academy (`AJAX GA U15`)**. Users are teenage players, their parents, and the coaching staff.

Two jobs, in this order:

1. **Objective.** The player, the parent and the coach all see the same facts, and every fact traces to a logged moment with a clip.
2. **Faster.** Film review should be reviewing, not logging. Whatever the coach taps on the sideline is the record that film review starts from. Nothing is keyed in twice.

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

## 2. Keep it simple

The platform is already bigger than one coach can explain or one person can test. Less, done reliably, is the goal.

1. **The one-sentence test.** Any number shown to a player, a parent or another coach must be explainable to a freshman in one plain sentence, with no formula. If it cannot be, it is not shown to them.
2. **Plain counts first.** Players and parents see counts and words: Glows, Grows, goals, assists, minutes, attendance, and the clip behind each one. Coaches on staff see the same counts by game and by zone, with clips.
3. **The Film Index is a coach tool.** It lives in the Match Hub and on the printed report card. On a report card it never appears alone: the coach hands it over and explains it, with the plain counts and two or three clips beside it. It never appears in the Team Hub or the player portal as a headline.
4. **One scoring model, frozen.** There is one weights table, in one place. Scoring v4, the sub-scores, the goal-deficit adjustment and xG-lite shot quality are already in. Do not add new versions, sub-scores, adjustments or KPIs. Weight changes are the coach's decision; when he makes one, add a one-line changelog entry next to the weights.
5. **Build less.** Before adding anything, answer in two lines: which link in the loop does it serve, and what does it save the coach (film time or match-day time) or make more objective? Then say what will be deleted or simplified to pay for it. No new page, tab, KPI, tag or AI feature without the coach's approval. An idea that fails the test goes in `BACKLOG.md`, not in the code.
6. **Deleting is work.** Removing dead code, stale tabs and duplicate data is a valid task and is preferred to adding. The big files are already large (`match-hub.html`, `ajax-match-tracker.html`, `Code.gs`); adding to them is the last resort.
7. **Match-day tools work without AI and without a network.** AI features are optional extras. They never block a tap, a clock, a substitution or a commit.

### Explain every number

Anything that reaches a player or a parent carries its own explanation, placed next to the number. This builds on the one-sentence test above.

1. **Definitions are content, not code.** Every metric shown to a player or parent has one row in the Sheet tab `metric_definitions` (key, label, player text, parent text, coach text, how to read it, source note, caveat). Pages read it through the API. Never hardcode explanation text in a page.
2. **No definition, no number.** Do not add or show a metric to players or parents until its row exists and the coach has approved the wording. Agents may draft rows. Agents never publish them.
3. **One shared component.** A page marks a number with `data-explain="<key>"` and one shared script in the repo (`explain.js`, not a CDN) adds the ⓘ button (44 px tap target) and the panel. Do not write a second explainer.
4. **The panel always answers four things:** what it is, how to read it, where it comes from (which games, how many moments, as of what date), and the clips behind it when there are any.
5. **Not enough data means no number.** Below the sample gates (Film Index: `minEvents` and the minutes thresholds in `INDEX_CONFIG`) show "Not enough film yet", never a low or placeholder number. Never show a default as if the player chose it: a missing self-rating is blank, not 3.
6. **Counts before scores.** Show Glow and Grow counts before any index. Nothing a player or parent sees ranks players against each other.
7. **Say where a stat comes from.** Stats from the staff match log that are known to undercount (shots, shot accuracy, goal conversion) are not shown publicly without the caveat that Veo counts more, or are not shown at all.
8. **Print has no hover.** Anything printed (the report card) puts its explanations in a "How to read this card" box on the page. Dates on printed pages are generated, never typed.

---

## 3. One pipeline: tracker and film review

The tracker and the film logger are two ways into the same record, not two systems.

```
Tracker (tap live)  →  Pitchside commit  →  Holding record  →  Film Review (confirm, add clip + note)  →  Reviewed & Published  →  Match Hub + player portal
```

- **One event, one record.** A moment tapped on the sideline and the same moment reviewed on film are one row. Film review attaches the video timestamp, clip and notes to it, and adds moments that were missed. It does not re-enter what the tracker already holds.
- **One taxonomy.** Zones, categories, outcomes and tags are defined once and read by every tool. Never define a tag list in a second file. (Today the tag lists are repeated across four files. Fix that before adding tags.)
- **Publish gate.** A moment reaches a player only after the coach marks the film review Reviewed & Published.
- **Success measure.** Minutes from the final whistle to a published film review. Changes should shrink it. If a change makes the coach do more clicks for the same result, it is wrong.
- Do not build a parallel path (a new logger, a new commit route, a second copy of the events). Extend this one.

---

## 4. Data truth rules

These exist because each one has already caused a real error in this project.

1. **The Sheet is the only source of truth.** Do not bake player data, film events, stats or notes into HTML or JS files, and do not create new JSON/JS copies of Sheet data. If the site needs data, it fetches it from the API. Browser storage may hold drafts and preferences only, never the record.
   *Why:* film moments have lived in as many as eight places at once, and the copies disagreed.

2. **Structured fields drive every number. Never parse coaching notes to score anything.** Goal scored, goal conceded, assist, zone, outcome and players come from their own columns. Free-text notes are for humans.
   *Why:* note-keyword scoring once gave a goal reward to plays that conceded goals.

3. **Preserve the raw outcome.** Any transformed copy of a film event keeps the original `Quality / Outcome` value (for example `Goal Conceded`), not only a collapsed Glow/Grow.

4. **No hardcoded record IDs in logic.** Never write `if (e.id === 567)`. IDs change when data is re-imported. Mark special records with a field in the Sheet. A wrong record is fixed in the Sheet, not in code.

5. **One charge per event.** A single film event contributes exactly once to any score.

6. **The roster spells the names.** `Player_IDP` is canonical. Fix exports to match it; never rename a roster entry to match an export. All name comparisons use `normName` (strip diacritics with `.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`, replace commas with spaces, collapse whitespace, lowercase). Name matching in free text uses word boundaries and ignores nicknames under three characters.

7. **Column names are exact.** Code finds columns by header text. Never rename a header without updating every reader.

8. **Writes are idempotent.** Any action that adds to totals (committing a match, logging a check-in) carries a stable ID and is rejected if already applied. Wrap Sheet writes in `LockService`.

9. **Never auto-create roster rows.** Unknown names are returned to the coach for confirmation.

10. **No data files in the repo.** No CSV or JSON exports of Sheet data, film logs or stats are committed or served from Netlify. Fixtures for tests use made-up names.

---

## 5. Privacy and security rules

1. **No secrets in client code, ever.** No PINs, tokens or passwords in HTML/JS, including as fallback or default values. The coach token lives in Apps Script Script Properties and is compared server side. A missing credential means the request fails, never that a default is used.
2. **Every per-player read requires that player's name and PIN, checked server side**, and returns only that player's own data. This includes coach ratings, report cards, reflections, coaching videos, film moments and IDP data.
3. **Every per-player write requires that player's PIN.** IDP submissions and reflections cannot be written under another player's name.
4. **Coach-only routes require the coach token**, including reads such as match actions and film overrides.
5. **Public files contain no coaching notes, ratings or evaluations.** Anything served from Netlify is readable by anyone. Filtering in the browser is not privacy.
6. **Throttle PIN checks** with `CacheService`: at most 10 attempts per name per 15 minutes.
7. **Only our age-group teams (`AJAX Aspire U15` and `AJAX GA U15`).** Do not publish data for unrelated teams.

### Open to everyone (no login)
Team Hub, game model, positions, tactics boards, glossary, team film room (clips and prompts, no notes about individuals), Moments that Matter, competition leaderboard, public team stats, parent hub, metric definitions (explanation text only, no player data).

### Player portal (name + PIN)
Her IDP, self-ratings, coach ratings, report card, reflections and coach replies, her published moments and assigned clips, her attendance.

### Coach only (coach token)
Match Hub, sideline tracker, Film Index and sub-scores, raw coaching notes, all-player views.

---

## 6. Design system

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

`index.html` still holds some values under legacy names (`--navy` is light grey, `--white` is near-black, `--gold` is teal). Migrate a file when you are already changing it for another reason. Do not make a change only to rename tokens, and never add new uses of the legacy names.

Type: Bebas Neue for display, DM Sans for body, DM Mono for labels and metadata.

### Responsive and touch
- Mobile first. Players and parents use phones; the coach uses an iPad pitchside.
- Tap targets at least 44×44 px. No horizontal scroll at 390 px wide.
- Text contrast at least 4.5:1.
- Video embeds keep a 16:9 ratio and always offer a direct "watch on" link.

### Match-day tools must work on bad signal
The sideline tracker cannot depend on a runtime CDN to render. Ship its CSS with the page. Autosave state locally, queue commits made while offline, and show plainly whether a commit reached the Sheet.

---

## 7. How we ship

Since 6 Nov, about half of all commits were fixes, and most commits touched several of the big files at once. That is why every deployment finds a new bug. These rules exist to stop it.

1. **One change, one purpose.** A feature and a fix never share a branch. A change that touches more than two of `match-hub.html`, `ajax-match-tracker.html`, `index.html`, `film-moment-logger.html` and `Code.gs` is split up, or the reason is written in the summary.
2. **Targeted edits.** Never rewrite a whole file to make a small change.
3. **Branch, preview, then production.** Work in a branch. Never deploy. The coach checks the branch preview on an iPad and a phone, runs the smoke check below, then merges.
4. **Freeze window.** No deploy of the tracker or `Code.gs` on match day or the day before. In season the tracker changes for bugs the coach has hit and for changes he asks for by name, not for improvements nobody asked for.
5. **Apps Script:** always deploy as a **new version of the existing deployment** (Manage deployments → pencil → New version). A new deployment changes the URL and breaks the site. Write the previous version number in the change summary so rolling back is: pencil → pick that version. For the site, rolling back is Netlify → Deploys → publish the previous deploy.
6. **Plain stack.** Plain HTML, CSS and vanilla JS. No framework, bundler, package.json or new CDN dependency without the coach's approval. No Tailwind Play CDN (`cdn.tailwindcss.com`) in new work.
7. **Content is Sheet rows** (challenges, clips, moments, announcements). Code changes are for structure and design only.

### Prove your work
1. **Show the diff** for every file you change. Do not summarise instead.
2. **Run it before you claim it.** Open the page, perform the action, report what you saw. List anything you could not test.
3. **Every bug fix adds a test** that fails before the fix and passes after, using the real row or case that broke. Tests run the code. A test that only checks a file contains some text or an element does not count. Do not add tests that assert UI labels or tab counts.
4. **Run `node tests/run-tests.js`** before finishing. These five invariants must always pass:
   - Every `Goal Conceded` row in the film log is scored as a conceded goal, and none receives a positive score.
   - No string matching a PIN or token appears in any `.html`, `.js` or `.gs` file.
   - A per-player API request without the right PIN returns no data.
   - Committing the same match twice changes the Sheet once.
   - "Alexa steps to the ball" tags #50 only; "Alex Marigorda switches play" tags #36 only.
5. **Update the docs you invalidate.** If your change makes `MATCH_DAY_USER_GUIDE.md` or this file wrong, fix them in the same branch.

### Smoke check (the coach runs this before every deploy, about 10 minutes)
Keep it in `tests/SMOKE.md` and keep it short. If a bug reaches production, add the step that would have caught it.
1. Open all five pages. No error in the console, nothing blank.
2. Tracker: start a match, tap three events, make a substitution, reach halftime. Commit with the network off, then on. It says plainly that it reached the Sheet.
3. Commit the same match a second time. The Sheet changes once.
4. Film Review opens the match just committed, with its moments in order.
5. Match Hub totals for that match match the Sheet.
6. Player portal: sign in with one PIN. It shows only that player's data, and only published moments.
7. Signed out: the public pages show no coaching notes or ratings.

---

## 8. Repository map

| File | Audience | Purpose |
|---|---|---|
| `index.html` | public + player portal | Team Hub, game model, player portal |
| `match-hub.html` | coach | match analysis, Film Index, report cards |
| `ajax-match-tracker.html` | coach | live sideline tracking |
| `film-moment-logger.html` | coach | film tagging (to be folded into Film Review, see section 3) |
| `ajax-session-planner.html` | coach | session design |
| `explain.js` | public + portal + coach | shared ⓘ explanation panel (planned, not yet created) |
| `Code.gs` | server | the API; all permission checks live here |
| `netlify/functions/` | server | session planner AI proxy |
| `tests/` | coach + agents | `run-tests.js` regression checks, `SMOKE.md` pre-deploy check |
| `MATCH_DAY_USER_GUIDE.md` | coach | how to run match day |
| `BACKLOG.md` | coach | ideas that did not pass the build-less test |
