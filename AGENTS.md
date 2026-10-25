# Ajax Aspire U15 · Team Hub & Match Hub Development Guidelines

This document outlines the architectural principles, development conventions, and operational rules for AI agents and developers working on the **Ajax Aspire U15 Team Hub and Match Hub** (Girls Academy Aspire).

---

## 1. Project Mission & Overview

We are building a player development platform and digital hub for the **Ajax Aspire U15** competitive youth soccer team. The platform connects players, parents, and coaches into a cohesive feedback loop and learning environment.

### The Three-Layer Architecture
1. **Front-End (The Site):** Clean, static HTML/CSS/JavaScript hosted on Netlify (`index.html`, `match-hub.html`, etc.). Fast, accessible, and lightweight.
2. **Bridge (The API):** Google Apps Script web app endpoint serving as a secure JSON API to read and write team and player data.
3. **Data Hub (The Sheet):** Google Sheets Master Data Hub with dedicated tabs per system (`Player_IDP`, `coaching_videos`, `moments`, `Raw_Match_Stats`, `challenges`, etc.). Coaches work directly in the sheet.

---

## 2. Core Guidelines & Non-Negotiables

### 📱 Always Keep the Site Mobile-Responsive
- Most players and parents will access the Team Hub and Match Hub from smartphones at the pitch, on the bus, or at home.
- Layouts must be fluid and responsive, using CSS Grid, Flexbox, and media queries (e.g., standard breakpoints at `820px` and `480px`).
- Ensure touch-friendly tap targets (minimum 44x44px for buttons, links, and form inputs).
- Avoid fixed widths that cause horizontal scrolling.
- Optimize typography with fluid scaling (`clamp()`) or responsive units.

### 🧹 Clean HTML / CSS / JavaScript
- Write clean, modern, semantic HTML5, CSS3, and vanilla ES6+ JavaScript.
- Avoid unnecessary external frameworks or heavy dependencies; prioritize performance, fast initial load times, and simple maintainability.
- Maintain consistent visual theming:
  - Deep Navy background (`--navy: #0D1B2A`, `--card: #14273D`)
  - Accent colors: Teal (`--teal: #3ABFB8`), Gold (`--gold: #C8A951`), Green (`--greenLt: #3E9E63`)
  - Clean typography: Bebas Neue for bold athletic headers, DM Sans for body text, DM Mono for tags/metadata.
- Keep CSS organized with clear class naming and CSS custom properties (variables).

### 🔒 Protect Player Privacy
- **Strict Role-Based Separation:**
  - **Open to Everyone (No Login):** Team Hub, Compete Leaderboard, Moments that Matter, Public Team Stats, Positions, Tactics Board, Team Film Room, Soccer Glossary, Parent Hub.
  - **Player Portal (Protected):** Gated by player selection and PIN. Only individual development plans (IDPs), player self-ratings, coach ratings, private reflections, coach replies, and assigned personal film clips belong here.
- **Privacy Safeguards:**
  - Never publicly expose player PINs, private contact details, or sensitive evaluations.
  - API responses for public endpoints must never leak private individual IDP notes or credentials.
  - Ensure local browser storage of session state handles player credentials safely and provides an easy sign-out.

### 🎥 16:9 Aspect Ratio for Match Video Embeds
- All match film embeds (YouTube, Vimeo, Veo, Hudl, or HTML5 video) must preserve a strict **16:9 widescreen ratio**.
- Use modern CSS `aspect-ratio: 16 / 9;` on responsive iframe containers with `width: 100%; height: auto;`, or traditional 16:9 intrinsic padding wrappers (`position: relative; width: 100%; padding-top: 56.25%;` with an absolute positioned iframe).
- Always provide a fallback direct link ("Watch on external site") in case third-party video hosts restrict iframe embedding or permission policies block inline playback on mobile devices.

---

## 3. The Feedback Loop Philosophy

> **"A player who writes something and hears nothing back stops writing."**

Every system on the hub feeds one continuous cycle:
1. **Player Submits:** A match reflection, film study response, or individual development plan (IDP).
2. **Data Lands:** Stored as a new row in the Google Sheets log with timestamp and submission type.
3. **Coach Replies:** Coach reviews the submission and adds feedback/guidance in the adjacent column.
4. **Player Reads:** The site detects unread replies and displays a notification banner upon next login.

All features, UI tweaks, and workflow changes should support making this interaction loop fast, seamless, and reliable.

---

## 4. Stability Rules & Data Integrity

1. **The Roster Spells the Names:** The player roster tab in the spreadsheet is the single source of truth. When external stats or exports disagree on spelling, fix the export, never change the canonical roster name.
2. **Update the Script, Keep the URL:** When updating Google Apps Script code, always deploy as a *new version* of the existing deployment. Creating a brand new deployment changes the endpoint URL and breaks the live front-end.
3. **Spreadsheet First, Code Last:** Content items (challenges, video clips, recognitions, announcements) are spreadsheet rows. Only structural and design updates require site code deploys.
4. **Column Names Are Exact:** Front-end and Google Apps Script functions find data by column header name, not hardcoded column index. Columns can be rearranged, but never renamed without updating the code.

---

## 5. Repository Structure Reference

- `index.html`: Main Team Hub dashboard (squad stats, announcements, moments, roster).
- `match-hub.html`: Match preparation, lineup, video breakdown, and opponent scouting hub.
- `ajax-session-planner.html`: Training session builder and exercise library.
- `team_hub_workflow.html`: Visual overview of how the multi-layer hub works.
- `netlify.toml`: Netlify headers, edge caching rules, and serverless proxy routes.
- `netlify/functions/`: Edge functions and serverless proxies (e.g., `session-planner.mjs`).
- `Code.gs`: Google Apps Script backend code handling sheet reads, writes, and authentication.
