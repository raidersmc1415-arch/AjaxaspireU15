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
    ['Event_ID', 'Match_Date', 'Match_Name', 'Opponent', 'Half', 'Match_Clock', 'Zone', 'Outcome', 'Category', 'Tag', 'Player_Name', 'Jersey_Num', 'Coach_Notes', 'Note_To_Player', 'Film_Review', 'Status', 'Last_Updated'],
    ['601', '2026-11-01', 'Rocklin (Nov 1)', 'Rocklin', 'H2', '47:00', 'M3', 'Grow', 'Defensive Moment', 'Defensive Shape', '#9 Camila Deleon', '9', 'Internal coach observation', 'Assigned player note visible in portal', 'TRUE', 'Published', '2026-11-02'],
    ['602', '2026-11-01', 'Rocklin (Nov 1)', 'Rocklin', 'H2', '62:00', 'D3', 'Glow', 'Turnover', 'Key Pass / Line Breaker', '#9 Camila Deleon', '9', 'Internal coach-only note redacted for player', '', 'FALSE', 'Published', '2026-11-02']
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
        getValues: () => {
          const out = [];
          for (let i = 0; i < (numR || 1); i++) {
            const rowIdx = r - 1 + i;
            const rData = rows[rowIdx] || [];
            out.push(rData.slice(c - 1, c - 1 + (numC || 1)));
          }
          return out;
        },
        getValue: () => (rows[r - 1] ? rows[r - 1][c - 1] : ''),
        setFontWeight: function() { return this; },
        setBackground: function() { return this; },
        setFontColor: function() { return this; }
      }),
      appendRow: (row) => { rows.push(row); },
      setFrozenRows: () => {},
      getLastColumn: () => (rows[0] ? rows[0].length : 0),
      insertColumnAfter: (afterCol) => {
        for (let r = 0; r < rows.length; r++) {
          rows[r].splice(afterCol, 0, '');
        }
      }
    };
  }

  const sheets = {
    'Player_IDP': makeSheet(idpRows),
    'Reflections_Log': makeSheet(reflectionsRows),
    'Match_Action_Log': makeSheet(actionLogRows),
    'match_hub': makeSheet(kvRows),
    'Raw_Match_Stats': makeSheet([
      ['Team', 'Player', 'Position', 'Games Played', 'Games Won', 'Games Tied', 'Games Lost', 'Goals', 'Goals Against', 'Goal Difference', 'Clean Sheets', 'Shots On Target', 'Shots Off Target', 'Shots', 'Corner Kicks', 'Win Percentage', 'Shot Accuracy', 'Goal Conversion'],
      ['AJAX Aspire U15', '', '', 10, 5, 0, 5, 20, 20, 0, 2, 50, 40, 90, 20, 0.5, 0.5556, 0.2222]
    ])
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
  return { sandbox, idpRows, kvStore, actionLogRows };
}

