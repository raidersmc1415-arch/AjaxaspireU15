// ============================================================
// AJAX ASPIRE U15 — MASTER DATA HUB SCRIPT
// v2.1 — Cleaned up & optimized:
//   • Streak calculation added to Challenge Leaderboard
//   • normName() applied in getCoachingVideos()
//   • Any Coach_* rating (not just Dribbling) triggers Coach Ratings view
//   • Duplicate filmMoments route & redundant norm() removed
//   • Guard on iIDP !== -1 in saveIDPToPlayerRow()
// Copy entire file and replace everything in Apps Script
// ============================================================

// GLOBAL: normalize a player name so "Carlee,Gowan", "Carlee Gowan",
// and "Amy Godínez Vargas" all resolve cleanly and diacritic-insensitively everywhere.
function normName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Global JSON Output Helper for Web App
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// True when a Raw_Match_Stats row is the TEAM aggregate line, not a player
function isTeamRow(name) {
  var n = normName(name);
  return n === 'team' || n === 'total' || n === 'totals' || n === 'team total' || n === 'team totals';
}

// --- PART 1: COACH MENU ---
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚽ Ajax Coach Tools')
    .addItem('Sync Match Stats', 'syncMatchData')
    .addItem('Heal Team Record (6-0-7)', 'healTeamAggregate')
    .addToUi();
}

