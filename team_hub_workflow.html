<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AJAX Aspire U15 · How the Team Hub Works</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap" rel="stylesheet">
<style>
  :root{
    --navy:#0D1B2A; --card:#14273D; --card2:#1A3049;
    --teal:#3ABFB8; --gold:#C8A951; --green:#2A7A4B; --greenLt:#3E9E63;
    --white:#F2F6F9; --text:#C9D8E4; --muted:#7B98AD;
    --border:rgba(255,255,255,.10);
  }
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    background:var(--navy); color:var(--text);
    font-family:'DM Sans',sans-serif; font-size:15px; line-height:1.65;
    -webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:1080px;margin:0 auto;padding:56px 24px 90px}

  /* ---------- header ---------- */
  .eyebrow{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:3px;
    text-transform:uppercase;color:var(--teal)}
  h1{font-family:'Bebas Neue',cursive;font-size:clamp(42px,7vw,72px);
    color:var(--white);line-height:.95;letter-spacing:1px;margin:10px 0 14px}
  h1 span{color:var(--teal)}
  .sub{max-width:660px;color:var(--muted);font-size:16px}
  .rule{height:1px;background:var(--border);margin:44px 0}

  h2{font-family:'Bebas Neue',cursive;font-size:34px;color:var(--white);
    letter-spacing:1px;line-height:1.1;margin-bottom:6px}
  .h2note{color:var(--muted);font-size:14px;margin-bottom:26px;max-width:640px}

  /* ---------- three layer stack ---------- */
  .stack{display:flex;flex-direction:column;gap:10px}
  .layer{display:flex;align-items:center;gap:20px;background:var(--card);
    border:1px solid var(--border);border-radius:10px;padding:20px 24px}
  .layer-tag{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;
    text-transform:uppercase;padding:5px 11px;border-radius:3px;white-space:nowrap;flex-shrink:0}
  .t-site{background:rgba(58,191,184,.12);color:var(--teal);border:1px solid rgba(58,191,184,.3)}
  .t-api{background:rgba(200,169,81,.12);color:var(--gold);border:1px solid rgba(200,169,81,.3)}
  .t-data{background:rgba(62,158,99,.14);color:var(--greenLt);border:1px solid rgba(62,158,99,.32)}
  .layer-name{font-family:'Bebas Neue',cursive;font-size:22px;color:var(--white);
    letter-spacing:.5px;min-width:150px}
  .layer-desc{font-size:14px;color:var(--muted)}
  .arrows{text-align:center;color:var(--muted);font-size:18px;line-height:1;margin:-4px 0}

  /* ---------- who sees what ---------- */
  .access{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .acc{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:22px 24px}
  .acc.locked{border-color:rgba(200,169,81,.35)}
  .acc-h{font-family:'Bebas Neue',cursive;font-size:21px;color:var(--white);
    letter-spacing:.5px;margin-bottom:4px}
  .acc-sub{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;
    text-transform:uppercase;color:var(--muted);margin-bottom:14px}
  .acc.locked .acc-sub{color:var(--gold)}
  .chips{display:flex;flex-wrap:wrap;gap:7px}
  .chip{font-size:13px;padding:5px 12px;border-radius:20px;
    background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--text)}

  /* ---------- system cards ---------- */
  .sys{background:var(--card);border:1px solid var(--border);border-radius:12px;
    margin-bottom:16px;overflow:hidden}
  .sys-head{padding:18px 24px;border-bottom:1px solid var(--border);
    display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}
  .sys-name{font-family:'Bebas Neue',cursive;font-size:25px;color:var(--white);letter-spacing:.5px}
  .sys-tab{font-family:'DM Mono',monospace;font-size:11px;color:var(--greenLt);
    background:rgba(62,158,99,.12);border:1px solid rgba(62,158,99,.3);
    padding:3px 10px;border-radius:3px}
  .flow{display:grid;grid-template-columns:1fr auto 1fr;align-items:stretch}
  .side{padding:20px 24px}
  .side.coach{background:rgba(200,169,81,.045)}
  .side-label{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;
    text-transform:uppercase;margin-bottom:12px}
  .side.player .side-label{color:var(--greenLt)}
  .side.coach .side-label{color:var(--gold)}
  .steps{list-style:none;display:flex;flex-direction:column;gap:9px}
  .steps li{font-size:14px;padding-left:20px;position:relative;color:var(--text)}
  .steps li::before{content:'';position:absolute;left:0;top:9px;width:7px;height:7px;
    border-radius:50%}
  .side.player .steps li::before{background:var(--greenLt)}
  .side.coach .steps li::before{background:var(--gold)}
  .divider{width:1px;background:var(--border)}

  /* ---------- signature: the loop ---------- */
  .loop{background:linear-gradient(135deg,rgba(58,191,184,.08),rgba(200,169,81,.06));
    border:1px solid rgba(58,191,184,.28);border-radius:12px;padding:34px 30px}
  .loop-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:24px}
  .loop-step{position:relative;padding:0 16px}
  .loop-step:not(:last-child)::after{content:'→';position:absolute;right:-10px;top:16px;
    color:var(--teal);font-size:20px}
  .loop-num{font-family:'Bebas Neue',cursive;font-size:36px;line-height:1;
    color:var(--teal);opacity:.5}
  .loop-t{font-family:'Bebas Neue',cursive;font-size:19px;color:var(--white);
    letter-spacing:.5px;margin:6px 0 5px}
  .loop-d{font-size:13.5px;color:var(--muted)}
  .loop-foot{margin-top:26px;padding-top:20px;border-top:1px dashed rgba(58,191,184,.25);
    font-size:14px;color:var(--text)}
  .loop-foot strong{color:var(--teal);font-weight:500}

  /* ---------- rules ---------- */
  .rules{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .rule-card{background:var(--card);border:1px solid var(--border);
    border-left:3px solid var(--gold);border-radius:8px;padding:18px 20px}
  .rule-t{font-family:'DM Sans',sans-serif;font-weight:700;color:var(--white);
    font-size:15px;margin-bottom:5px}
  .rule-d{font-size:13.5px;color:var(--muted)}

  /* ---------- reference table ---------- */
  table{width:100%;border-collapse:collapse;font-size:14.5px}
  th{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;
    text-transform:uppercase;color:var(--muted);text-align:left;
    padding:10px 14px;border-bottom:1px solid var(--border);font-weight:400}
  td{padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.05)}
  td:first-child{color:var(--white)}
  td:last-child{font-family:'DM Mono',monospace;font-size:13px;color:var(--teal)}
  tbody tr:hover{background:rgba(58,191,184,.04)}

  footer{margin-top:60px;padding-top:24px;border-top:1px solid var(--border);
    font-family:'DM Mono',monospace;font-size:11px;letter-spacing:1.5px;
    text-transform:uppercase;color:var(--muted)}

  @media(max-width:820px){
    .access,.rules{grid-template-columns:1fr}
    .flow{grid-template-columns:1fr}
    .divider{width:auto;height:1px}
    .loop-grid{grid-template-columns:1fr 1fr;gap:22px 0}
    .loop-step:not(:last-child)::after{display:none}
    .layer{flex-wrap:wrap;gap:12px}
    .layer-name{min-width:0}
  }
  @media print{
    body{background:#fff;color:#111}
    .sys,.acc,.layer,.rule-card,.loop{break-inside:avoid}
  }
</style>
</head>
<body>
<div class="wrap">

  <div class="eyebrow">Ajax Aspire U15 · Season 26/27</div>
  <h1>How the <span>Team Hub</span> Works</h1>
  <p class="sub">A player development platform built on three moving parts. Everything a coach touches
  is a row in a spreadsheet. The site handles the rest.</p>

  <div class="rule"></div>

  <!-- ARCHITECTURE -->
  <h2>The Three Pieces</h2>
  <p class="h2note">A player opens a tab, the site asks the API for data, the API reads the right
  spreadsheet tab and sends it back. That round trip is the entire system.</p>

  <div class="stack">
    <div class="layer">
      <span class="layer-tag t-site">Front</span>
      <div class="layer-name">The Site</div>
      <div class="layer-desc">One HTML file hosted on Netlify. Everything players and parents see.</div>
    </div>
    <div class="arrows">↕</div>
    <div class="layer">
      <span class="layer-tag t-api">Bridge</span>
      <div class="layer-name">The API</div>
      <div class="layer-desc">Google Apps Script web app on one permanent URL. Reads and writes the data.</div>
    </div>
    <div class="arrows">↕</div>
    <div class="layer">
      <span class="layer-tag t-data">Data</span>
      <div class="layer-name">The Sheet</div>
      <div class="layer-desc">Master Data Hub. One tab per system. This is where the coach works.</div>
    </div>
  </div>

  <div class="rule"></div>

  <!-- ACCESS -->
  <h2>Who Sees What</h2>
  <p class="h2note">Everything is open except individual development material. A parent can follow the
  team without an account; only personal work sits behind a PIN.</p>

  <div class="access">
    <div class="acc">
      <div class="acc-h">Open to Everyone</div>
      <div class="acc-sub">No login</div>
      <div class="chips">
        <span class="chip">Team Hub</span><span class="chip">Compete</span>
        <span class="chip">Moments</span><span class="chip">Team Stats</span>
        <span class="chip">Positions</span><span class="chip">Tactics Board</span>
        <span class="chip">Film Room</span><span class="chip">Glossary</span>
        <span class="chip">Parent Hub</span>
      </div>
    </div>
    <div class="acc locked">
      <div class="acc-h">Player Portal</div>
      <div class="acc-sub">Name + PIN</div>
      <div class="chips">
        <span class="chip">Development plan</span><span class="chip">Coach ratings</span>
        <span class="chip">Assigned film</span><span class="chip">Reflections</span>
        <span class="chip">Coach replies</span>
      </div>
    </div>
  </div>

  <div class="rule"></div>

  <!-- SYSTEMS -->
  <h2>The Five Systems</h2>
  <p class="h2note">Each one works the same way: the player acts on the site, it lands in a spreadsheet
  tab, the coach responds in that same tab.</p>

  <div class="sys">
    <div class="sys-head">
      <div class="sys-name">Player Portal</div>
      <span class="sys-tab">Player_IDP</span>
    </div>
    <div class="flow">
      <div class="side player">
        <div class="side-label">Player does</div>
        <ul class="steps">
          <li>Logs in with her name and PIN</li>
          <li>Submits her development plan and self-ratings</li>
          <li>Sees her ratings next to the coach's, side by side</li>
          <li>Follows a growth link when a rating flags a weak spot</li>
        </ul>
      </div>
      <div class="divider"></div>
      <div class="side coach">
        <div class="side-label">Coach does</div>
        <ul class="steps">
          <li>Fills in rating columns and written comments</li>
          <li>Nothing to publish. She sees it at next login</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="sys">
    <div class="sys-head">
      <div class="sys-name">Film Room</div>
      <span class="sys-tab">coaching_videos</span>
    </div>
    <div class="flow">
      <div class="side player">
        <div class="side-label">Player does</div>
        <ul class="steps">
          <li>Opens her personal clip playlist in the portal</li>
          <li>Watches inline, or taps through for clips that can't embed</li>
          <li>Answers the coaching question under the clip</li>
        </ul>
      </div>
      <div class="divider"></div>
      <div class="side coach">
        <div class="side-label">Coach does</div>
        <ul class="steps">
          <li>Adds a row: player, clip title, link, question</li>
          <li>Her answer arrives in the reflections log</li>
          <li>Replies there, and it appears under her clip</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="sys">
    <div class="sys-head">
      <div class="sys-name">Moments That Matter</div>
      <span class="sys-tab">moments</span>
    </div>
    <div class="flow">
      <div class="side player">
        <div class="side-label">Player and parent see</div>
        <ul class="steps">
          <li>Player of the Week card at the top</li>
          <li>Recognition wall, newest first, public by name</li>
        </ul>
      </div>
      <div class="divider"></div>
      <div class="side coach">
        <div class="side-label">Coach does</div>
        <ul class="steps">
          <li>Adds a row to recognize a moment</li>
          <li>Edits the top row to name Player of the Week</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="sys">
    <div class="sys-head">
      <div class="sys-name">Team Stats</div>
      <span class="sys-tab">Raw_Match_Stats → Player_IDP</span>
    </div>
    <div class="flow">
      <div class="side player">
        <div class="side-label">Player and parent see</div>
        <ul class="steps">
          <li>Team record, goals, clean sheets, shooting accuracy</li>
          <li>Category leaders for scoring, assists, minutes, clean sheets</li>
          <li>Full squad table</li>
        </ul>
      </div>
      <div class="divider"></div>
      <div class="side coach">
        <div class="side-label">Coach does</div>
        <ul class="steps">
          <li>Exports the match file from the stats app</li>
          <li>Matches player names to the roster, then pastes it in</li>
          <li>Runs the sync, which totals each player automatically</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="sys">
    <div class="sys-head">
      <div class="sys-name">Competition Hub</div>
      <span class="sys-tab">challenges · challenge_log · challenge_badges</span>
    </div>
    <div class="flow">
      <div class="side player">
        <div class="side-label">Player does</div>
        <ul class="steps">
          <li>Watches the challenge video and does the work</li>
          <li>Checks in with her name and PIN, once per day</li>
          <li>Watches her name move on the leaderboard</li>
        </ul>
      </div>
      <div class="divider"></div>
      <div class="side coach">
        <div class="side-label">Coach does</div>
        <ul class="steps">
          <li>Adds one row to launch a challenge</li>
          <li>Lets the end date pass to close it, no action needed</li>
          <li>Awards badges by adding a row per winner</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="rule"></div>

  <!-- SIGNATURE: THE LOOP -->
  <div class="loop">
    <div class="eyebrow">The point of the whole thing</div>
    <h2 style="margin-top:8px">The Feedback Loop</h2>
    <p class="h2note" style="margin-bottom:0">Every system feeds one cycle. A player who writes
    something and hears nothing back stops writing.</p>

    <div class="loop-grid">
      <div class="loop-step">
        <div class="loop-num">01</div>
        <div class="loop-t">She Submits</div>
        <div class="loop-d">A reflection, a film response, a development plan.</div>
      </div>
      <div class="loop-step">
        <div class="loop-num">02</div>
        <div class="loop-t">It Lands</div>
        <div class="loop-d">One row in the log, tagged with what kind of submission it was.</div>
      </div>
      <div class="loop-step">
        <div class="loop-num">03</div>
        <div class="loop-t">Coach Replies</div>
        <div class="loop-d">One validation, one piece of advice, one question. Typed in the next column.</div>
      </div>
      <div class="loop-step">
        <div class="loop-num">04</div>
        <div class="loop-t">She Reads It</div>
        <div class="loop-d">A banner tells her a reply is waiting the next time she logs in.</div>
      </div>
    </div>

    <div class="loop-foot">
      Everything else on the site supports this loop.
      <strong>The technology is only there to make the reply reliable.</strong>
    </div>
  </div>

  <div class="rule"></div>

  <!-- RULES -->
  <h2>Rules That Keep It Stable</h2>
  <p class="h2note">Learned the hard way. Break these and things quietly stop working.</p>

  <div class="rules">
    <div class="rule-card">
      <div class="rule-t">The roster spells the names</div>
      <div class="rule-d">Player names in the roster tab are the source of truth. When a stats
      export disagrees, fix the export, not the roster.</div>
    </div>
    <div class="rule-card">
      <div class="rule-t">Update the script, keep the URL</div>
      <div class="rule-d">Publish changes as a new version of the existing deployment. A brand
      new deployment creates a new address and breaks the site.</div>
    </div>
    <div class="rule-card">
      <div class="rule-t">Spreadsheet first, code last</div>
      <div class="rule-d">Challenges, clips, recognitions, and messages are all rows. Only layout
      changes need a new version of the site.</div>
    </div>
    <div class="rule-card">
      <div class="rule-t">Column names are exact</div>
      <div class="rule-d">Columns are found by name, not position. Reorder them freely, never
      rename them.</div>
    </div>
  </div>

  <div class="rule"></div>

  <!-- REFERENCE -->
  <h2>Where To Do What</h2>
  <p class="h2note">The weekly coaching routine, start to finish.</p>

  <table>
    <thead><tr><th>To do this</th><th>Go here</th></tr></thead>
    <tbody>
      <tr><td>Assign a film clip to a player</td><td>coaching_videos</td></tr>
      <tr><td>Reply to a player's reflection</td><td>Reflections_Log</td></tr>
      <tr><td>Recognize a moment</td><td>moments</td></tr>
      <tr><td>Name Player of the Week</td><td>moments · top row</td></tr>
      <tr><td>Update the message from the coach</td><td>coach_communication</td></tr>
      <tr><td>Launch a challenge</td><td>challenges</td></tr>
      <tr><td>Award a badge</td><td>challenge_badges</td></tr>
      <tr><td>Rate a player</td><td>Player_IDP</td></tr>
      <tr><td>Update match stats</td><td>Raw_Match_Stats · then sync</td></tr>
    </tbody>
  </table>

  <footer>Ajax Aspire U15 · Girls Academy Aspire · Coach Shawn Craig</footer>
</div>
</body>
</html>