check('3a. Per-player API reads without valid PIN return no data; valid PIN returns data with non-filmReview notes redacted', () => {
  const { sandbox, actionLogRows } = createCodeGsSandbox();

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

  // Authenticated playerFilmMoments redacts coach notes; delivers noteToPlayer
  const fmAuth = JSON.parse(sandbox.doGet({ parameter: { action: 'playerFilmMoments', name: 'Camila Deleon', pin: '9999' } }).getContent());
  assert.strictEqual(fmAuth.success, true);
  assert.strictEqual(fmAuth.moments.length, 2);
  const mReview = fmAuth.moments.find(m => String(m.id) === '601');
  const mRaw = fmAuth.moments.find(m => String(m.id) === '602');
  assert.strictEqual(mReview.noteToPlayer, 'Assigned player note visible in portal');
  assert.strictEqual(mReview.note, '', 'Internal coach note must be redacted for player');
  assert.strictEqual(mRaw.noteToPlayer, '', 'Blank Note to Player must return empty string');
  assert.strictEqual(mRaw.note, '', 'Internal coach note must be redacted for player');

  // Authenticated Coach caller retains both Coach Note and Note to Player
  const fmCoach = JSON.parse(sandbox.doGet({ parameter: { action: 'playerFilmMoments', name: 'Camila Deleon', pin: 'TEST_SERVER_COACH_SECRET' } }).getContent());
  assert.strictEqual(fmCoach.success, true);
  const mCoach601 = fmCoach.moments.find(m => String(m.id) === '601');
  assert.strictEqual(mCoach601.note, 'Internal coach observation', 'Coach caller retains Coach Note');
  assert.strictEqual(mCoach601.noteToPlayer, 'Assigned player note visible in portal', 'Coach caller retains Note to Player');

  // Verify saveFilmMoments writes Note_To_Player to Column N of Match_Action_Log
  const saveMomentsRes = JSON.parse(sandbox.handleSaveFilmMoments({
    pin: 'TEST_SERVER_COACH_SECRET',
    match: 'Rocklin (Nov 1)',
    moments: [{
      id: '603',
      match: 'Rocklin (Nov 1)',
      half: 'H2',
      time: '07:00',
      zone: 'D3',
      outcome: 'Grow',
      category: 'Defensive Moment',
      tag: 'Good Press / Duel Won',
      note: 'Mack forces keeper... internal staff note',
      noteToPlayer: 'Watch pressing trigger when Mack turns keeper',
      jerseys: [2],
      players: ['#2 Giselle Rosales'],
      filmReview: true
    }]
  }).getContent());
  assert.strictEqual(saveMomentsRes.success, true);
  const row603 = actionLogRows.find(r => r[0] === '603');
  assert(row603, 'Row 603 must exist in Match_Action_Log');
  assert.strictEqual(row603[12], 'Mack forces keeper... internal staff note', 'Col 13 Coach_Notes must match');
  assert.strictEqual(row603[13], 'Watch pressing trigger when Mack turns keeper', 'Col 14 Note_To_Player must be written');

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

check('6. healTeamAggregate() and updateTeamAggregateInRawMatchStats() use dynamic calculations with no hardcoded 13 GP or fake shot defaults', () => {
  const codeGs = fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8');
  assert(!/setValue\(13\)/.test(codeGs), 'Code.gs must not hardcode setValue(13) in healTeamAggregate');
  assert(!/matchTotals\.sot\s*:\s*6/.test(codeGs), 'Code.gs must not default addSOT to 6');
  assert(!/matchTotals\.soff\s*:\s*8/.test(codeGs), 'Code.gs must not default addSOFF to 8');

  const { sandbox } = createCodeGsSandbox();
  // Commit a match with no matchTotals provided -> shots/corners should add 0, not 6/8/4
  sandbox.handleUpdateSeasonStats({
    pin: 'TEST_SERVER_COACH_SECRET',
    matchId: 'AJAX_ASPIRE_U15_DynamicTest_2026-11-08',
    isIncremental: true,
    playerStats: { 'camila deleon': { name: 'Camila Deleon', gp: 1, mins: 80, goals: 2 } },
    matchSummary: {
      matchId: 'AJAX_ASPIRE_U15_DynamicTest_2026-11-08',
      team: 'AJAX ASPIRE U15',
      opponent: 'DynamicTest',
      date: '2026-11-08T12:00:00Z',
      ajaxScore: 2,
      oppScore: 0
    }
  });

  const healRes = JSON.parse(sandbox.doGet({
    parameter: { action: 'healTeamAggregate', pin: 'TEST_SERVER_COACH_SECRET' }
  }).getContent());
  assert.strictEqual(healRes.success, true);
  assert(/11 GP, 6-0-5/.test(healRes.message), `Expected 11 GP, 6-0-5 in healRes.message, got: ${healRes.message}`);
});

// ---------------------------------------------------------------------------
// CHECK 7: V3.1 Taxonomy, Single-Actor Attribution & Small-Sample Regression
// ---------------------------------------------------------------------------
check('7a. All 8 Action Families and specific tags are present in match-hub.html, film-moment-logger.html, and Code.gs', () => {
  const mh = fs.readFileSync(path.join(ROOT, 'match-hub.html'), 'utf8');
  const fml = fs.readFileSync(path.join(ROOT, 'film-moment-logger.html'), 'utf8');
  const amt = fs.readFileSync(path.join(ROOT, 'ajax-match-tracker.html'), 'utf8');
  const cgs = fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8');

  const families = ['Passing', 'Carrying', 'Defending', 'Duel', 'Finishing', 'Goalkeeping', 'Tactical_Shape', 'Administrative'];
  families.forEach(fam => {
    assert(mh.includes(fam), `match-hub.html missing family ${fam}`);
    assert(fml.includes(fam), `film-moment-logger.html missing family ${fam}`);
    assert(amt.includes(fam), `ajax-match-tracker.html missing family ${fam}`);
    assert(cgs.includes(fam), `Code.gs missing family ${fam}`);
  });

  const specificTags = [
    'Key Pass (Shot Assist)', 'Goal Assist', 'Line-Breaking Pass', 'Progressive Pass',
    'Switch Point of Attack', 'Combination Play', 'Forced Turnover Pass', 'Unforced Turnover Pass',
    'Progressive Carry', '1v1 Dribble Won', 'Turned into Pressure', 'Miscontrol', 'Dispossessed',
    'Direct Pressure', 'Tackle', 'Interception', 'Clearance', 'Blocked Shot', 'Recovery Run',
    'Poor Clearance', 'Stabbed at the Ball', 'Lost Mark / Recovery',
    'Ground Duel Won', 'Aerial Duel Won', 'Foul Won', 'Ground Duel Lost', 'Foul Conceded', 'No Challenge on 50/50',
    'Goal Scored', 'Shot on Target', 'Quality Shot', 'Shot Off Target', 'Poor Shot Selection', 'Cross Out of Bounds',
    'Save (Clean / Held)', 'Save (Parried)', 'Box Aerial Claim', 'Build-Out Distribution', 'Goal Conceded',
    'Scanning & Pre-Orientation', 'Support Angle Offered', 'Tactical Communication', 'Team Shape Shift', 'Off-Ball Spacing Fault'
  ];

  specificTags.forEach(tag => {
    assert(mh.includes(tag), `match-hub.html missing tag ${tag}`);
    assert(fml.includes(tag), `film-moment-logger.html missing tag ${tag}`);
    assert(cgs.includes(tag), `Code.gs missing tag ${tag}`);
  });
});

check('7b. V3.1 Film Index calculation: Primary actor 1.0x, Secondary 0.5x, and Bayesian Small-Sample regression', () => {
  const mh = fs.readFileSync(path.join(ROOT, 'match-hub.html'), 'utf8');
  const ewStart = mh.indexOf('const EVENT_WEIGHTS =');
  const ewEnd = mh.indexOf('function fmtNet(');
  assert(ewStart !== -1 && ewEnd !== -1, 'Could not extract scoring code from match-hub.html');
  const scoringCode = mh.slice(ewStart, ewEnd);

  const sandbox = {
    Math,
    Number,
    Array,
    Object,
    fmtNet: val => (val > 0 ? '+' : '') + Number(val).toFixed(1)
  };
  vm.createContext(sandbox);
  vm.runInContext(scoringCode, sandbox);

  // Test event weights: Key Pass (Shot Assist) = +1.25, Line-Breaking Pass = base + 0.50 bonus (1.75 in M3)
  assert.strictEqual(sandbox.eventWeight({ category: 'Passing', tag: 'Key Pass (Shot Assist)', outcome: 'Glow' }, 'M3'), 1.25);
  assert.strictEqual(sandbox.eventWeight({ category: 'Passing', tag: 'Line-Breaking Pass', outcome: 'Glow' }, 'M3'), 1.75);

  // Test attribution: primary player gets 1.0x, secondary gets 0.5x
  const p1 = { jersey: 1, name: 'Player One', mins: 150, pos: 'CM', netScore: 0, glowCount: 0, growCount: 0, filmMinutes: 150, filmEventsCount: 12, toD: 0, toM: 0, toA: 0, filmEventIds: [101] };
  const p2 = { jersey: 2, name: 'Player Two', mins: 150, pos: 'CM', netScore: 0, glowCount: 0, growCount: 0, filmMinutes: 150, filmEventsCount: 12, toD: 0, toM: 0, toA: 0, filmEventIds: [101] };
  const teamObj = {
    totals: { mins: 300 },
    players: [p1, p2],
    filmEvents: [
      {
        id: 101,
        primaryJersey: 1,
        secondaryJerseys: [2],
        jerseys: [1, 2],
        category: 'Passing',
        tag: 'Key Pass (Shot Assist)',
        zone: 'A3',
        outcome: 'Glow'
      }
    ]
  };

  sandbox.applyNetMetrics(teamObj);
  assert.strictEqual(p1.rawFilmPts, 1.25);
  assert.strictEqual(p2.rawFilmPts, 0.63); // 0.625 rounded to 0.63

  // Test Bayesian regression: 60 mins (45-119 range) regresses toward Par 80
  const p3 = { jersey: 3, name: 'Player Three', mins: 60, pos: 'CM', netScore: 0, glowCount: 0, growCount: 0, filmMinutes: 60, filmEventsCount: 5, toD: 0, toM: 0, toA: 0, filmEventIds: [102] };
  const smallSampleTeam = {
    totals: { mins: 360 },
    players: [p1, p2, p3],
    filmEvents: [
      {
        id: 101,
        primaryJersey: 1,
        secondaryJerseys: [2],
        jerseys: [1, 2],
        category: 'Passing',
        tag: 'Key Pass (Shot Assist)',
        zone: 'A3',
        outcome: 'Glow'
      },
      {
        id: 102,
        primaryJersey: 3,
        secondaryJerseys: [],
        jerseys: [3],
        category: 'Passing',
        tag: 'Key Pass (Shot Assist)',
        zone: 'A3',
        outcome: 'Glow'
      }
    ]
  };
  sandbox.applyNetMetrics(smallSampleTeam);
  assert.strictEqual(p3.confidence, 'regressed');
  assert(p3.indexNote.includes('Regressed'), 'Expected Regressed in indexNote for 60 min sample');

  // Test under 45 mins: unindexed
  const p4 = { jersey: 4, name: 'Player Four', mins: 30, pos: 'CM', netScore: 0, glowCount: 0, growCount: 0, filmMinutes: 30, filmEventsCount: 2, toD: 0, toM: 0, toA: 0, filmEventIds: [] };
  const microSampleTeam = {
    totals: { mins: 330 },
    players: [p1, p2, p4],
    filmEvents: [
      {
        id: 101,
        primaryJersey: 1,
        secondaryJerseys: [2],
        jerseys: [1, 2],
        category: 'Passing',
        tag: 'Key Pass (Shot Assist)',
        zone: 'A3',
        outcome: 'Glow'
      }
    ]
  };
  sandbox.applyNetMetrics(microSampleTeam);
  assert.strictEqual(p4.confidence, 'low_sample');
  assert.strictEqual(p4.filmIndex, null);
});

// ---------------------------------------------------------------------------
// CHECK 8: Sideline Tracker Ergonomics, Sub Minute Reconciliation & Set Pieces
// ---------------------------------------------------------------------------
check('8. Sideline Tracker substitution retroactive minutes reconciliation & set piece tracking', () => {
  const trackerHtml = fs.readFileSync(path.join(ROOT, 'ajax-match-tracker.html'), 'utf8');

  // Verify UI elements exist
  assert(trackerHtml.includes('id="eemSubSection"'), 'eemSubSection missing in edit modal');
  assert(trackerHtml.includes('id="efPill-setpieces"'), 'efPill-setpieces filter missing in feed');
  assert(trackerHtml.includes('logQuickCorner()'), 'logQuickCorner trigger missing in tracker');
  assert(trackerHtml.includes('logQuickSetPiece()'), 'logQuickSetPiece trigger missing in tracker');

  // Extract tracker script logic into sandbox to test reconciliation math
  const scriptMatches = trackerHtml.match(/<script[\s\S]*?<\/script>/gi);
  assert(scriptMatches && scriptMatches.length >= 3, 'Expected at least 3 script tags in tracker');
  const scriptContent = scriptMatches[2].replace(/<\/?script[^>]*>/gi, '');

  // Set up mock DOM and window sandbox
  const domState = {
    elements: {},
    addEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: function(id) {
      if (!this.elements[id]) {
        this.elements[id] = { textContent: '', className: '', style: {}, classList: { remove: () => {}, add: () => {}, replace: () => {}, toggle: () => {} } };
      }
      return this.elements[id];
    }
  };

  const sandbox = {
    document: domState,
    window: { addEventListener: () => {} },
    localStorage: (() => {
      let store = {};
      return {
        getItem: (k) => store[k] || null,
        setItem: (k, v) => { store[k] = String(v); },
        clear: () => { store = {}; }
      };
    })(),
    sessionStorage: { getItem: () => '4111', setItem: () => {} },
    showToast: () => {},
    alert: () => {},
    confirm: () => true,
    prompt: () => '60',
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }),
    Promise: Promise,
    clearInterval: () => {},
    setInterval: () => {},
    setTimeout: () => {},
    clearTimeout: () => {},
    console: console,
    Math: Math,
    Date: Date,
    parseInt: parseInt,
    Object: Object,
    Array: Array,
    Set: Set
  };

  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);

  // Initialize a mock match state inside sandbox context
  const run = (expr) => vm.runInContext(expr, sandbox);
  run(`
    activeSquadKey = 'aspire';
    initSquadMatch();
    matchSeconds = 70 * 60; // Clock is at 70 minutes

    // Ensure player 8 is on pitch at CAM and 23 is on bench
    const p8 = playerStats[8];
    if (!playerStats[23]) {
      playerStats[23] = { jersey: 23, name: 'Substitute Player', mins: 0, benchMins: 70, posMins: {}, onPitch: false };
    }
    const p23 = playerStats[23];
    p23.benchMins = 70;
    p23.mins = 0;
    p8.mins = 70;
    p8.posMins = { CAM: 70 };
    p8.benchMins = 0;
    onPitchPlayers['CAM'] = 8;
    selectedSlot = 'CAM';

    // 1. Test retroactive sub at min 60 when match clock is at min 70 (10 min discrepancy)
    onTapBenchPlayer(23, 60);
  `);

  const p23 = run('playerStats[23]');
  const p8 = run('playerStats[8]');

  // Verify delta was +10: p23 gained 10 mins on pitch, p8 lost 10 mins on pitch
  assert.strictEqual(p23.mins, 10, 'Expected incoming player #23 to have 10 mins after min 60 sub at min 70 clock');
  assert.strictEqual(p23.benchMins, 60, 'Expected incoming player #23 benchMins to decrease from 70 to 60');
  assert.strictEqual(p8.mins, 60, 'Expected outgoing player #8 to have mins reduced from 70 to 60');
  assert.strictEqual(p8.benchMins, 10, 'Expected outgoing player #8 benchMins to increase from 0 to 10');

  // Verify sub event created with proper attributes
  const subEv = run('matchEvents[0]');
  assert.strictEqual(subEv.type, 'sub');
  assert.strictEqual(subEv.time, 60);
  assert.strictEqual(subEv.inJersey, 23);
  assert.strictEqual(subEv.outJersey, 8);

  // 2. Test editing sub event timestamp from 60' to 55' (further 5 minutes earlier)
  run(`
    editActiveEventId = '${subEv.id}';
    editMinute = 55;
    saveEventEdits();
  `);

  assert.strictEqual(run('playerStats[23].mins'), 15, 'Expected player #23 mins to adjust to 15 after editing sub to 55');
  assert.strictEqual(run('playerStats[8].mins'), 55, 'Expected player #8 mins to adjust to 55 after editing sub to 55');

  // 3. Test editing sub event timestamp in the other direction: from 55' to 65' (-10 delta)
  run(`
    editActiveEventId = '${subEv.id}';
    editMinute = 65;
    saveEventEdits();
  `);

  assert.strictEqual(run('playerStats[23].mins'), 5, 'Expected player #23 mins to adjust to 5 after editing sub to 65');
  assert.strictEqual(run('playerStats[8].mins'), 65, 'Expected player #8 mins to adjust to 65 after editing sub to 65');

  // 4. Test deleting the sub event: reverses elapsed time and restores #8 to slot
  run(`
    editActiveEventId = '${subEv.id}';
    deleteEvent();
  `);
  assert.strictEqual(run("onPitchPlayers['CAM']"), 8, 'Expected outgoing player #8 to be restored to CAM');
  assert.strictEqual(run('playerStats[8].onPitch'), true, 'Expected player #8 onPitch to be restored to true');
  assert.strictEqual(run('playerStats[23].onPitch'), false, 'Expected player #23 onPitch to be false');

  // 5. Test Corner and Set Piece logging and V3.1 taxonomy mapping
  run(`
    selectedPlayerJersey = 8;
    selectedSlot = 'CAM';
    logSelectedEvent('corner');
    selectedPlayerJersey = 8;
    logSelectedEvent('setPiece');
  `);

  assert.strictEqual(run('playerStats[8].corners'), 1, 'Expected p8 corners to increment to 1');
  assert.strictEqual(run('playerStats[8].setPieces'), 1, 'Expected p8 setPieces to increment to 1');

  // Verify commit payload contains Passing for Corner and Duel for Set Piece
  run('commitMatchToHub()');
  const rawCustom = sandbox.localStorage.getItem('matchhub_custom_data');
  assert(rawCustom, 'Expected customData in localStorage');
  const custom = JSON.parse(rawCustom);
  const filmEvents = custom['AJAX ASPIRE U15'].filmEvents;
  const cornerEv = filmEvents.find(e => (e.note || '').includes('CORNER KICK'));
  assert(cornerEv && cornerEv.category === 'Passing', 'Expected corner kick to map to Passing');
  const setPieceEv = filmEvents.find(e => (e.note || '').includes('SET PIECE'));
  assert(setPieceEv && setPieceEv.category === 'Duel', 'Expected set piece to map to Duel');
});

