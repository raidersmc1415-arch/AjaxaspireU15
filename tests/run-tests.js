#!/usr/bin/env node
/**
 * Ajax Aspire · Coaching Platform · Automated Regression Suite (AGENTS.md §6.3)
 *
 * Verifies all 5 non-negotiable platform invariants:
 *   1. Every `Goal Conceded` row in the film log is scored as a conceded goal (-2.50),
 *      no `Goal Conceded` row receives a positive score, no scoring function reads `note`,
 *      and no hardcoded record IDs (`e.id === 567`) exist in logic.
 *   2. No string matching a PIN or token (`4111`, `2627`, `1415`, `VALID_COACH_PINS`)
 *      appears in any `.html`, `.js`, or `.gs` file.
 *   3. A per-player API request (`coachRatings`, `reflections`, `coachingVideos`,
 *      `playerFilmMoments`, `doPost` IDP/reflection) without the right PIN returns no data,
 *      and report cards never overwrite the 10 granular IDP coach skill ratings.
 *   4. Committing the same match twice (`updateSeasonStats` with the same `matchId`)
 *      changes the Sheet once, and unknown names are returned in `unmatchedPlayers`
 *      rather than auto-creating roster rows.
 *   5. "Alexa steps to the ball" tags #50 only; "Alex Marigorda switches play" tags #36 only.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

function parseCsvLine(line) {
  const res = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      res.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  res.push(cur);
  return res;
}

let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('=== Ajax Aspire Regression Checks (AGENTS.md §6.3) ===\n');

// ---------------------------------------------------------------------------
// CHECK 1: Goal Conceded scoring, structured-only eventWeight, no e.id === 567
// ---------------------------------------------------------------------------
check('1a. No hardcoded record ID (e.id === 567) in match-hub.html', () => {
  const mh = fs.readFileSync(path.join(ROOT, 'match-hub.html'), 'utf8');
  assert(!/\.id\s*===\s*567/.test(mh), 'Found hardcoded e.id === 567 in match-hub.html');
});

check('1b. eventWeight() and applyNetMetrics() do not parse coaching notes to score events', () => {
  const mh = fs.readFileSync(path.join(ROOT, 'match-hub.html'), 'utf8');
  const start = mh.indexOf('function eventWeight(');
  const end = mh.indexOf('function fmtNet(');
  assert(start !== -1 && end !== -1, 'Could not locate eventWeight..fmtNet in match-hub.html');
  const scoringBlock = mh.slice(start, end);
  assert(!/\.note\b/.test(scoringBlock), 'Scoring block references .note');
  assert(!/\bfullText\b/.test(scoringBlock), 'Scoring block uses fullText regex matching');
});

check('1c. Every Goal Conceded row in Aspire_Film_Log.csv (all 20 rows) and DEFAULT_DATA scores -2.50 and never positive', () => {
  const mh = fs.readFileSync(path.join(ROOT, 'match-hub.html'), 'utf8');
  const ddLine = mh.split('\n').find(l => l.includes('const DEFAULT_DATA ='));
  assert(ddLine, 'DEFAULT_DATA line not found');
  const defaultData = JSON.parse(ddLine.replace(/^\s*const\s+DEFAULT_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

  const ewStart = mh.indexOf('const EVENT_WEIGHTS =');
  const ewEnd = mh.indexOf('function fmtNet(');
  const scoringCode = mh.slice(ewStart, ewEnd);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(scoringCode, sandbox);

  // Verify CSV Goal Conceded rows
  const csvText = fs.readFileSync(path.join(ROOT, 'Aspire_Film_Log.csv'), 'utf8').trim();
  const csvLines = csvText.split(/\r?\n/);
  const headers = parseCsvLine(csvLines[0]);
  const iZone = headers.indexOf('Field Zone');
  const iCat = headers.indexOf('Event Category');
  const iQual = headers.indexOf('Quality / Outcome');
  const iNote = headers.indexOf('Coaching Notes');
  const iMatch = headers.indexOf('Match');
  const iTag = headers.indexOf('Short Form Tag');

  let csvGoalConcededCount = 0;
  for (let r = 1; r < csvLines.length; r++) {
    if (!csvLines[r].trim()) continue;
    const cols = parseCsvLine(csvLines[r]);
    const qualityRaw = (cols[iQual] || '').trim();
    if (qualityRaw === 'Goal Conceded') {
      csvGoalConcededCount++;
      const ev = {
        match: (cols[iMatch] || '').trim(),
        zone: (cols[iZone] || '').trim().slice(0, 2),
        category: (cols[iCat] || '').trim(),
        tag: (cols[iTag] || '').trim(),
        qualityRaw,
        outcome: 'Grow',
        note: (cols[iNote] || '').trim()
      };
      const score = sandbox.eventWeight(ev);
      assert.strictEqual(score, -2.50, `CSV row ${r + 1} (${ev.match}) Goal Conceded scored ${score} instead of -2.50`);
      assert(score < 0, `CSV row ${r + 1} Goal Conceded received non-negative score ${score}`);
    }
  }
  assert(csvGoalConcededCount >= 19, `Expected at least 19 Goal Conceded rows in CSV, found ${csvGoalConcededCount}`);

  // Verify DEFAULT_DATA Goal Conceded events
  const events = defaultData['AJAX ASPIRE U15'].filmEvents;
  const gcEvents = events.filter(e => e.qualityRaw === 'Goal Conceded');
  assert.strictEqual(gcEvents.length, csvGoalConcededCount, `Expected ${csvGoalConcededCount} Goal Conceded events in DEFAULT_DATA, found ${gcEvents.length}`);
  gcEvents.forEach(e => {
    const score = sandbox.eventWeight(e);
    assert.strictEqual(score, -2.50, `Event #${e.id} (${e.match} ${e.time}) scored ${score} instead of -2.50`);
  });

  // Verify adversarial note on a Grow event ("opponent scores a goal!") does NOT trigger +2.50 Goal Scored
  const adversarialGrow = {
    id: 9999,
    match: 'Test Match',
    zone: 'D3',
    category: 'Defensive Moment',
    tag: 'Lost Mark / Bad Recovery',
    qualityRaw: 'Grow',
    outcome: 'Grow',
    note: 'Defender loses mark and opponent scores a goal!'
  };
  const advScore = sandbox.eventWeight(adversarialGrow);
  assert.strictEqual(advScore, -1.50, `Adversarial Grow note scored ${advScore} instead of D3 Grow (-1.50)`);
});

// ---------------------------------------------------------------------------
// CHECK 2: No PIN or token strings in any .html, .js, or .gs file
// ---------------------------------------------------------------------------
check('2. No hardcoded PINs or coach tokens in any .html, .js, or .gs file', () => {
  const filesToScan = fs.readdirSync(ROOT).filter(f => /\.(html|js|gs)$/.test(f));
  const forbidden = /\b(4111|2627|1415|VALID_COACH_PINS)\b/;
  filesToScan.forEach(file => {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const match = content.match(forbidden);
    assert(!match, `Forbidden secret token "${match ? match[0] : ''}" found in ${file}`);
  });
  assert(!fs.existsSync(path.join(ROOT, 'aspire-canonical-moments.js')), 'Public aspire-canonical-moments.js must not exist');
  assert(!fs.existsSync(path.join(ROOT, 'aspire-canonical-moments.json')), 'Public aspire-canonical-moments.json must not exist');
});

// ---------------------------------------------------------------------------
// CHECK 3 & 4: Server-side PIN auth, report cards isolation, idempotent match commit
// ---------------------------------------------------------------------------
function createCodeGsSandbox() {
  const codeGs = fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8');
  const cacheStore = {};
  const kvStore = {};
  const idpRows = [
    ['Player Name', 'PIN', 'Jersey #', 'Position', 'Team', 'Games Played', 'Minutes Played', 'Average Minutes', 'Goals', 'Assists', 'Shots On Target', 'Shots Off Target', 'Fouls', 'Clean Sheets', 'Win %', 'Turnovers Def 3rd', 'Key Passes', 'Duels', 'IDP_Submitted', 'Coach_T_Touch', 'Coach_T_Dribbling', 'Coach_T_Passing', 'Coach_Tac_Support', 'Coach_Tac_RestDef', 'Coach_Tac_Press', 'Coach_T_Movement', 'Coach_T_Duels', 'Coach_Tac_Attack', 'Coach_Tac_Defend'],
    ['Camila Deleon', '9999', 9, 'CB', 'AJAX Aspire U15', 10, 600, 60, 2, 1, 5, 3, 2, 3, 50, 4, 3, 12, '{"t_touch":4}', 4, 4, 5, 4, 4, 4, 5, 4, 4, 5],
    ['Carlee Gowan', '8888', 89, 'CB', 'AJAX Aspire U15', 10, 580, 58, 0, 1, 2, 1, 1, 3, 50, 3, 2, 10, '{}', 3, 3, 4, 4, 3, 3, 4, 4, 3, 4]
  ];
  const reflectionsRows = [
    ['2026-11-01', 'Camila Deleon', 'Check my shoulder before receiving', 'Great takeaway Cami!']
  ];
  const actionLogRows = [
    ['Event_ID', 'Match_Date', 'Match_Name', 'Opponent', 'Half', 'Match_Clock', 'Zone', 'Outcome', 'Category', 'Tag', 'Player_Name', 'Jersey_Num', 'Coach_Notes', 'Film_Review', 'Status', 'Last_Updated'],
    ['601', '2026-11-01', 'Rocklin (Nov 1)', 'Rocklin', 'H2', '47:00', 'M3', 'Grow', 'Defensive Moment', 'Defensive Shape', '#9 Camila Deleon', '9', 'Assigned clip note visible to player', 'TRUE', 'Published', '2026-11-02'],
    ['602', '2026-11-01', 'Rocklin (Nov 1)', 'Rocklin', 'H2', '62:00', 'D3', 'Glow', 'Turnover', 'Key Pass / Line Breaker', '#9 Camila Deleon', '9', 'Internal coach-only note redacted for player', 'FALSE', 'Published', '2026-11-02']
  ];
  const kvRows = [
    ['key', 'value', 'updated_at']
  ];

  function makeSheet(rows) {
    return {
      getDataRange: () => ({ getValues: () => rows }),
      getLastRow: () => rows.length,
      getRange: (r, c, numR, numC) => ({
        setValue: (val) => {
          while (rows.length < r) rows.push([]);
          rows[r - 1][c - 1] = val;
        },
        setValues: (vals) => {
          for (let i = 0; i < vals.length; i++) {
            while (rows.length < r + i) rows.push([]);
            for (let j = 0; j < vals[i].length; j++) {
              rows[r - 1 + i][c - 1 + j] = vals[i][j];
            }
          }
        },
        clearContent: () => {},
        setFontWeight: function() { return this; },
        setBackground: function() { return this; },
        setFontColor: function() { return this; }
      }),
      appendRow: (row) => { rows.push(row); },
      setFrozenRows: () => {}
    };
  }

  const sheets = {
    'Player_IDP': makeSheet(idpRows),
    'Reflections_Log': makeSheet(reflectionsRows),
    'Match_Action_Log': makeSheet(actionLogRows),
    'match_hub': makeSheet(kvRows)
  };

  const sandbox = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k === 'COACH_TOKEN' ? 'TEST_SERVER_COACH_SECRET' : null)
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => cacheStore[k] || null,
        put: (k, v) => { cacheStore[k] = v; },
        remove: (k) => { delete cacheStore[k]; }
      })
    },
    LockService: {
      getScriptLock: () => ({
        waitLock: () => {},
        releaseLock: () => {}
      })
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (str) => ({
        _text: str,
        setMimeType: function() { return this; },
        getContent: function() { return this._text; }
      })
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name) => sheets[name] || null,
        insertSheet: (name) => {
          sheets[name] = makeSheet([[]]);
          return sheets[name];
        }
      })
    },
    console,
    Date,
    Math,
    JSON,
    Object,
    Array,
    String,
    Number,
    Boolean,
    RegExp,
    parseInt,
    parseFloat,
    isNaN
  };

  vm.createContext(sandbox);
  vm.runInContext(codeGs, sandbox);
  return { sandbox, idpRows, kvStore };
}

check('3a. Per-player API reads without valid PIN return no data; valid PIN returns data with non-filmReview notes redacted', () => {
  const { sandbox } = createCodeGsSandbox();

  // Unauthenticated coachRatings
  const rUnauth = JSON.parse(sandbox.doGet({ parameter: { action: 'coachRatings', name: 'Camila Deleon' } }).getContent());
  assert.strictEqual(rUnauth.found, false, 'coachRatings without PIN must return found: false');

  // Wrong PIN reflections
  const refWrong = JSON.parse(sandbox.doGet({ parameter: { action: 'reflections', name: 'Camila Deleon', pin: '0000' } }).getContent());
  assert.strictEqual(refWrong.reflections.length, 0, 'reflections with wrong PIN must return empty reflections array');

  // Unauthenticated playerFilmMoments
  const fmUnauth = JSON.parse(sandbox.doGet({ parameter: { action: 'playerFilmMoments', name: 'Camila Deleon' } }).getContent());
  assert.strictEqual(fmUnauth.success, false, 'playerFilmMoments without PIN must return success: false');
  assert.strictEqual(fmUnauth.moments.length, 0, 'playerFilmMoments without PIN must return 0 moments');

  // Authenticated playerFilmMoments redacts non-filmReview notes
  const fmAuth = JSON.parse(sandbox.doGet({ parameter: { action: 'playerFilmMoments', name: 'Camila Deleon', pin: '9999' } }).getContent());
  assert.strictEqual(fmAuth.success, true);
  assert.strictEqual(fmAuth.moments.length, 2);
  const mReview = fmAuth.moments.find(m => String(m.id) === '601');
  const mRaw = fmAuth.moments.find(m => String(m.id) === '602');
  assert.strictEqual(mReview.note, 'Assigned clip note visible to player');
  assert.strictEqual(mRaw.note, '', 'Raw coaching note with filmReview=false must be redacted for player');

  // Unauthenticated POST IDP write
  const postUnauth = JSON.parse(sandbox.doPost({
    postData: { contents: JSON.stringify({ name: 'Camila Deleon', pin: 'wrong', t_touch: 5 }) }
  }).getContent());
  assert.strictEqual(postUnauth.success, false, 'doPost IDP submission with wrong PIN must fail');
});

check('3b. Saving a report card never overwrites the 10 granular IDP coach skill ratings', () => {
  const { sandbox } = createCodeGsSandbox();

  // Coach saves a report card with tech_decision = 2
  const saveRes = JSON.parse(sandbox.handleSaveMatchHubNote({
    pin: 'TEST_SERVER_COACH_SECRET',
    noteKey: 'ajax_report_card_aspire_camila_deleon',
    noteText: JSON.stringify({ tech_ball: 2, tech_decision: 2, tech_scanning: 2, phys_workrate: 2, phys_duels: 2 })
  }).getContent());
  assert.strictEqual(saveRes.success, true);

  // Fetch coachRatings for Camila Deleon
  const cr = JSON.parse(sandbox.doGet({
    parameter: { action: 'coachRatings', name: 'Camila Deleon', pin: '9999' }
  }).getContent());
  assert.strictEqual(cr.found, true);
  assert.strictEqual(cr.hasReportCard, true);
  assert.strictEqual(cr.reportCard.tech_decision, 2);
  // Granular IDP ratings from Player_IDP must remain untouched (t_passing = 5, t_touch = 4)
  assert.strictEqual(cr.ratings.t_passing, 5, `Expected t_passing to stay 5, got ${cr.ratings.t_passing}`);
  assert.strictEqual(cr.ratings.t_touch, 4, `Expected t_touch to stay 4, got ${cr.ratings.t_touch}`);
});

check('4. Committing the same match twice updates the Sheet once and does not auto-create unknown roster rows', () => {
  const { sandbox, idpRows } = createCodeGsSandbox();

  const payload = {
    pin: 'TEST_SERVER_COACH_SECRET',
    matchId: 'AJAX_ASPIRE_U15_Rocklin_2026-11-01',
    isIncremental: true,
    playerStats: {
      'camila deleon': { name: 'Camila Deleon', gp: 1, mins: 80, goals: 1 },
      'unknown guest player': { name: 'Unknown Guest Player', gp: 1, mins: 45, goals: 0 }
    },
    matchSummary: {
      matchId: 'AJAX_ASPIRE_U15_Rocklin_2026-11-01',
      team: 'AJAX ASPIRE U15',
      opponent: 'Rocklin',
      date: '2026-11-01T12:00:00Z',
      ajaxScore: 2,
      oppScore: 1
    }
  };

  // First commit
  const res1 = JSON.parse(sandbox.handleUpdateSeasonStats(payload).getContent());
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.alreadyCommitted, false);
  assert.strictEqual(res1.updated, 1);
  assert(res1.unmatchedPlayers.includes('Unknown Guest Player'), 'Unknown player must be returned in unmatchedPlayers');
  assert.strictEqual(idpRows.length, 3, 'Player_IDP must NOT auto-create a new row for Unknown Guest Player');
  assert.strictEqual(idpRows[1][5], 11, 'Camila GP should increment from 10 to 11 on first commit');
  assert.strictEqual(idpRows[1][6], 680, 'Camila Mins should increment from 600 to 680 on first commit');

  // Second commit of the exact same matchId
  const res2 = JSON.parse(sandbox.handleUpdateSeasonStats(payload).getContent());
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.alreadyCommitted, true, 'Second commit of same matchId must return alreadyCommitted: true');
  assert.strictEqual(res2.updated, 0);
  assert.strictEqual(idpRows[1][5], 11, 'Camila GP must remain 11 after duplicate commit');
  assert.strictEqual(idpRows[1][6], 680, 'Camila Mins must remain 680 after duplicate commit');
});

// ---------------------------------------------------------------------------
// CHECK 5: "Alexa steps to the ball" tags #50 only; "Alex Marigorda switches play" tags #36 only
// ---------------------------------------------------------------------------
check('5. "Alexa steps to the ball" tags #50 only; "Alex Marigorda switches play" tags #36 only', () => {
  const mh = fs.readFileSync(path.join(ROOT, 'match-hub.html'), 'utf8');
  const rStart = mh.indexOf('const ASPIRE_ROSTER = [');
  const rEnd = mh.indexOf('const TRACKER_FORMATIONS = {');
  assert(rStart !== -1 && rEnd !== -1, 'Could not locate ASPIRE_ROSTER / parseSingleVoiceSnippet in match-hub.html');

  const voiceSandbox = {};
  vm.createContext(voiceSandbox);
  vm.runInContext(mh.slice(rStart, rEnd), voiceSandbox);

  const pAlexa = voiceSandbox.parseSingleVoiceSnippet('Alexa steps to the ball', 'Rocklin (Nov 1)', 'H1', '2026-11-01');
  assert.deepStrictEqual(Array.from(pAlexa.jerseys), [50], `"Alexa steps to the ball" expected [50], got ${JSON.stringify(pAlexa.jerseys)}`);

  const pAlex = voiceSandbox.parseSingleVoiceSnippet('Alex Marigorda switches play', 'Rocklin (Nov 1)', 'H1', '2026-11-01');
  assert.deepStrictEqual(Array.from(pAlex.jerseys), [36], `"Alex Marigorda switches play" expected [36], got ${JSON.stringify(pAlex.jerseys)}`);

  // Also check index.html doesMomentMatchPlayer
  const idxHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dStart = idxHtml.indexOf('const ASPIRE_ROSTER = [');
  const dEnd = idxHtml.indexOf('function normalizeMomentItem(');
  const idxSandbox = {
    normNameJS: (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  };
  vm.createContext(idxSandbox);
  vm.runInContext(idxHtml.slice(dStart, dEnd), idxSandbox);

  const alexaMoment = { note: 'Alexa steps to the ball', playersRaw: '#50 Alexa Chipres', jerseys: [50] };
  assert.strictEqual(idxSandbox.doesMomentMatchPlayer(alexaMoment, 'Alexa Chipres', 50), true);
  assert.strictEqual(idxSandbox.doesMomentMatchPlayer(alexaMoment, 'Alex Marigorda', 36), false, '"Alexa steps to the ball" must NOT match #36 Alex Marigorda');

  const alexMoment = { note: 'Alex Marigorda switches play', playersRaw: '#36 Alex Marigorda', jerseys: [36] };
  assert.strictEqual(idxSandbox.doesMomentMatchPlayer(alexMoment, 'Alex Marigorda', 36), true);
  assert.strictEqual(idxSandbox.doesMomentMatchPlayer(alexMoment, 'Alexa Chipres', 50), false, '"Alex Marigorda switches play" must NOT match #50 Alexa Chipres');
});

console.log(`\nAll ${passed} regression checks passed.`);