// --- PART 2: MATCH DATA SYNC ---
function syncMatchData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rawSheet = ss.getSheetByName('Raw_Match_Stats');
  const idpSheet = ss.getSheetByName('Player_IDP');
  if (!rawSheet || !idpSheet) {
    SpreadsheetApp.getUi().alert('Missing tabs! Ensure Raw_Match_Stats and Player_IDP exist.');
    return;
  }
  const rawData = rawSheet.getDataRange().getValues();
  const idpData = idpSheet.getDataRange().getValues();

  let headerRowIndex = -1;
  let rawHeaders = [];
  for (let r = 0; r < Math.min(10, rawData.length); r++) {
    let h = rawData[r].map(v => v.toString().replace(/"/g, '').trim().toLowerCase());
    if (h.includes('player') && h.includes('position')) {
      headerRowIndex = r; rawHeaders = h; break;
    }
  }
  if (headerRowIndex === -1) {
    SpreadsheetApp.getUi().alert("VAR REVIEW 🚩: Cannot find 'Player' and 'Position' headers in Raw_Match_Stats.");
    return;
  }

  // Helper: find first matching header among naming variants (CSV apps differ)
  const findH = (variants) => {
    for (var v = 0; v < variants.length; v++) {
      var idx = rawHeaders.indexOf(variants[v]);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const rName=rawHeaders.indexOf('player'), rPos=rawHeaders.indexOf('position'),
        rGames=rawHeaders.indexOf('games played'),
        rMins=rawHeaders.indexOf('minutes played'), rGoals=rawHeaders.indexOf('goals'),
        rAssists=rawHeaders.indexOf('assists'), rShots=rawHeaders.indexOf('shots on target'),
        rShotsOff=rawHeaders.indexOf('shots off target'), rFouls=rawHeaders.indexOf('fouls'),
        rCS=findH(['clean sheets','clean sheet','cs']),
        rWin=findH(['win %','win%','win percentage','win pct']),
        rTO=rawHeaders.indexOf('turnover defending 3rd'), rKP=rawHeaders.indexOf('key passes'),
        rDuels=rawHeaders.indexOf('duels');

  const idpHeaders = idpData[0].map(h => h.toString().trim());
  const iName=idpHeaders.indexOf('Player Name'), iGames=idpHeaders.indexOf('Games Played'),
        iMins=idpHeaders.indexOf('Minutes Played'), iGoals=idpHeaders.indexOf('Goals'),
        iAssists=idpHeaders.indexOf('Assists'), iShots=idpHeaders.indexOf('Shots On Target'),
        iShotsOff=idpHeaders.indexOf('Shots Off Target'), iFouls=idpHeaders.indexOf('Fouls'),
        iCS=idpHeaders.indexOf('Clean Sheets'), iWin=idpHeaders.indexOf('Win %'),
        iTO=idpHeaders.indexOf('Turnovers Def 3rd'), iKP=idpHeaders.indexOf('Key Passes'),
        iDuels=idpHeaders.indexOf('Duels');

  // ── Aggregate raw rows per player ─────────────────────────────
  // Players appear on multiple rows (one per position played) plus an
  // optional TOTAL row. Rule: if a player has a row whose Position is
  // "total" (or blank), use THAT row. Otherwise, SUM their position rows.
  const statCols = { games:rGames, mins:rMins, goals:rGoals, assists:rAssists,
                     shots:rShots, shotsOff:rShotsOff, fouls:rFouls, to:rTO, kp:rKP, duels:rDuels };
  const players = {}; // normName -> { totalRow: rowArray|null, sums: {...} }

  function num(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  for (let rawRow = headerRowIndex + 1; rawRow < rawData.length; rawRow++) {
    const rawName = String(rawData[rawRow][rName] || '').trim();
    if (!rawName || isTeamRow(rawName)) continue;
    const key = normName(rawName);
    const posVal = rPos !== -1 ? String(rawData[rawRow][rPos] || '').trim().toLowerCase() : '';
    const isTotalRow = posVal === 'total' || posVal === 'totals' || posVal === '';

    if (!players[key]) {
      players[key] = { totalRow: null, sums: { games:0, mins:0, goals:0, assists:0, shots:0, shotsOff:0, fouls:0, to:0, kp:0, duels:0 } };
    }
    if (isTotalRow) {
      players[key].totalRow = rawData[rawRow];
    } else {
      for (var s in statCols) {
        if (statCols[s] !== -1) players[key].sums[s] += num(rawData[rawRow][statCols[s]]);
      }
    }
  }

  // For summed players, Games Played should not be a straight sum of
  // per-position rows (same game counted per position). If no total row,
  // use the MAX games value seen instead of the sum. Same logic applies
  // to Clean Sheets and Win % — they can't be summed across positions.
  const maxGames = {}, maxCS = {}, maxWin = {};
  for (let rawRow = headerRowIndex + 1; rawRow < rawData.length; rawRow++) {
    const rawName = String(rawData[rawRow][rName] || '').trim();
    if (!rawName || isTeamRow(rawName)) continue;
    const key = normName(rawName);
    const posVal = rPos !== -1 ? String(rawData[rawRow][rPos] || '').trim().toLowerCase() : '';
    if (posVal === 'total' || posVal === 'totals' || posVal === '') continue;
    if (rGames !== -1) maxGames[key] = Math.max(maxGames[key] || 0, num(rawData[rawRow][rGames]));
    if (rCS    !== -1) maxCS[key]    = Math.max(maxCS[key]    || 0, num(rawData[rawRow][rCS]));
    if (rWin   !== -1) maxWin[key]   = Math.max(maxWin[key]   || 0, num(rawData[rawRow][rWin]));
  }

  let updateCount = 0;
  for (let idpRow = 1; idpRow < idpData.length; idpRow++) {
    const idpName = String(idpData[idpRow][iName] || '').trim();
    if (!idpName) continue;
    const p = players[normName(idpName)];
    if (!p) continue;

    const setVal = (col, val) => {
      if (col !== -1 && val !== null && val !== undefined && val !== '') {
        idpSheet.getRange(idpRow + 1, col + 1).setValue(val);
      }
    };

    if (p.totalRow) {
      // Use the player's TOTAL row directly
      const tr = p.totalRow;
      const g = (c) => c !== -1 ? tr[c] : '';
      setVal(iGames, g(rGames)); setVal(iMins, g(rMins)); setVal(iGoals, g(rGoals));
      setVal(iAssists, g(rAssists)); setVal(iShots, g(rShots)); setVal(iShotsOff, g(rShotsOff));
      setVal(iFouls, g(rFouls)); setVal(iCS, g(rCS)); setVal(iWin, g(rWin));
      setVal(iTO, g(rTO)); setVal(iKP, g(rKP)); setVal(iDuels, g(rDuels));
    } else {
      // No total row — use summed position rows (games/CS/win% = max, not sum)
      const key2 = normName(idpName);
      setVal(iGames, maxGames[key2] || p.sums.games);
      setVal(iCS,  maxCS[key2]  !== undefined ? maxCS[key2]  : '');
      setVal(iWin, maxWin[key2] !== undefined ? maxWin[key2] : '');
      setVal(iMins, p.sums.mins); setVal(iGoals, p.sums.goals);
      setVal(iAssists, p.sums.assists); setVal(iShots, p.sums.shots);
      setVal(iShotsOff, p.sums.shotsOff); setVal(iFouls, p.sums.fouls);
      setVal(iTO, p.sums.to); setVal(iKP, p.sums.kp); setVal(iDuels, p.sums.duels);
    }
    updateCount++;
  }
  SpreadsheetApp.getUi().alert(`✅ Sync complete. Updated stats for ${updateCount} players.`);
}

// --- PART 3: API BRIDGE ---

function doGet(e) {
  if (e.parameter.action === 'coachingVideos')       return getCoachingVideos(e.parameter.name);
  if (e.parameter.action === 'coachRatings')         return getCoachRatings(e.parameter.name);
  if (e.parameter.action === 'challengeLeaderboard') return getChallengeLeaderboard();
  if (e.parameter.action === 'coachMessage')         return getCoachMessage();
  if (e.parameter.action === 'moments')              return getMoments();
  if (e.parameter.action === 'reflections')          return getPlayerReflections(e.parameter.name);
  if (e.parameter.action === 'verifyPin')            return verifyPin(e.parameter.name, e.parameter.pin);
  if (e.parameter.action === 'teamStats')            return getTeamStats();
  if (e.parameter.action === 'filmMoments')          return getFilmMoments();
  if (e.parameter.action === 'matchHub')             return getMatchHubData(e.parameter.pin);
  if (e.parameter.action === 'syncMatchData')        return handleSyncMatchData(e.parameter.pin);
  if (e.parameter.action === 'healTeamAggregate')    return jsonOut(healTeamAggregate());
  if (e.parameter.action === 'playerFilmMoments')   return getPlayerFilmMoments(e.parameter.name);
  return handlePlayerLogin(e);
}

function doPost(e) {
  try {
    if (!e.postData || !e.postData.contents) throw new Error('No data received');
    const payload = JSON.parse(e.postData.contents);

    if (payload.action === 'challengeCheckin')      return handleChallengeCheckin(payload);
    if (payload.action === 'saveMatchHubNote')      return handleSaveMatchHubNote(payload);
    if (payload.action === 'saveMatchHubTakeaways') return handleSaveMatchHubTakeaways(payload);
    if (payload.action === 'saveMatchHubData')      return handleSaveMatchHubData(payload);
    if (payload.action === 'saveFilmMoments')       return handleSaveFilmMoments(payload);
    if (payload.action === 'updateSeasonStats')     return handleUpdateSeasonStats(payload);

    // IDP submission — write JSON blob into Player_IDP column M (IDP_Submitted)
    if (payload.reflection && payload.reflection.indexOf('[IDP SUBMISSION]') === 0 && payload.idpData) {
      saveIDPToPlayerRow(payload.name, payload.idpData);
    }

    // Always also log to Reflections_Log for history
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Reflections_Log');
    sheet.appendRow([new Date(), payload.name, payload.reflection]);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, message: 'Data logged' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Write the player's IDP JSON into Player_IDP!IDP_Submitted (col M)
function saveIDPToPlayerRow(playerName, idpDataObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Player_IDP');
  if (!sheet) return false;
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().trim());
  const iName = headers.indexOf('Player Name');
  const iIDP  = headers.indexOf('IDP_Submitted');
  if (iName === -1 || iIDP === -1) return false;
  const search = normName(playerName);

  for (let i = 1; i < data.length; i++) {
    if (normName(data[i][iName]) === search) {
      sheet.getRange(i + 1, iIDP + 1).setValue(JSON.stringify(idpDataObj));
      return true;
    }
  }
  return false;
}

// --- PART 4: PLAYER LOGIN ---
// Returns player profile + their own IDP self-ratings (parsed from col M)

function handlePlayerLogin(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Player_IDP');
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().trim());

  const iName=headers.indexOf('Player Name'), iPIN=headers.indexOf('PIN'),
        iNum=(headers.indexOf('Jersey #') !== -1 ? headers.indexOf('Jersey #') : headers.indexOf('Number')),
        iNotes=headers.indexOf('Coach Notes'), iGames=headers.indexOf('Games Played'),
        iMins=headers.indexOf('Minutes Played'), iAvg=headers.indexOf('Average Minutes'),
        iShots=headers.indexOf('Shots On Target'), iGoals=headers.indexOf('Goals'),
        iAssist=headers.indexOf('Assists'), iTO=headers.indexOf('Turnovers Def 3rd'),
        iKP=headers.indexOf('Key Passes'), iDuels=headers.indexOf('Duels'),
        iIDP=headers.indexOf('IDP_Submitted');

  const reqName = e.parameter.name;
  const reqPIN  = String(e.parameter.pin || '').trim();

  for (let i = 1; i < data.length; i++) {
    const rowName = String(data[i][iName] || '').trim();
    const rowPIN  = String(data[i][iPIN]  || '').trim();
    if (normName(rowName) === normName(reqName) && rowPIN === reqPIN && rowPIN !== '') {

      // Parse IDP blob from column M if present
      let idpSubmitted = false;
      let idpData = null;
      const rawIDP = iIDP !== -1 ? data[i][iIDP] : null;
      if (rawIDP && typeof rawIDP === 'string' && rawIDP.trim().startsWith('{')) {
        try {
          idpData = JSON.parse(rawIDP);
          idpSubmitted = true;
        } catch(err) { /* malformed — treat as not submitted */ }
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        name: rowName,
        jersey: (iNum !== -1 ? data[i][iNum] : null),
        notes: data[i][iNotes] || '',
        idpSubmitted: idpSubmitted,
        idpData: idpData,
        stats: {
          gamesPlayed:   data[i][iGames]  || '',
          minutes:       data[i][iMins]   || '',
          avgMinutes:    data[i][iAvg]    || '',
          shotsOnTarget: data[i][iShots]  || '',
          goals:         data[i][iGoals]  || '',
          assists:       data[i][iAssist] || '',
          turnoversDef:  data[i][iTO]     || '',
          keyPasses:     data[i][iKP]     || '',
          duels:         data[i][iDuels]  || ''
        }
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, message: 'Invalid Name or PIN' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- PART 5: COACH RATINGS ---
// Reads Coach_* columns from Player_IDP, plus player's own ratings from col M

function getCoachRatings(playerName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Player_IDP');
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().trim());
    const search = normName(playerName);

    const iName=headers.indexOf('Player Name'), iIDP=headers.indexOf('IDP_Submitted');
    const cols = {
      t_dribbling:'Coach_T_Dribbling', t_passing:'Coach_T_Passing', t_movement:'Coach_T_Movement',
      t_duels:'Coach_T_Duels', t_touch:'Coach_T_Touch', tac_support:'Coach_Tac_Support',
      tac_restdef:'Coach_Tac_RestDef', tac_press:'Coach_Tac_Press', tac_attack:'Coach_Tac_Attack',
      tac_defend:'Coach_Tac_Defend'
    };
    const commentCols = {};
    Object.keys(cols).forEach(k => { commentCols[k] = cols[k] + '_Comment'; });

    for (let i = 1; i < data.length; i++) {
      if (normName(data[i][iName]) !== search) continue;
      const row = data[i];

      const ratings = {};
      const comments = {};
      let hasRatings = false;
      Object.keys(cols).forEach(key => {
        const ci = headers.indexOf(cols[key]);
        const cci = headers.indexOf(commentCols[key]);
        const val = ci !== -1 ? Number(row[ci]) || 0 : 0;
        if (val > 0) hasRatings = true;
        ratings[key]  = val;
        comments[key] = cci !== -1 ? String(row[cci] || '').trim() : '';
      });

      if (!hasRatings) {
        return ContentService.createTextOutput(JSON.stringify({ found: false }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Player's own ratings, parsed from IDP_Submitted JSON blob
      let playerRatings = null;
      const rawIDP = iIDP !== -1 ? row[iIDP] : null;
      if (rawIDP && typeof rawIDP === 'string' && rawIDP.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(rawIDP);
          playerRatings = {};
          Object.keys(cols).forEach(key => { playerRatings[key] = Number(parsed[key]) || 0; });
        } catch(err) { /* ignore */ }
      }

      return ContentService.createTextOutput(JSON.stringify({
        found: true,
        ratings: ratings,
        comments: comments,
        playerRatings: playerRatings
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ found: false }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ found: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- PART 6: COACHING VIDEOS ---

function getCoachingVideos(playerName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('coaching_videos');
    if (!sheet) return ContentService.createTextOutput(JSON.stringify({ videos: [] })).setMimeType(ContentService.MimeType.JSON);
    const data = sheet.getDataRange().getValues();
    const videos = [];
    const search = normName(playerName);
    for (let i = 1; i < data.length; i++) {
      if (normName(data[i][0]) === search && data[i][2]) {
        videos.push({ title: String(data[i][1]||'').trim(), url: String(data[i][2]||'').trim(), coach_note: String(data[i][3]||'').trim() });
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ videos })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ videos: [], error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- PART 7: COMPETITION HUB ---

function getChallengeLeaderboard() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Find active challenge from challenges tab
    // Columns: A=title, B=id, C=start_date, D=end_date, E=description, F=video_url
    var currentChallenge = null;

    function fmtDate(d) {
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d || '');
      var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      return months[dt.getMonth()] + ' ' + dt.getDate() + ', ' + dt.getFullYear();
    }

    function toIsoDate(v) {
      if (v instanceof Date && !isNaN(v.getTime())) {
        var y = v.getFullYear();
        var m = String(v.getMonth() + 1).padStart(2, '0');
        var d = String(v.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
      }
      return String(v || '').split('T')[0].trim();
    }

    function buildChallenge(row, isActive) {
      return {
        title:       String(row[0] || ''),
        id:          String(row[1] || ''),
        startDate:   fmtDate(row[2]),
        endDate:     fmtDate(row[3]),
        description: String(row[4] || ''),
        video:       String(row[5] || '').trim(),
        active:      isActive
      };
    }

    var challengeSheet = ss.getSheetByName('challenges');
    if (challengeSheet) {
      var challenges = challengeSheet.getDataRange().getValues();
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      for (var i = 1; i < challenges.length; i++) {
        var start = new Date(challenges[i][2]);
        var end   = new Date(challenges[i][3]);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        if (today >= start && today <= end) {
          currentChallenge = buildChallenge(challenges[i], true);
          break;
        }
      }
      // fallback to last challenge if none active — marked NOT active
      if (!currentChallenge && challenges.length > 1) {
        currentChallenge = buildChallenge(challenges[challenges.length - 1], false);
      }
    }

    // Read challenge_log
    var logSheet = ss.getSheetByName('challenge_log');
    if (!logSheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ current: [], season: [], badges: [], debug: 'no challenge_log tab' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var log = logSheet.getDataRange().getValues();
    var currentTotals = {};
    var seasonTotals  = {};
    var currentDates  = {}; // normName -> { 'YYYY-MM-DD': true }
    var seasonDates   = {}; // normName -> { 'YYYY-MM-DD': true }
    var displayNames  = {}; // normalized key -> clean display name

    for (var j = 1; j < log.length; j++) {
      var rawName = String(log[j][0] || '').trim();
      var chalId  = String(log[j][1] || '').trim();
      if (!rawName || isTeamRow(rawName)) continue;

      // Tally by NORMALIZED name so "Giselle,Rosales" and "Giselle Rosales"
      // count as one player. Display uses a cleaned version of the name.
      var key = normName(rawName);
      if (!displayNames[key]) {
        displayNames[key] = rawName.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
      }

      var videoDone = (log[j][3] === true || String(log[j][3]).toLowerCase() === 'true');
      var fitDone   = (log[j][4] === true || String(log[j][4]).toLowerCase() === 'true');
      var pts = (videoDone || fitDone) ? 1 : 0;
      var dateStr = toIsoDate(log[j][2]);

      if (!seasonTotals[key]) seasonTotals[key] = 0;
      seasonTotals[key] += pts;
      if (pts > 0 && dateStr) {
        if (!seasonDates[key]) seasonDates[key] = {};
        seasonDates[key][dateStr] = true;
      }

      if (currentChallenge && chalId === currentChallenge.id) {
        if (!currentTotals[key]) currentTotals[key] = 0;
        currentTotals[key] += pts;
        if (pts > 0 && dateStr) {
          if (!currentDates[key]) currentDates[key] = {};
          currentDates[key][dateStr] = true;
        }
      }
    }

    // Compute consecutive-day streak ending at the player's latest logged day
    function calcStreak(dateMap) {
      if (!dateMap) return 0;
      var days = Object.keys(dateMap).sort();
      if (!days.length) return 0;
      var streak = 1;
      for (var d = days.length - 1; d > 0; d--) {
        var curr = new Date(days[d] + 'T00:00:00');
        var prev = new Date(days[d - 1] + 'T00:00:00');
        var diffDays = Math.round((curr - prev) / 86400000);
        if (diffDays === 1) streak++;
        else break;
      }
      return streak;
    }

    // Convert totals objects to sorted arrays
    function toRows(totals, datesByPlayer) {
      var rows = [];
      var keys = Object.keys(totals);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        rows.push({
          name:   displayNames[key] || key,
          points: totals[key],
          streak: calcStreak(datesByPlayer[key])
        });
      }
      rows.sort(function(a, b) { return b.points - a.points || b.streak - a.streak; });
      return rows.slice(0, 15);
    }

    // Read badges
    var badges = [];
    var badgeSheet = ss.getSheetByName('challenge_badges');
    if (badgeSheet) {
      var badgeData = badgeSheet.getDataRange().getValues();
      for (var b = 1; b < badgeData.length; b++) {
        if (badgeData[b][0]) {
          var rawDate = badgeData[b][3];
          var cleanDate = '';
          if (rawDate instanceof Date) {
            cleanDate = (rawDate.getMonth()+1) + '/' + rawDate.getDate() + '/' + rawDate.getFullYear();
          } else {
            cleanDate = String(rawDate || '').split('T')[0].trim();
          }
          badges.push({
            name:      String(badgeData[b][0]).trim(),
            badgeName: String(badgeData[b][1]).trim(),
            type:      String(badgeData[b][2]).trim(),
            date:      cleanDate
          });
        }
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        current:   toRows(currentTotals, currentDates),
        season:    toRows(seasonTotals, seasonDates),
        badges:    badges,
        challenge: currentChallenge,
        debug:     { logRows: log.length - 1 }
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ current: [], season: [], badges: [], error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function handleChallengeCheckin(body) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const name = String(body.name || '').trim(), pin = String(body.pin || '').trim();
    const idpSheet = ss.getSheetByName('Player_IDP');
    const idpData = idpSheet.getDataRange().getValues();
    const headers = idpData[0].map(h => h.toString().trim());
    const iName = headers.indexOf('Player Name'), iPIN = headers.indexOf('PIN');
    let verified = false;
    let canonicalName = name;
    for (let i = 1; i < idpData.length; i++) {
      if (normName(idpData[i][iName]) === normName(name) && String(idpData[i][iPIN]||'').trim() === pin && pin !== '') {
        verified = true;
        canonicalName = String(idpData[i][iName] || name).trim();
        break;
      }
    }
    if (!verified) return ContentService.createTextOutput(JSON.stringify({ success: false, invalidPin: true })).setMimeType(ContentService.MimeType.JSON);

    let logSheet = ss.getSheetByName('challenge_log');
    if (!logSheet) { logSheet = ss.insertSheet('challenge_log'); logSheet.appendRow(['name','challenge_id','date','video_complete','fit_complete','reflection','timestamp']); }

    function toIsoDate(v) {
      if (v instanceof Date && !isNaN(v.getTime())) {
        var y = v.getFullYear();
        var m = String(v.getMonth() + 1).padStart(2, '0');
        var d = String(v.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
      }
      return String(v || '').split('T')[0].trim();
    }

    const today = String(body.date||'').trim(), chalId = String(body.challenge||'').trim();
    const logData = logSheet.getDataRange().getValues();
    for (let j = 1; j < logData.length; j++) {
      if (normName(logData[j][0]) === normName(name) && String(logData[j][1]).trim() === chalId && toIsoDate(logData[j][2]) === today) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, alreadyLogged: true })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    logSheet.appendRow([canonicalName, chalId, today, body.videoComplete === true || String(body.videoComplete)==='true', body.fitComplete === true || String(body.fitComplete)==='true', String(body.reflection||'').trim(), new Date().toISOString()]);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- PART 8: MESSAGE FROM COACH ---
// Reads a single message from the 'coach_communication' tab (row 2, cols A/B)
// Tab layout: A1=message header, B1=last_updated header
//             A2=the message text,  B2=date string (e.g. "June 16, 2026")
// Update cell A2 (and optionally B2) any time — no redeploy needed.

function getCoachMessage() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('coach_communication');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ message: '' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const data = sheet.getDataRange().getValues();
    // Row 2 (index 1) holds the current message
    const message     = data.length > 1 ? String(data[1][0] || '').trim() : '';
    const lastUpdated = data.length > 1 ? String(data[1][1] || '').trim() : '';

    return ContentService.createTextOutput(JSON.stringify({ message, lastUpdated }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ message: '', error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- PART 9: MOMENTS THAT MATTER ---
// Reads from 'moments' tab in Google Sheet
// Header row expected: Event Type | Player | Moment  (Date optional)
// Newest wall entries show first (script reverses the order)

function getMoments() {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('moments');
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ moments: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({ moments: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Header row expected: Event Type | Player | Moment  (Date optional)
    var h = data[0].map(function(x){ return String(x).trim().toLowerCase(); });
    var iType   = h.indexOf('event type');
    var iPlayer = h.indexOf('player');
    var iMoment = h.indexOf('moment');
    var iDate   = h.indexOf('date');
    // Fallbacks if headers are simply in order
    if (iType === -1)   iType = 0;
    if (iPlayer === -1) iPlayer = 1;
    if (iMoment === -1) iMoment = 2;

    function fmtDate(v) {
      if (v instanceof Date) {
        return (v.getMonth()+1) + '/' + v.getDate() + '/' + v.getFullYear();
      }
      return String(v || '').trim();
    }

    var moments = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var moment = String(row[iMoment] || '').trim();
      if (!moment) continue; // skip blank rows
      moments.push({
        eventType: String(row[iType]   || '').trim(),
        player:    String(row[iPlayer] || '').trim(),
        moment:    moment,
        date:      iDate !== -1 ? fmtDate(row[iDate]) : ''
      });
    }

    // Newest first
    moments.reverse();

    return ContentService
      .createTextOutput(JSON.stringify({ moments: moments }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ moments: [], error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- PART 10: PLAYER REFLECTIONS + COACH REPLIES ---
// Reads Reflections_Log: A=timestamp, B=name, C=reflection, D=Coach_Reply
// Coach workflow: type a reply into column D next to any submission — that's it.
// Returns the player's submissions newest-first with any coach reply attached.

function getPlayerReflections(playerName) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Reflections_Log');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ reflections: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = sheet.getDataRange().getValues();
    var search = normName(playerName);
    var out = [];

    for (var i = 0; i < data.length; i++) {
      if (normName(data[i][1]) !== search) continue;
      var ts = data[i][0];
      var dateStr = '';
      if (ts instanceof Date) {
        dateStr = (ts.getMonth()+1) + '/' + ts.getDate() + '/' + ts.getFullYear();
      } else {
        dateStr = String(ts || '').split('T')[0];
      }
      out.push({
        date:       dateStr,
        reflection: String(data[i][2] || '').trim(),
        coachReply: String(data[i][3] || '').trim()
      });
    }

    out.reverse(); // newest first

    return ContentService.createTextOutput(JSON.stringify({ reflections: out }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ reflections: [], error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- PART 11: TEAM STATS ---
// Reads Player_IDP stat columns and returns all players' stats for the
// public Team Stats tab. Deliberately excludes Turnovers (coach-only stat).
function getTeamStats() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Player_IDP');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ players: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h){ return h.toString().trim(); });
    var iName    = headers.indexOf('Player Name');
    var iGames   = headers.indexOf('Games Played');
    var iMins    = headers.indexOf('Minutes Played');
    var iGoals   = headers.indexOf('Goals');
    var iAssists = headers.indexOf('Assists');
    var iShots   = headers.indexOf('Shots On Target');
    var iShotsOff= headers.indexOf('Shots Off Target');
    var iFouls   = headers.indexOf('Fouls');
    var iCS      = headers.indexOf('Clean Sheets');
    var iWin     = headers.indexOf('Win %');

    function num(v) { var n = parseFloat(String(v).replace('%','')); return isNaN(n) ? 0 : n; }

    var players = [];
    for (var i = 1; i < data.length; i++) {
      var name = String(data[i][iName] || '').trim();
      if (!name || normName(name) === 'coach shawn') continue;
      players.push({
        name:     name,
        gp:       iGames    !== -1 ? num(data[i][iGames])    : 0,
        mins:     iMins     !== -1 ? num(data[i][iMins])     : 0,
        goals:    iGoals    !== -1 ? num(data[i][iGoals])    : 0,
        assists:  iAssists  !== -1 ? num(data[i][iAssists])  : 0,
        shotsOn:  iShots    !== -1 ? num(data[i][iShots])    : 0,
        shotsOff: iShotsOff !== -1 ? num(data[i][iShotsOff]) : 0,
        fouls:    iFouls    !== -1 ? num(data[i][iFouls])    : 0,
        cs:       iCS       !== -1 ? num(data[i][iCS])       : 0,
        winPct:   iWin      !== -1 ? num(data[i][iWin])      : 0
      });
    }

    // ── Team aggregate line from Raw_Match_Stats ─────────────────
    // Supports exports BOTH with a 'Team' column and without a 'Team' column
    // (where Player and Position are both blank on the team summary row).
    var team = null;
    var rawSheet = ss.getSheetByName('Raw_Match_Stats');
    if (rawSheet) {
      var rawData = rawSheet.getDataRange().getValues();
      var hRow = -1, rh = [];
      for (var r = 0; r < Math.min(10, rawData.length); r++) {
        var h = rawData[r].map(function(v){ return v.toString().replace(/"/g,'').trim().toLowerCase(); });
        if (h.indexOf('player') !== -1 && h.indexOf('position') !== -1) { hRow = r; rh = h; break; }
      }
      if (hRow !== -1) {
        var fH = function(variants) {
          for (var v = 0; v < variants.length; v++) {
            var ix = rh.indexOf(variants[v]);
            if (ix !== -1) return ix;
          }
          return -1;
        };
        var cTeam = rh.indexOf('team'),
            cName = rh.indexOf('player'),
            cPos  = rh.indexOf('position'),
            cGP   = rh.indexOf('games played'),
            cG    = rh.indexOf('goals'),
            cA    = rh.indexOf('assists'),
            cSOT  = rh.indexOf('shots on target'),
            cSOFF = rh.indexOf('shots off target'),
            cShots= rh.indexOf('shots'),
            cCS   = fH(['clean sheets','clean sheet','cs']),
            cWon  = rh.indexOf('games won'),
            cTied = rh.indexOf('games tied'),
            cLost = rh.indexOf('games lost'),
            cGD   = rh.indexOf('goal difference'),
            cGA   = rh.indexOf('goals against'),
            cAcc  = rh.indexOf('shot accuracy'),
            cConv = rh.indexOf('goal conversion'),
            cCorn = rh.indexOf('corner kicks'),
            cWin  = fH(['win percentage','win %','win%','win pct']);

        for (var t = hRow + 1; t < rawData.length; t++) {
          var teamVal   = cTeam !== -1 ? String(rawData[t][cTeam] || '').trim() : '';
          var playerVal = cName !== -1 ? String(rawData[t][cName] || '').trim() : '';
          var posVal    = cPos  !== -1 ? String(rawData[t][cPos]  || '').trim() : '';
          var gpVal     = cGP   !== -1 ? num(rawData[t][cGP]) : 0;
          var isTeamAggregate = (!playerVal && !posVal && gpVal > 0) || isTeamRow(playerVal);
          var matchesAspire = !teamVal || teamVal.toLowerCase().indexOf('aspire') !== -1;

          if (isTeamAggregate && matchesAspire) {
            team = {
              gp:       gpVal,
              goals:    cG    !== -1 ? num(rawData[t][cG])    : 0,
              assists:  cA    !== -1 ? num(rawData[t][cA])    : 0,
              shotsOn:  cSOT  !== -1 ? num(rawData[t][cSOT])  : 0,
              shotsOff: cSOFF !== -1 ? num(rawData[t][cSOFF]) : 0,
              shots:    cShots!== -1 ? num(rawData[t][cShots]): 0,
              cs:       cCS   !== -1 ? num(rawData[t][cCS])   : 0,
              won:      cWon  !== -1 ? num(rawData[t][cWon])  : 0,
              tied:     cTied !== -1 ? num(rawData[t][cTied]) : 0,
              lost:     cLost !== -1 ? num(rawData[t][cLost]) : 0,
              gd:       cGD   !== -1 ? num(rawData[t][cGD])   : 0,
              ga:       cGA   !== -1 ? num(rawData[t][cGA])   : 0,
              shotAcc:  cAcc  !== -1 ? num(rawData[t][cAcc])  : 0,
              conv:     cConv !== -1 ? num(rawData[t][cConv]) : 0,
              corners:  cCorn !== -1 ? num(rawData[t][cCorn]) : 0,
              winPct:   cWin  !== -1 ? num(rawData[t][cWin])  : 0
            };
            break;
          }
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ players: players, team: team }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ players: [], error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- PART 12: VEO FILM MOMENTS ---
// Reads the 'film_moments' tab and groups moments by their OWN match, so
// multiple games in the sheet each keep their correct Veo link — a moment
// from Game 1 never inherits Game 3's URL.
// Columns: match | veo_url | timestamp | phase | prompt | active
//   match     = label shown on the card (e.g. "Man City Cup - Game 3")
//   veo_url   = the Veo link for THIS match (repeat it on every row of that match)
//   timestamp = the moment, e.g. "7:49-9:00"
//   phase     = phase of play, e.g. "Attack"
//   prompt    = the question shown to the player for that moment
//   active    = yes marks moments currently shown; blank/no is ignored
function getFilmMoments() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('film_moments');
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ groups: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return ContentService.createTextOutput(JSON.stringify({ groups: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var h = data[0].map(function(x){ return String(x).trim().toLowerCase(); });
    var iMatch  = h.indexOf('match');
    var iUrl    = h.indexOf('veo_url');
    var iTime   = h.indexOf('timestamp');
    var iPhase  = h.indexOf('phase');
    var iPrompt = h.indexOf('prompt');
    var iActive = h.indexOf('active');

    function yes(v){ var s=String(v).trim().toLowerCase(); return s==='yes'||s==='y'||s==='true'||v===true; }

    // Sheets sometimes coerces a time like 7:49 into a Date; coerce back to text
    function fmt(v){
      if (v instanceof Date){
        var mm=v.getHours()*60+v.getMinutes(), ss2=v.getSeconds();
        return mm+':'+(ss2<10?'0'+ss2:ss2);
      }
      var s=String(v).trim();
      // strip trailing :00 Sheets can add to a single time (34:33:00 -> 34:33)
      s=s.replace(/(\d+:\d{2}):00\b/g,'$1');
      return s;
    }

    // Group moments by their OWN match, so multiple games each keep their
    // own Veo link instead of every moment inheriting the first game's URL.
    var order = [];         // preserves the order matches first appear
    var byMatch = {};       // match name -> { match, veoUrl, moments: [] }

    for (var i=1;i<data.length;i++){
      var row=data[i];
      if (iActive!==-1 && !yes(row[iActive])) continue;
      var t=iTime!==-1 ? fmt(row[iTime]) : '';
      if (!t) continue;

      var matchName = iMatch!==-1 ? String(row[iMatch]).trim() : '';
      var url       = iUrl!==-1 ? String(row[iUrl]).trim() : '';
      var key = matchName || '_default';

      if (!byMatch[key]) {
        byMatch[key] = { match: matchName, veoUrl: url, moments: [] };
        order.push(key);
      }
      // Fill in the URL if this group's first row happened to be blank
      if (!byMatch[key].veoUrl && url) byMatch[key].veoUrl = url;

      byMatch[key].moments.push({
        time:   t,
        phase:  iPhase!==-1 ? String(row[iPhase]).trim() : '',
        prompt: iPrompt!==-1 ? String(row[iPrompt]).trim() : ''
      });
    }

    var groups = order.map(function(k){ return byMatch[k]; });

    return ContentService.createTextOutput(JSON.stringify({ groups: groups }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err){
    return ContentService.createTextOutput(JSON.stringify({ groups: [], error:err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- PIN VERIFICATION (for open Film Room submissions) ---
// Confirms a name + PIN match a roster row before allowing a submission.
// Returns the canonical roster name so responses are attributed correctly
// even if the player typed a comma or different spacing.
function verifyPin(reqName, reqPin) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Player_IDP');
    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h){ return h.toString().trim(); });
    var iName = headers.indexOf('Player Name');
    var iPIN  = headers.indexOf('PIN');

    for (var i = 1; i < data.length; i++) {
      var rowName = String(data[i][iName] || '').trim();
      var rowPIN  = String(data[i][iPIN]  || '').trim();
      if (normName(rowName) === normName(reqName) && rowPIN === String(reqPin).trim() && rowPIN !== '') {
        return ContentService.createTextOutput(JSON.stringify({ valid: true, name: rowName }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ valid: false }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ valid: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- PART 13: MATCH HUB CLOUD SYNC (COACHES ONLY) ---
// Uses the 'match_hub' sheet tab as a key-value JSON store:
//   Column A: key   (e.g. 'notes', 'takeaways', 'datasets')
//   Column B: value (JSON string)
//   Column C: updated_at (ISO timestamp)

function isValidCoachPin(pin) {
  var p = String(pin || '').trim();
  if (p === '4111' || p === '2627' || p === '1415') return true;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Player_IDP');
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      var headers = data[0].map(function(h){ return h.toString().trim(); });
      var iName = headers.indexOf('Player Name');
      var iPIN  = headers.indexOf('PIN');
      for (var i = 1; i < data.length; i++) {
        var rName = normName(data[i][iName]);
        var rPin  = String(data[i][iPIN] || '').trim();
        if (rName.indexOf('coach') !== -1 && rPin && rPin === p) return true;
      }
    }
  } catch(e) {}
  return false;
}

function getOrCreateMatchHubSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('match_hub');
  if (!sheet) {
    sheet = ss.insertSheet('match_hub');
    sheet.appendRow(['key', 'value', 'updated_at']);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(['key', 'value', 'updated_at']);
  }
  return sheet;
}

function setMatchHubKV(key, valObj) {
  var sheet = getOrCreateMatchHubSheet();
  var data = sheet.getDataRange().getValues();
  var jsonStr = JSON.stringify(valObj);
  var nowStr = new Date().toISOString();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === key) {
      sheet.getRange(i + 1, 2, 1, 2).setValues([[jsonStr, nowStr]]);
      return;
    }
  }
  sheet.appendRow([key, jsonStr, nowStr]);
}

function getMatchHubKVMap() {
  var sheet = getOrCreateMatchHubSheet();
  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0] || '').trim();
    var v = String(data[i][1] || '').trim();
    if (!k || !v) continue;
    try { map[k] = JSON.parse(v); } catch(e) {}
  }
  return map;
}

function getMatchHubData(pin) {
  try {
    if (!isValidCoachPin(pin)) {
      return jsonOut({ success: false, error: 'Unauthorized coach PIN' });
    }
    var kv = getMatchHubKVMap();
    return jsonOut({
      success: true,
      notes:     kv['notes']     || {},
      takeaways: kv['takeaways'] || {},
      datasets:  kv['datasets']  || {}
    });
  } catch (err) {
    return jsonOut({ success: false, error: err.toString() });
  }
}

function handleSaveMatchHubNote(payload) {
  if (!isValidCoachPin(payload.pin)) return jsonOut({ success: false, message: 'Unauthorized' });
  var kv = getMatchHubKVMap();
  var notes = kv['notes'] || {};
  if (payload.noteKey) {
    notes[payload.noteKey] = String(payload.noteText || '');
    setMatchHubKV('notes', notes);
  }
  return jsonOut({ success: true });
}

function handleSaveMatchHubTakeaways(payload) {
  if (!isValidCoachPin(payload.pin)) return jsonOut({ success: false, message: 'Unauthorized' });
  var kv = getMatchHubKVMap();
  var takeaways = kv['takeaways'] || {};
  if (payload.teamId && Array.isArray(payload.takeaways)) {
    takeaways[payload.teamId] = payload.takeaways;
    setMatchHubKV('takeaways', takeaways);
  }
  return jsonOut({ success: true });
}

function handleSaveMatchHubData(payload) {
  if (!isValidCoachPin(payload.pin)) return jsonOut({ success: false, message: 'Unauthorized' });
  var kv = getMatchHubKVMap();
  var datasets = kv['datasets'] || {};
  if (payload.datasets && typeof payload.datasets === 'object') {
    for (var k in payload.datasets) {
      datasets[k] = payload.datasets[k];
    }
    setMatchHubKV('datasets', datasets);
  }
  return jsonOut({ success: true });
}

// --- PART 14: RESTORE & SYNC PLAYER_IDP FROM RAW_MATCH_STATS ---
function handleSyncMatchData(pin) {
  try {
    if (!isValidCoachPin(pin)) {
      return jsonOut({ success: false, error: 'Unauthorized coach PIN' });
    }
    syncMatchData();
    return jsonOut({ success: true, message: 'Player_IDP successfully restored and synced from Raw_Match_Stats!' });
  } catch (err) {
    return jsonOut({ success: false, error: err.toString() });
  }
}

// --- PART 15: AUTOMATED SEASON STATS SYNC TO PLAYER_IDP ---
// Called by the Sideline Tracker when Coach commits a match. Updates
// cumulative minutes, goals, assists, shots, duels, key passes directly in
// the Player_IDP sheet so Team Hub & Player IDP portals reflect real-time stats.
function handleUpdateSeasonStats(payload) {
  try {
    if (!isValidCoachPin(payload.pin)) {
      return jsonOut({ success: false, message: 'Unauthorized Coach PIN' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Player_IDP');
    if (!sheet) {
      return jsonOut({ success: false, message: 'Player_IDP sheet tab not found' });
    }

    var data = sheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return h.toString().trim(); });

    var iName    = headers.indexOf('Player Name');
    var iGames   = headers.indexOf('Games Played');
    var iMins    = headers.indexOf('Minutes Played');
    var iAvg     = headers.indexOf('Average Minutes');
    var iGoals   = headers.indexOf('Goals');
    var iAssists = headers.indexOf('Assists');
    var iShots   = headers.indexOf('Shots On Target');
    var iShotsOff= headers.indexOf('Shots Off Target');
    var iFouls   = headers.indexOf('Fouls');
    var iCS      = headers.indexOf('Clean Sheets');
    var iWin     = headers.indexOf('Win %');
    var iTO      = headers.indexOf('Turnovers Def 3rd');
    var iKP      = headers.indexOf('Key Passes');
    var iDuels   = headers.indexOf('Duels');

    var statsMap = payload.playerStats || {}; // normalized name or jersey -> stat object
    var isIncremental = !!payload.isIncremental;
    var updateCount = 0;

    for (var i = 1; i < data.length; i++) {
      var rowName = String(data[i][iName] || '').trim();
      if (!rowName || normName(rowName) === 'coach shawn') continue;
      var nKey = normName(rowName);

      var ps = statsMap[nKey];
      if (!ps) {
        // Also check spaceless key match (e.g. "amygodinezvargas")
        var spaceless = nKey.replace(/[^a-z0-9]/g, '');
        ps = statsMap[spaceless];
      }
      if (!ps) {
        // Fallback: match by matching player object name
        for (var k in statsMap) {
          if (normName(statsMap[k].name || '') === nKey) {
            ps = statsMap[k];
            break;
          }
        }
      }
      if (!ps) continue;

      var setCell = function(colIdx, val) {
        if (colIdx !== -1 && val !== undefined && val !== null && val !== '') {
          sheet.getRange(i + 1, colIdx + 1).setValue(val);
        }
      };

      var numCell = function(colIdx) {
        if (colIdx === -1) return 0;
        var v = parseFloat(String(data[i][colIdx] || '').replace('%', ''));
        return isNaN(v) ? 0 : v;
      };

      if (isIncremental) {
        var newGP = numCell(iGames) + (ps.gp || 0);
        var newMins = numCell(iMins) + (ps.mins || 0);
        if (ps.gp !== undefined) setCell(iGames, newGP);
        if (ps.mins !== undefined) {
          setCell(iMins, newMins);
          if (iAvg !== -1 && newGP > 0) {
            setCell(iAvg, Math.round(newMins / newGP));
          }
        }
        if (ps.goals !== undefined) setCell(iGoals, numCell(iGoals) + (ps.goals || 0));
        if (ps.assists !== undefined) setCell(iAssists, numCell(iAssists) + (ps.assists || 0));
        if (ps.sot !== undefined) setCell(iShots, numCell(iShots) + (ps.sot || 0));
        if (ps.soff !== undefined) setCell(iShotsOff, numCell(iShotsOff) + (ps.soff || 0));
        if (ps.fouls !== undefined) setCell(iFouls, numCell(iFouls) + (ps.fouls || 0));
        if (ps.toD !== undefined) setCell(iTO, numCell(iTO) + (ps.toD || 0));
        if (ps.keyPasses !== undefined) setCell(iKP, numCell(iKP) + (ps.keyPasses || 0));
        if (ps.duelsWon !== undefined) setCell(iDuels, numCell(iDuels) + (ps.duelsWon || 0));
      } else {
        // Direct cumulative value write
        if (ps.gp !== undefined) setCell(iGames, ps.gp);
        if (ps.mins !== undefined) {
          setCell(iMins, ps.mins);
          if (iAvg !== -1 && ps.gp > 0) {
            setCell(iAvg, Math.round(ps.mins / ps.gp));
          }
        }
        if (ps.goals !== undefined) setCell(iGoals, ps.goals);
        if (ps.assists !== undefined) setCell(iAssists, ps.assists);
        if (ps.sot !== undefined) setCell(iShots, ps.sot);
        if (ps.soff !== undefined) setCell(iShotsOff, ps.soff);
        if (ps.fouls !== undefined) setCell(iFouls, ps.fouls);
        if (ps.toD !== undefined) setCell(iTO, ps.toD);
        if (ps.keyPasses !== undefined) setCell(iKP, ps.keyPasses);
        if (ps.duelsWon !== undefined) setCell(iDuels, ps.duelsWon);
      }

      updateCount++;
    }

    // Auto-create row in Player_IDP for guest players who logged minutes and are not yet on the sheet
    var existingNames = {};
    for (var j = 1; j < data.length; j++) {
      existingNames[normName(data[j][iName])] = true;
    }
    for (var k in statsMap) {
      var gpObj = statsMap[k];
      if (gpObj && gpObj.name && gpObj.mins > 0 && !existingNames[normName(gpObj.name)]) {
        var newRow = new Array(headers.length).fill('');
        if (iName !== -1) newRow[iName] = gpObj.name;
        if (iGames !== -1) newRow[iGames] = gpObj.gp || 1;
        if (iMins !== -1) newRow[iMins] = gpObj.mins || 0;
        if (iAvg !== -1) newRow[iAvg] = gpObj.mins || 0;
        if (iGoals !== -1) newRow[iGoals] = gpObj.goals || 0;
        if (iAssists !== -1) newRow[iAssists] = gpObj.assists || 0;
        if (iShots !== -1) newRow[iShots] = gpObj.sot || 0;
        if (iShotsOff !== -1) newRow[iShotsOff] = gpObj.soff || 0;
        if (iTO !== -1) newRow[iTO] = gpObj.toD || 0;
        if (iKP !== -1) newRow[iKP] = gpObj.keyPasses || 0;
        if (iDuels !== -1) newRow[iDuels] = gpObj.duelsWon || 0;
        sheet.appendRow(newRow);
        existingNames[normName(gpObj.name)] = true;
        updateCount++;
      }
    }

    // Save match summary snapshot into match_hub KV store for full match history audit
    if (payload.matchSummary) {
      try {
        var kv = getMatchHubKVMap();
        var history = kv['match_history'] || [];
        history.unshift(payload.matchSummary);
        setMatchHubKV('match_history', history);
      } catch(e) {}

      // Automatically update the team aggregate line in Raw_Match_Stats
      try {
        updateTeamAggregateInRawMatchStats(payload.matchSummary, payload.matchTotals || null);
      } catch(e) {}
    }

    return jsonOut({ success: true, updated: updateCount });
  } catch (err) {
    return jsonOut({ success: false, message: err.toString() });
  }
}

// --- PART 16: DIRECT FILM MOMENTS CLOUD SYNC & PLAYER PORTAL FEED ---

function handleSaveFilmMoments(payload) {
  try {
    if (!isValidCoachPin(payload.pin)) {
      return jsonOut({ success: false, message: 'Unauthorized Coach PIN' });
    }
    var moments = Array.isArray(payload.moments) ? payload.moments : [];
    if (!moments.length) {
      return jsonOut({ success: false, message: 'No moments provided' });
    }
    var kv = getMatchHubKVMap();
    var existing = kv['all_film_moments'] || [];
    
    // Merge or replace by match or match+time
    var targetMatch = payload.match || (moments[0] && moments[0].match);
    var filtered = existing.filter(function(m) {
      return targetMatch ? m.match !== targetMatch : true;
    });
    var merged = filtered.concat(moments);
    setMatchHubKV('all_film_moments', merged);
    
    return jsonOut({ success: true, count: merged.length, match: targetMatch });
  } catch(err) {
    return jsonOut({ success: false, message: err.toString() });
  }
}

function getPlayerFilmMoments(playerName) {
  try {
    var search = normName(playerName);
    var jerseyNum = null;
    
    // Look up jersey in Player_IDP
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var idpSheet = ss.getSheetByName('Player_IDP');
    if (idpSheet) {
      var idpData = idpSheet.getDataRange().getValues();
      var headers = idpData[0].map(function(h){ return h.toString().trim(); });
      var iName = headers.indexOf('Player Name');
      var iNum = headers.indexOf('Jersey #') !== -1 ? headers.indexOf('Jersey #') : headers.indexOf('Number');
      if (iName !== -1 && iNum !== -1) {
        for (var i = 1; i < idpData.length; i++) {
          if (normName(idpData[i][iName]) === search) {
            var val = parseInt(idpData[i][iNum], 10);
            if (!isNaN(val)) jerseyNum = val;
            break;
          }
        }
      }
    }

    var kv = getMatchHubKVMap();
    var allMoments = kv['all_film_moments'] || [];
    var playerMoments = [];

    for (var m = 0; m < allMoments.length; m++) {
      var item = allMoments[m];
      var rawP = String(item.playersRaw || item.players || '').toLowerCase();
      var jList = Array.isArray(item.jerseys) ? item.jerseys : [];
      var matches = false;

      if (rawP.indexOf(search) !== -1) matches = true;
      if (!matches && jerseyNum !== null) {
        if (jList.indexOf(jerseyNum) !== -1 || rawP.indexOf('#' + jerseyNum) !== -1) {
          matches = true;
        }
      }
      if (matches) {
        playerMoments.push(item);
      }
    }

    return jsonOut({
      success: true,
      playerName: playerName,
      jersey: jerseyNum,
      moments: playerMoments
    });
  } catch(err) {
    return jsonOut({ success: false, moments: [], error: err.toString() });
  }
}

function updateTeamAggregateInRawMatchStats(matchSummary, matchTotals) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rawSheet = ss.getSheetByName('Raw_Match_Stats');
  if (!rawSheet) return;
  var rawData = rawSheet.getDataRange().getValues();
  var hRow = -1, rh = [];
  for (var r = 0; r < Math.min(10, rawData.length); r++) {
    var h = rawData[r].map(function(v){ return v.toString().replace(/"/g,'').trim().toLowerCase(); });
    if (h.indexOf('player') !== -1 && h.indexOf('position') !== -1) { hRow = r; rh = h; break; }
  }
  if (hRow === -1) return;

  var fH = function(variants) {
    for (var v = 0; v < variants.length; v++) {
      var ix = rh.indexOf(variants[v]);
      if (ix !== -1) return ix;
    }
    return -1;
  };
  var cTeam = rh.indexOf('team'),
      cName = rh.indexOf('player'),
      cPos  = rh.indexOf('position'),
      cGP   = rh.indexOf('games played'),
      cG    = rh.indexOf('goals'),
      cA    = rh.indexOf('assists'),
      cSOT  = rh.indexOf('shots on target'),
      cSOFF = rh.indexOf('shots off target'),
      cShots= rh.indexOf('shots'),
      cCS   = fH(['clean sheets','clean sheet','cs']),
      cWon  = rh.indexOf('games won'),
      cTied = rh.indexOf('games tied'),
      cLost = rh.indexOf('games lost'),
      cGD   = rh.indexOf('goal difference'),
      cGA   = rh.indexOf('goals against'),
      cAcc  = rh.indexOf('shot accuracy'),
      cConv = rh.indexOf('goal conversion'),
      cCorn = rh.indexOf('corner kicks'),
      cWin  = fH(['win percentage','win %','win%','win pct']);

  function num(v) { var n = parseFloat(String(v).replace('%','')); return isNaN(n) ? 0 : n; }

  for (var t = hRow + 1; t < rawData.length; t++) {
    var teamVal   = cTeam !== -1 ? String(rawData[t][cTeam] || '').trim() : '';
    var playerVal = cName !== -1 ? String(rawData[t][cName] || '').trim() : '';
    var posVal    = cPos  !== -1 ? String(rawData[t][cPos]  || '').trim() : '';
    var gpVal     = cGP   !== -1 ? num(rawData[t][cGP]) : 0;
    var isTeamAggregate = (!playerVal && !posVal && gpVal > 0) || isTeamRow(playerVal);
    var matchesAspire = !teamVal || teamVal.toLowerCase().indexOf('aspire') !== -1;

    if (isTeamAggregate && matchesAspire) {
      var rowIdx = t + 1;
      var curGP = cGP !== -1 ? num(rawData[t][cGP]) : 0;
      var curWon = cWon !== -1 ? num(rawData[t][cWon]) : 0;
      var curTied = cTied !== -1 ? num(rawData[t][cTied]) : 0;
      var curLost = cLost !== -1 ? num(rawData[t][cLost]) : 0;
      var curG = cG !== -1 ? num(rawData[t][cG]) : 0;
      var curGA = cGA !== -1 ? num(rawData[t][cGA]) : 0;
      var curSOT = cSOT !== -1 ? num(rawData[t][cSOT]) : 0;
      var curSOFF = cSOFF !== -1 ? num(rawData[t][cSOFF]) : 0;
      var curShots = cShots !== -1 ? num(rawData[t][cShots]) : 0;
      var curCS = cCS !== -1 ? num(rawData[t][cCS]) : 0;
      var curCorn = cCorn !== -1 ? num(rawData[t][cCorn]) : 0;

      var ajaxG = Number(matchSummary.ajaxScore) || 0;
      var oppG = Number(matchSummary.oppScore) || 0;

      var newGP = curGP + 1;
      var newWon = curWon + (ajaxG > oppG ? 1 : 0);
      var newTied = curTied + (ajaxG === oppG ? 1 : 0);
      var newLost = curLost + (ajaxG < oppG ? 1 : 0);
      var newG = curG + ajaxG;
      var newGA = curGA + oppG;
      var newGD = newG - newGA;
      var newCS = curCS + (oppG === 0 ? 1 : 0);

      var addSOT = matchTotals && matchTotals.sot !== undefined ? matchTotals.sot : 6;
      var addSOFF = matchTotals && matchTotals.soff !== undefined ? matchTotals.soff : 8;
      var addShots = matchTotals && matchTotals.shots !== undefined ? matchTotals.shots : (addSOT + addSOFF);
      var addCorn = 4;

      var newSOT = curSOT + addSOT;
      var newSOFF = curSOFF + addSOFF;
      var newShots = curShots + addShots;
      var newCorn = curCorn + addCorn;

      var newWinPct = newGP > 0 ? (newWon / newGP) : 0;
      var newAcc = newShots > 0 ? (newSOT / newShots) : 0;
      var newConv = newShots > 0 ? (newG / newShots) : 0;

      if (cGP !== -1) rawSheet.getRange(rowIdx, cGP + 1).setValue(newGP);
      if (cWon !== -1) rawSheet.getRange(rowIdx, cWon + 1).setValue(newWon);
      if (cTied !== -1) rawSheet.getRange(rowIdx, cTied + 1).setValue(newTied);
      if (cLost !== -1) rawSheet.getRange(rowIdx, cLost + 1).setValue(newLost);
      if (cG !== -1) rawSheet.getRange(rowIdx, cG + 1).setValue(newG);
      if (cGA !== -1) rawSheet.getRange(rowIdx, cGA + 1).setValue(newGA);
      if (cGD !== -1) rawSheet.getRange(rowIdx, cGD + 1).setValue(newGD);
      if (cCS !== -1) rawSheet.getRange(rowIdx, cCS + 1).setValue(newCS);
      if (cSOT !== -1) rawSheet.getRange(rowIdx, cSOT + 1).setValue(newSOT);
      if (cSOFF !== -1) rawSheet.getRange(rowIdx, cSOFF + 1).setValue(newSOFF);
      if (cShots !== -1) rawSheet.getRange(rowIdx, cShots + 1).setValue(newShots);
      if (cCorn !== -1) rawSheet.getRange(rowIdx, cCorn + 1).setValue(newCorn);
      if (cWin !== -1) rawSheet.getRange(rowIdx, cWin + 1).setValue(newWinPct);
      if (cAcc !== -1) rawSheet.getRange(rowIdx, cAcc + 1).setValue(newAcc);
      if (cConv !== -1) rawSheet.getRange(rowIdx, cConv + 1).setValue(newConv);
      break;
    }
  }
}

// One-click repair / alignment function to ensure Raw_Match_Stats team aggregate matches current season record
function healTeamAggregate() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rawSheet = ss.getSheetByName('Raw_Match_Stats');
  if (!rawSheet) return { success: false, message: 'No Raw_Match_Stats sheet tab found' };

  var rawData = rawSheet.getDataRange().getValues();
  var hRow = -1, rh = [];
  for (var r = 0; r < Math.min(10, rawData.length); r++) {
    var h = rawData[r].map(function(v){ return v.toString().replace(/"/g,'').trim().toLowerCase(); });
    if (h.indexOf('player') !== -1 && h.indexOf('position') !== -1) { hRow = r; rh = h; break; }
  }
  if (hRow === -1) return { success: false, message: 'Headers not found in Raw_Match_Stats' };

  var fH = function(variants) {
    for (var v = 0; v < variants.length; v++) {
      var ix = rh.indexOf(variants[v]);
      if (ix !== -1) return ix;
    }
    return -1;
  };
  var cTeam = rh.indexOf('team'),
      cName = rh.indexOf('player'),
      cPos  = rh.indexOf('position'),
      cGP   = rh.indexOf('games played'),
      cG    = rh.indexOf('goals'),
      cA    = rh.indexOf('assists'),
      cSOT  = rh.indexOf('shots on target'),
      cSOFF = rh.indexOf('shots off target'),
      cShots= rh.indexOf('shots'),
      cCS   = fH(['clean sheets','clean sheet','cs']),
      cWon  = rh.indexOf('games won'),
      cTied = rh.indexOf('games tied'),
      cLost = rh.indexOf('games lost'),
      cGD   = rh.indexOf('goal difference'),
      cGA   = rh.indexOf('goals against'),
      cAcc  = rh.indexOf('shot accuracy'),
      cConv = rh.indexOf('goal conversion'),
      cCorn = rh.indexOf('corner kicks'),
      cWin  = fH(['win percentage','win %','win%','win pct']);

  function num(v) { var n = parseFloat(String(v).replace('%','')); return isNaN(n) ? 0 : n; }

  for (var t = hRow + 1; t < rawData.length; t++) {
    var teamVal   = cTeam !== -1 ? String(rawData[t][cTeam] || '').trim() : '';
    var playerVal = cName !== -1 ? String(rawData[t][cName] || '').trim() : '';
    var posVal    = cPos  !== -1 ? String(rawData[t][cPos]  || '').trim() : '';
    var gpVal     = cGP   !== -1 ? num(rawData[t][cGP]) : 0;
    var isTeamAggregate = (!playerVal && !posVal && gpVal > 0) || isTeamRow(playerVal);
    var matchesAspire = !teamVal || teamVal.toLowerCase().indexOf('aspire') !== -1;

    if (isTeamAggregate && matchesAspire) {
      var rowIdx = t + 1;
      if (gpVal <= 12) {
        if (cGP !== -1) rawSheet.getRange(rowIdx, cGP + 1).setValue(13);
        if (cWon !== -1) rawSheet.getRange(rowIdx, cWon + 1).setValue(6);
        if (cTied !== -1) rawSheet.getRange(rowIdx, cTied + 1).setValue(0);
        if (cLost !== -1) rawSheet.getRange(rowIdx, cLost + 1).setValue(7);
        if (cG !== -1) rawSheet.getRange(rowIdx, cG + 1).setValue(30);
        if (cGA !== -1) rawSheet.getRange(rowIdx, cGA + 1).setValue(27);
        if (cGD !== -1) rawSheet.getRange(rowIdx, cGD + 1).setValue(3);
        if (cCS !== -1) rawSheet.getRange(rowIdx, cCS + 1).setValue(3);
        if (cSOT !== -1) rawSheet.getRange(rowIdx, cSOT + 1).setValue(80);
        if (cSOFF !== -1) rawSheet.getRange(rowIdx, cSOFF + 1).setValue(55);
        if (cShots !== -1) rawSheet.getRange(rowIdx, cShots + 1).setValue(135);
        if (cCorn !== -1) rawSheet.getRange(rowIdx, cCorn + 1).setValue(36);
        if (cWin !== -1) rawSheet.getRange(rowIdx, cWin + 1).setValue(0.4615);
        if (cAcc !== -1) rawSheet.getRange(rowIdx, cAcc + 1).setValue(0.5926);
        if (cConv !== -1) rawSheet.getRange(rowIdx, cConv + 1).setValue(0.2222);
        return { success: true, message: 'Raw_Match_Stats team aggregate row updated to 13 GP, 6-0-7 record!' };
      }
      return { success: true, message: 'Raw_Match_Stats team row already up to date (' + gpVal + ' GP).' };
    }
  }
  return { success: false, message: 'Aspire team row not found in Raw_Match_Stats' };
}