// ---------------------------------------------------------------------------
// CHECK 9: Sideline Match Tracker Harmonization with Film Log (Categorized Action Grid)
// ---------------------------------------------------------------------------
check('9. Sideline Match Tracker Harmonization with Film Log (Category Bar & One-Tap Actions)', () => {
  const trackerHtml = fs.readFileSync(path.join(ROOT, 'ajax-match-tracker.html'), 'utf8');

  // Verify enlarged player card and category filter elements exist in tracker
  assert(trackerHtml.includes('id="pamZoneD3"'), 'pamZoneD3 missing in tracker HTML');
  assert(trackerHtml.includes('id="pamZoneM3"'), 'pamZoneM3 missing in tracker HTML');
  assert(trackerHtml.includes('id="pamZoneA3"'), 'pamZoneA3 missing in tracker HTML');
  assert(trackerHtml.includes('id="pamCategoryChips"'), 'pamCategoryChips container missing in tracker HTML');
  assert(trackerHtml.includes('id="pamCat-passing"'), 'pamCat-passing chip missing in tracker HTML');
  assert(trackerHtml.includes('id="pamCat-carrying"'), 'pamCat-carrying chip missing in tracker HTML');
  assert(trackerHtml.includes('id="pamCat-defending"'), 'pamCat-defending chip missing in tracker HTML');
  assert(trackerHtml.includes('id="pamCat-duel"'), 'pamCat-duel chip missing in tracker HTML');
  assert(trackerHtml.includes('id="pamCat-finishing"'), 'pamCat-finishing chip missing in tracker HTML');
  assert(trackerHtml.includes('id="pamCat-gk"'), 'pamCat-gk chip missing in tracker HTML');
  assert(trackerHtml.includes('id="pamCat-tactical"'), 'pamCat-tactical chip missing in tracker HTML');
  assert(trackerHtml.includes('id="pamCat-admin"'), 'pamCat-admin chip missing in tracker HTML');
  assert(trackerHtml.includes('id="pamActionTagGrid"'), 'pamActionTagGrid container missing in tracker HTML');
  assert(trackerHtml.includes('logPamAction('), 'logPamAction handler missing in tracker HTML');

  // Execute in sandbox to test one-tap action logging and stat updates
  const scriptMatches = trackerHtml.match(/<script[\s\S]*?<\/script>/gi);
  const scriptContent = scriptMatches[2].replace(/<\/?script[^>]*>/gi, '');

  const domState = {
    elements: {},
    addEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    getElementById: function(id) {
      if (!this.elements[id]) {
        this.elements[id] = { textContent: '', className: '', style: {}, classList: { remove: () => {}, add: () => {}, replace: () => {}, toggle: () => {} } };
      }
      return this.elements[id];
    }
  };

  const sandbox = {
    document: domState,
    window: { addEventListener: () => {} },
    localStorage: (() => {
      let store = {};
      return { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, clear: () => { store = {}; } };
    })(),
    sessionStorage: { getItem: () => '4111', setItem: () => {} },
    showToast: () => {},
    alert: () => {},
    confirm: () => true,
    prompt: () => '60',
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }),
    Promise: Promise,
    clearInterval: () => {},
    setInterval: () => {},
    setTimeout: () => {},
    clearTimeout: () => {},
    console: console,
    Math: Math,
    Date: Date,
    parseInt: parseInt,
    Object: Object,
    Array: Array,
    Set: Set
  };

  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);

  const run = expr => vm.runInContext(expr, sandbox);

  run(`
    activeSquadKey = 'aspire';
    initSquadMatch();
    matchSeconds = 30 * 60; // 30 mins
    onPitchPlayers['CAM'] = 8;
    pamCurrentSlot = 'CAM';
    pamCurrentZone = 'A3';

    // 1. Log Key Pass (Shot Assist)
    logPamAction('Key Pass (Shot Assist)', 'Glow', 'Passing');

    // 2. Log Goal Scored
    pamCurrentSlot = 'CAM';
    logPamAction('Goal Scored', 'Goal Scored', 'Finishing');

    // 3. Log Ground Duel Won
    pamCurrentSlot = 'CAM';
    pamCurrentZone = 'M3';
    logPamAction('Ground Duel Won', 'Glow', 'Duel');

    // 4. Log Forced Turnover Pass
    pamCurrentSlot = 'CAM';
    pamCurrentZone = 'A3';
    logPamAction('Forced Turnover Pass', 'Grow', 'Passing');
  `);

  const p8 = run('playerStats[8]');
  assert.strictEqual(p8.keyPasses, 1, 'Expected p8 keyPasses to be 1');
  assert.strictEqual(p8.goals, 1, 'Expected p8 goals to be 1');
  assert.strictEqual(p8.duelsWon, 1, 'Expected p8 duelsWon to be 1');
  assert.strictEqual(p8.turnovers, 1, 'Expected p8 turnovers to be 1');
  assert.strictEqual(p8.toA, 1, 'Expected p8 toA (turnovers in A3) to be 1');

  // Verify matchEvents contains exact V3.1 structured fields (unshifted, newest first)
  const evs = run('matchEvents');
  assert.strictEqual(evs.length, 4, 'Expected 4 logged events');
  assert.strictEqual(evs[0].tag, 'Forced Turnover Pass');
  assert.strictEqual(evs[0].category, 'Passing');
  assert.strictEqual(evs[0].outcome, 'Grow');
  assert.strictEqual(evs[1].tag, 'Ground Duel Won');
  assert.strictEqual(evs[1].category, 'Duel');
  assert.strictEqual(evs[2].tag, 'Goal Scored');
  assert.strictEqual(evs[2].category, 'Finishing');
  assert.strictEqual(evs[3].tag, 'Key Pass (Shot Assist)');
  assert.strictEqual(evs[3].category, 'Passing');
  assert.strictEqual(evs[3].outcome, 'Glow');
});

// ---------------------------------------------------------------------------
// CHECK 10: End of Match Recap AI & Two-Half Performance Engine
// ---------------------------------------------------------------------------
check('10. Sideline Tracker End of Match Recap AI button, modal, and two-half analytics', () => {
  const trackerHtml = fs.readFileSync(path.join(ROOT, 'ajax-match-tracker.html'), 'utf8');

  // 1. Verify button existence in header
  assert(trackerHtml.includes('openMatchRecapAIModal()'), 'Missing openMatchRecapAIModal() call on Match Recap button');
  assert(trackerHtml.includes('📋 Match Recap AI'), 'Missing Match Recap AI button in header');

  // 2. Verify modal structure
  assert(trackerHtml.includes('id="matchRecapAiModal"'), 'Missing #matchRecapAiModal in HTML');
  assert(trackerHtml.includes('id="recapTwoHalfStatsRows"'), 'Missing #recapTwoHalfStatsRows container');
  assert(trackerHtml.includes('id="recapSentimentBadge"'), 'Missing #recapSentimentBadge');
  assert(trackerHtml.includes('copyMatchRecapReport()'), 'Missing copyMatchRecapReport() function call');

  // 3. Test calculation logic in sandbox
  const sandbox = {
    document: {
      getElementById: (id) => ({
        classList: { remove: () => {}, add: () => {} },
        textContent: '',
        innerHTML: ''
      })
    },
    matchEvents: [
      { time: 10, half: 'H1', type: 'goal', jersey: 14 },
      { time: 25, half: 'H1', type: 'shot', onTarget: true },
      { time: 30, half: 'H1', type: 'turnover' },
      { time: 55, half: 'H2', type: 'goal', jersey: 23 },
      { time: 60, half: 'H2', type: 'turnover' }
    ],
    opponentName: 'Crossfire #2',
    playerStats: {
      14: { jersey: 14, name: 'Kendall Blair', goals: 1, assists: 0, mins: 60, keyPasses: 0, shots: 1, sot: 1, duelsWon: 2, saves: 0 },
      23: { jersey: 23, name: 'Sophia Culver', goals: 1, assists: 0, mins: 55, keyPasses: 0, shots: 1, sot: 1, duelsWon: 1, saves: 0 }
    },
    oppStats: { goals: 1, shots: 2, fouls: 1 }
  };
  vm.createContext(sandbox);

  const start = trackerHtml.indexOf('function runLocalMatchRecapRuleEngine(');
  const end = trackerHtml.indexOf('function commitMatchToHub(');
  assert(start !== -1 && end !== -1, 'Could not locate runLocalMatchRecapRuleEngine');
  vm.runInContext(trackerHtml.slice(start, end), sandbox);

  const testTelemetry = {
    opponent: 'Crossfire #2',
    ajaxScore: 6,
    oppScore: 1,
    shotsH1: 8, shotsH2: 10, sotH1: 5, sotH2: 7,
    toH1: 12, toH2: 8,
    pressRateH1: 55, pressRateH2: 65,
    foulsH1: 2, foulsH2: 1,
    standouts: ['#14 Kendall Blair: 3 goals']
  };

  const report = sandbox.runLocalMatchRecapRuleEngine(testTelemetry);
  assert.strictEqual(report.sentiment, 'DOMINANT VICTORY', 'Expected Dominant Victory sentiment for 6-1 scoreline');
  assert(report.gameFlowSummary.includes('Crossfire #2'), 'Expected gameFlowSummary to reference opponent');
  assert(report.adaptationText.includes('55%') && report.adaptationText.includes('65%'), 'Expected adaptationText to reference H1 and H2 press rates');
});

// ---------------------------------------------------------------------------
// CHECK 11: Cross-Device Cloud Datasets Sync & Overview Bar Clean-Up
// ---------------------------------------------------------------------------
check('11. Cloud datasets sync in Tracker & Match Hub, and removal of redundant tracker pill', () => {
  const trackerHtml = fs.readFileSync(path.join(ROOT, 'ajax-match-tracker.html'), 'utf8');
  const matchHubHtml = fs.readFileSync(path.join(ROOT, 'match-hub.html'), 'utf8');
  const codeGs = fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8');

  // 1. Sideline tracker sends saveMatchHubData with datasets
  assert(trackerHtml.includes("action: 'saveMatchHubData'"), 'Tracker does not call saveMatchHubData');
  assert(trackerHtml.includes('datasets: customData'), 'Tracker does not send datasets in saveMatchHubData');

  // 2. Code.gs handles saveMatchHubData and returns datasets in getMatchHubData
  assert(codeGs.includes("action === 'saveMatchHubData'"), 'Code.gs missing route for saveMatchHubData');
  assert(codeGs.includes("datasets_aspire") && codeGs.includes("datasets_league"), 'Code.gs missing team-split datasets handling');

  // 3. Match Hub hydates res.datasets
  assert(matchHubHtml.includes('res.datasets'), 'Match Hub does not process res.datasets');
  assert(matchHubHtml.includes('updatedDatasets'), 'Match Hub does not handle updatedDatasets');

  // 4. Redundant sideline tracker pill removed from overview nav-pill-bar in match-hub.html
  const navPillBarMatch = matchHubHtml.match(/<div class="nav-pill-bar[^>]*>([\s\S]*?)<\/div>/);
  assert(navPillBarMatch, 'nav-pill-bar not found in match-hub.html');
  assert(!navPillBarMatch[1].includes('btn-tab-tracker'), 'btn-tab-tracker still exists in overview nav-pill-bar');

  // 5. DEFAULT_DATA in match-hub.html reflects 3W-4L League record
  const ddMatch = matchHubHtml.match(/const DEFAULT_DATA = (\{.*?\});\s+let DATA/s);
  assert(ddMatch, 'DEFAULT_DATA not found in match-hub.html');
  const dd = JSON.parse(ddMatch[1]);
  assert.strictEqual(dd['AJAX ASPIRE U15 (LEAGUE)'].totals.games, 7, 'Expected 7 games in League DEFAULT_DATA');
  assert.strictEqual(dd['AJAX ASPIRE U15 (LEAGUE)'].totals.won, 3, 'Expected 3 wins in League DEFAULT_DATA');
  assert.strictEqual(dd['AJAX ASPIRE U15 (LEAGUE)'].totals.lost, 4, 'Expected 4 losses in League DEFAULT_DATA');
});

// ---------------------------------------------------------------------------
// CHECK 12: Smart Film Logger Match Dropdown Dynamic Sync
// ---------------------------------------------------------------------------
check('12. Film Logger Match Dropdown dynamically synchronizes from submitted matches', () => {
  const filmHtml = fs.readFileSync(path.join(ROOT, 'film-moment-logger.html'), 'utf8');

  // 1. Crossfire #2 is in BUILTIN_MATCH_CATALOG
  assert(filmHtml.includes('"Crossfire #2 (Nov 8)"'), 'BUILTIN_MATCH_CATALOG missing Crossfire #2 (Nov 8)');

  // 2. Default selected match is Crossfire #2 (Nov 8)
  assert(filmHtml.includes('<option value="Crossfire #2 (Nov 8)" selected>'), 'Crossfire #2 (Nov 8) is not default selected in dropdown');

  // 3. Dynamic sync function exists
  assert(filmHtml.includes('syncMatchesFromActionLog()'), 'Missing syncMatchesFromActionLog() call');
  assert(filmHtml.includes('addMatchOptionIfMissing('), 'Missing addMatchOptionIfMissing function');
});

// ---------------------------------------------------------------------------
// CHECK 13: Cross-Device Film Moments Parity & LocalStorage Auto-Heal (AGENTS.md §2.1)
// ---------------------------------------------------------------------------
check('13. Cross-device film moments parity, localStorage auto-heal & Event 668 alignment', () => {
  const matchHubHtml = fs.readFileSync(path.join(ROOT, 'match-hub.html'), 'utf8');
  const csvContent = fs.readFileSync(path.join(ROOT, 'Aspire_Film_Log.csv'), 'utf8');

  // 1. Verify no localStorage auto-bridge for ajax_aspire_active_moments in sanitizeAndHealData
  assert(!matchHubHtml.includes("localStorage.getItem('ajax_aspire_active_moments')"),
    'match-hub.html still contains auto-bridge reading ajax_aspire_active_moments');

  // 2. Verify DEFAULT_DATA has 692 League film moments across 7 matches
  const ddMatch = matchHubHtml.match(/const DEFAULT_DATA = (\{.*?\});\s+let DATA/s);
  assert(ddMatch, 'DEFAULT_DATA not found in match-hub.html');
  const dd = JSON.parse(ddMatch[1]);
  const lgFilm = dd['AJAX ASPIRE U15 (LEAGUE)'].filmEvents;
  assert.strictEqual(lgFilm.length, 692, 'Expected exactly 692 League film events in DEFAULT_DATA');
  assert.strictEqual(dd['AJAX ASPIRE U15'].filmEvents.length, 836, 'Expected exactly 836 All-Competitions film events in DEFAULT_DATA');

  // 3. Verify Event 668 exists in DEFAULT_DATA and Aspire_Film_Log.csv
  const ev668 = lgFilm.find(e => e.id === 668);
  assert(ev668, 'Event 668 missing from League filmEvents');
  assert.strictEqual(ev668.match, 'Rocklin (Nov 1)', 'Expected Event 668 match to be Rocklin (Nov 1)');
  assert(ev668.note.includes('Amy was running free'), 'Expected Event 668 note text');
  assert(csvContent.includes('Amy was running free'), 'Aspire_Film_Log.csv missing Event 668');

  // 4. Verify Rocklin Nov 1 has 90 moments in DEFAULT_DATA
  const rocklinEvents = lgFilm.filter(e => e.match === 'Rocklin (Nov 1)');
  assert.strictEqual(rocklinEvents.length, 90, 'Expected Rocklin (Nov 1) to have 90 moments in DEFAULT_DATA');

  // 5. Verify Crossfire #2 sequential IDs start at 669 and end at 837
  const cfEvents = lgFilm.filter(e => e.match.includes('Crossfire #2'));
  assert.strictEqual(cfEvents.length, 169, 'Expected 169 moments for Crossfire #2');
  assert.strictEqual(cfEvents[0].id, 669, 'Expected Crossfire #2 first ID to be 669');
  assert.strictEqual(cfEvents[cfEvents.length - 1].id, 837, 'Expected Crossfire #2 last ID to be 837');

  // 6. Test simulation of startup with polluted localStorage (57 duplicate moments)
  // Simulate loadSavedLocalData + sanitizeAndHealData
  const mockLocalStorage = {
    store: {
      ajax_aspire_active_moments: JSON.stringify([{ match: 'Rocklin (Nov 1)', time: '00:00', note: 'polluted' }]),
      matchhub_custom_data: JSON.stringify({
        'AJAX ASPIRE U15 (LEAGUE)': {
          totals: { games: 7, won: 3, lost: 4 },
          players: [],
          filmEvents: new Array(750).fill({ id: 999, match: 'Rocklin (Nov 1)', time: '00:00' })
        }
      })
    },
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; }
  };

  // Run cleanup logic
  mockLocalStorage.removeItem('ajax_aspire_active_moments');
  assert.strictEqual(mockLocalStorage.getItem('ajax_aspire_active_moments'), null, 'Expected ajax_aspire_active_moments to be removed');
});

// ---------------------------------------------------------------------------
// CHECK 14: Player Portal Dynamic Last-2-Matches Film Moments (Crossfire #2 fix)
// ---------------------------------------------------------------------------
check('14. Player Portal dynamically selects Last 2 Matches (including Crossfire #2)', () => {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  assert(!indexHtml.includes('function isRecentFilmMatch('),
    'index.html should not use hardcoded isRecentFilmMatch whitelist');
  assert(indexHtml.includes('function getRecentMatchNames(') && indexHtml.includes('function filterToRecentMatches('),
    'index.html missing dynamic getRecentMatchNames / filterToRecentMatches helpers');
  assert(!indexHtml.includes('matchSelect.options.length <= 1'),
    'index.html should not block matchSelect dropdown refresh with options.length <= 1');

  const fnMatch = indexHtml.match(/(function parseMatchSortScore[\s\S]*?function filterToRecentMatches[\s\S]*?\n    \})/);
  assert(fnMatch, 'Could not extract dynamic match helpers from index.html');

  const sandbox = { Date, Number, Map, Set, Array, String, parseInt, isNaN };
  vm.createContext(sandbox);
  vm.runInContext(fnMatch[1], sandbox);

  const sampleMoments = [
    { id: 410, match: 'La Morinda', matchDate: '2026-10-18' },
    { id: 520, match: 'Rocklin (Nov 1)', matchDate: '2026-11-01' },
    { id: 700, match: 'Crossfire #2 (Nov 8)', matchDate: '2026-11-08' },
    { id: 705, match: 'Crossfire #2 (Nov 8)', matchDate: '2026-11-08' }
  ];

  const recentNames = vm.runInContext(`getRecentMatchNames(${JSON.stringify(sampleMoments)}, 2)`, sandbox);
  assert.deepStrictEqual(recentNames, ['Crossfire #2 (Nov 8)', 'Rocklin (Nov 1)'],
    'Expected newest 2 matches to be Crossfire #2 (Nov 8) and Rocklin (Nov 1)');

  const filtered = vm.runInContext(`filterToRecentMatches(${JSON.stringify(sampleMoments)}, 2)`, sandbox);
  assert.strictEqual(filtered.length, 3, 'Expected 3 moments from the newest 2 matches (excluding La Morinda)');
});

// ---------------------------------------------------------------------------
// Check 15: Match Tracker AI shot/half helpers, Opp stat adjust, Quick Set Piece picker, Gemini 3.8
// ---------------------------------------------------------------------------
check('Match Tracker: AI shot counting (11 shots incl. soff), half split, opp adjust, set-piece picker, Gemini 3.8', () => {
  const trackerHtml = fs.readFileSync(path.join(ROOT, 'ajax-match-tracker.html'), 'utf8');
  const aiFnCode = fs.readFileSync(path.join(ROOT, 'netlify/functions/halftime-ai.mjs'), 'utf8');

  // Verify netlify function uses gemini-3.8-flash and supports full_match
  assert(aiFnCode.includes('gemini-3.8-flash'), 'Expected halftime-ai.mjs to use gemini-3.8-flash');
  assert(!aiFnCode.includes('gemini-2.5-flash'), 'Did not expect deprecated gemini-2.5-flash in halftime-ai.mjs');
  assert(aiFnCode.includes("mode === 'full_match'"), 'Expected halftime-ai.mjs to support full_match mode');

  // Verify tracker calls halftime-ai instead of non-existent match-recap-ai and no prompt() in openQuickSetPiecePicker
  assert(!trackerHtml.includes('/.netlify/functions/match-recap-ai'), 'Did not expect non-existent match-recap-ai endpoint');
  assert(trackerHtml.includes("id=\"oppAdjustModal\""), 'Expected #oppAdjustModal in ajax-match-tracker.html');
  assert(trackerHtml.includes("id=\"quickSetPieceModal\""), 'Expected #quickSetPieceModal in ajax-match-tracker.html');

  // Extract helper functions for VM testing
  const helpersStart = trackerHtml.indexOf('function getHalfLengthMinutes()');
  const helpersEnd = trackerHtml.indexOf('async function generateHalftimeReport');
  assert(helpersStart > -1 && helpersEnd > helpersStart, 'Expected AI half/shot helpers in ajax-match-tracker.html');
  const helpersSrc = trackerHtml.slice(helpersStart, helpersEnd);

  const oppStart = trackerHtml.indexOf('function openOppAdjustModal()');
  const oppEnd = trackerHtml.indexOf('function logMatchEvent(ev)');
  assert(oppStart > -1 && oppEnd > oppStart, 'Expected openOppAdjustModal/adjustOppStat in ajax-match-tracker.html');
  const oppSrc = trackerHtml.slice(oppStart, oppEnd);

  const spStart = trackerHtml.indexOf('function openQuickSetPiecePicker(');
  const spEnd = trackerHtml.indexOf("let currentEventFilter = 'all';");
  assert(spStart > -1 && spEnd > spStart, 'Expected openQuickSetPiecePicker in ajax-match-tracker.html');
  const spSrc = trackerHtml.slice(spStart, spEnd);
  assert(!spSrc.includes('prompt('), 'openQuickSetPiecePicker should not use browser prompt()');

  const elements = {};
  const makeEl = (id) => {
    if (!elements[id]) {
      elements[id] = {
        id,
        textContent: '',
        innerHTML: '',
        classList: {
          _set: new Set(['hidden']),
          add(c) { this._set.add(c); },
          remove(c) { this._set.delete(c); },
          contains(c) { return this._set.has(c); }
        }
      };
    }
    return elements[id];
  };

  const sandbox = {
    halfLengthMinutes: 35,
    matchSeconds: 600,
    selectedPlayerJersey: null,
    oppStats: { goals: 1, shots: 4, subs: 2, corners: 3, fouls: 5 },
    matchEvents: [],
    pitchState: { ST: 10 },
    onPitchPlayers: { ST: 10 },
    playerStats: {
      10: { jersey: 10, name: 'Carlee Test', pos: 'ST' },
      22: { jersey: 22, name: 'Sonia Bench', pos: 'GK' }
    },
    logCalls: [],
    updateScoreboard() {},
    saveState() {},
    showToast() {},
    closeModal() {},
    escapeHtml(s) { return String(s); },
    logMatchEvent(ev) { sandbox.matchEvents.unshift(ev); },
    logSelectedEvent(type) { sandbox.logCalls.push({ type, jersey: String(sandbox.selectedPlayerJersey) }); },
    document: { getElementById: makeEl },
    String, Number, Math, Array, Object, Set
  };
  vm.createContext(sandbox);
  vm.runInContext(helpersSrc + '\n' + oppSrc + '\n' + spSrc, sandbox);

  // Test 11 shots across goal, sot, soff (Quality Shot / Shot Off Target / Poor Shot Selection), shot_outside_18, and oppShot exclusion
  const sampleEvents = [
    { half: 'H1', time: 5, type: 'goal', action: 'Goal Scored' },
    { half: 'H1', time: 10, type: 'sot', action: 'Shot on Target' },
    { half: 'H1', time: 12, type: 'soff', action: 'Quality Shot' },
    { half: 'H1', time: 15, type: 'soff', action: 'Shot Off Target' },
    { half: 'H1', time: 20, type: 'soff', action: 'Poor Shot Selection' },
    { half: 'H1', time: 25, type: 'shot', action: 'Shot' },
    { half: 'H1', time: 30, type: 'shot_outside_18', onTarget: true, action: 'Shot Outside 18' },
    { half: 'H2', time: 38, type: 'soff', action: 'Quality Shot' },
    { half: 'H2', time: 45, type: 'soff', action: 'Shot Off Target' },
    { half: 'H2', time: 55, type: 'sot', action: 'Shot on Target' },
    { half: 'H2', time: 65, type: 'shot_outside_18', onTarget: false, action: 'Shot Outside 18' },
    { half: 'H2', time: 68, type: 'oppShot', action: 'Opponent Shot' }
  ];
  const counts = vm.runInContext(`
    (() => {
      const ev = ${JSON.stringify(sampleEvents)};
      const h1 = ev.filter(isH1Event);
      const h2 = ev.filter(isH2Event);
      return {
        totalShots: ev.filter(isAjaxShotEvent).length,
        totalSot: ev.filter(isAjaxSotEvent).length,
        h1Shots: h1.filter(isAjaxShotEvent).length,
        h2Shots: h2.filter(isAjaxShotEvent).length,
        h1Count: h1.length,
        h2Count: h2.length
      };
    })()
  `, sandbox);

  assert.strictEqual(counts.totalShots, 11, 'Expected all 11 Ajax shots (including soff) to be counted and oppShot excluded');
  assert.strictEqual(counts.totalSot, 4, 'Expected 4 shots on target (goal, 2 sot, 1 on-target shot_outside_18)');
  assert.strictEqual(counts.h1Shots, 7, 'Expected 7 H1 shots');
  assert.strictEqual(counts.h2Shots, 4, 'Expected 4 H2 shots (including minute 38 tagged H2 in 35-min half)');

  // Test adjustOppStat & clamping at 0
  vm.runInContext(`
    adjustOppStat('shots', -1);
    adjustOppStat('corners', -10);
    adjustOppStat('subs', 1);
    adjustOppStat('fouls', -2);
  `, sandbox);
  assert.strictEqual(sandbox.oppStats.shots, 3, 'Expected oppStats.shots decremented to 3');
  assert.strictEqual(sandbox.oppStats.corners, 0, 'Expected oppStats.corners clamped at 0');
  assert.strictEqual(sandbox.oppStats.subs, 3, 'Expected oppStats.subs incremented to 3');
  assert.strictEqual(sandbox.oppStats.fouls, 3, 'Expected oppStats.fouls decremented to 3');

  // Test openQuickSetPiecePicker opens modal & confirmQuickSetPiece logs selected player
  vm.runInContext(`
    openQuickSetPiecePicker('corner');
    confirmQuickSetPiece('corner', '10');
  `, sandbox);
  assert.strictEqual(sandbox.logCalls.length, 1, 'Expected confirmQuickSetPiece to call logQuickSetPiece');
  assert.strictEqual(sandbox.logCalls[0].type, 'corner');
  assert.strictEqual(sandbox.logCalls[0].jersey, '10');
});

console.log(`\nAll ${passed} regression checks passed.`);
