// Netlify Function (v2) — Halftime AI Engine
// Calls Gemini with match telemetry to provide an elite youth soccer tactical assessment.

const MODEL = 'gemini-3.8-flash';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store'
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: 'GEMINI_API_KEY not configured' }, 500);
  }

  const baseUrl = (
    process.env.GOOGLE_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com'
  ).replace(/\/+$/, '');

  try {
    const { telemetry, mode } = await req.json();
    const isFullMatch = mode === 'full_match' || (telemetry && telemetry.mode === 'full_match');

    const systemPrompt = isFullMatch
      ? `Act as an elite youth competitive soccer tactical analyst and performance director. Analyze full-match two-half telemetry accurately using the exact numbers provided.
Respond strictly in valid JSON matching this schema:
{
  "sentiment": "DOMINANT VICTORY" | "DECISIVE WIN" | "CONTESTED DRAW" | "COMPETITIVE MATCH" | "CHALLENGING DEFEAT",
  "gameFlowSummary": "2-sentence breakdown citing the exact score, total shots, and shots on target across the match.",
  "adaptationText": "2-sentence comparison of 1st-half vs 2nd-half goals, shots, pressing rate, and turnovers.",
  "standouts": ["Player 1 impact summary", "Player 2 impact summary"],
  "takeaways": ["Training focus 1", "Training focus 2", "Training focus 3"]
}`
      : `Act as an elite youth competitive soccer tactical analyst and performance director. Analyze 1st-half match telemetry accurately using the exact numbers provided.
Respond strictly in valid JSON matching this schema:
{
  "sentiment": "Dominant" | "Contested" | "Under Pressure",
  "gameFlowSummary": "2-sentence breakdown of field tilt, territory, and phase efficiency.",
  "tacticalInsights": ["Bullet 1", "Bullet 2", "Bullet 3"],
  "riskAlerts": ["Yellow card management or counter-press failure risks"],
  "recommendedHalfTimeAdjustments": ["Actionable adjustment 1", "Actionable adjustment 2"]
}`;

    const userPrompt = isFullMatch
      ? `Match Telemetry (Full Match · ${telemetry.matchMins || 80} mins):
- Squad: ${telemetry.squadName || 'Ajax Aspire U15'} vs ${telemetry.opponent || 'Opponent'}
- Final Score: ${telemetry.squadName || 'Ajax'} ${telemetry.ajaxScore || 0} - ${telemetry.oppScore || 0} ${telemetry.opponent || 'Opponent'}
- 1st Half: ${telemetry.goalsH1 || 0} Goals, ${telemetry.shotsH1 || 0} Shots (${telemetry.sotH1 || 0} SOT), ${telemetry.pressRateH1 || 0}% Press/Duel Win, ${telemetry.toH1 || 0} Turnovers, ${telemetry.foulsH1 || 0} Fouls
- 2nd Half: ${telemetry.goalsH2 || 0} Goals, ${telemetry.shotsH2 || 0} Shots (${telemetry.sotH2 || 0} SOT), ${telemetry.pressRateH2 || 0}% Press/Duel Win, ${telemetry.toH2 || 0} Turnovers, ${telemetry.foulsH2 || 0} Fouls
- Total Shots & Quality: Ajax ${(telemetry.shotsH1 || 0) + (telemetry.shotsH2 || 0)} (${(telemetry.sotH1 || 0) + (telemetry.sotH2 || 0)} SOT, xG-lite ${Number(telemetry.xgFor || 0).toFixed(2)}, ${telemetry.bigChancesFor || 0} Big Chances) vs Opponent ${telemetry.oppShots || 0} (xG-lite ${Number(telemetry.xgAgainst || 0).toFixed(2)}, ${telemetry.bigChancesAgainst || 0} Big Chances)
- Build-Out & Set Pieces: Goal Kicks Kept ${telemetry.goalKicksKept || 0}/${(telemetry.goalKicksKept || 0) + (telemetry.goalKicksLost || 0)} (${telemetry.gkRetentionPct ?? '--'}%), Set-Piece Shots ${telemetry.setPieceShots || 0}/${telemetry.setPieceAttempts || 0}
- Opponent Corners: ${telemetry.oppCorners || 0}, Opponent Fouls: ${telemetry.oppFouls || 0}, Opponent Subs: ${telemetry.oppSubs || 0}
- Standouts: ${(telemetry.standouts || []).map(s => String(s).replace(/<[^>]*>/g, '')).join('; ') || 'Balanced team effort'}`
      : `Match Telemetry (1st Half):
- Squad: ${telemetry.squadName || 'Ajax Aspire U15'} vs ${telemetry.opponent || 'Opponent'}
- Score: ${telemetry.squadName || 'Ajax'} ${telemetry.ajaxScore || 0} - ${telemetry.oppScore || 0} ${telemetry.opponent || 'Opponent'}
- Shots & Quality: Ajax ${telemetry.ajaxShots || 0} Shots (${telemetry.ajaxSot || 0} On Target, ${telemetry.ajaxSoff || 0} Off Target, ${telemetry.shotsOutside18 || 0} Outside 18, xG-lite ${Number(telemetry.xgFor || 0).toFixed(2)}, ${telemetry.bigChancesCreated || 0} Big Chances Created, ${telemetry.bigChancesMissed || 0} Missed) vs Opponent ${telemetry.oppShots || 0} Shots (xG-lite ${Number(telemetry.xgAgainst || 0).toFixed(2)}, ${telemetry.oppBigChances || 0} Big Chances Conceded)
- Pressing & High Regains: ${telemetry.pressWon || 0} Won, ${telemetry.pressLost || 0} Lost (Efficiency: ${telemetry.pressEfficiency || '0%'}), ${telemetry.highRegains || 0} High Regains (A3/M3)
- Build-Out & Territory: ${telemetry.goalKicksDefending || 0} Defending Goal Kicks (Opponent pinned deep) vs ${telemetry.goalKicksAttacking || 0} Ajax Build-Out Goal Kicks (${telemetry.goalKicksKept || 0} Kept, ${telemetry.goalKicksLost || 0} Lost, Retention: ${telemetry.gkRetentionPct || '--'}) · Tilt: ${telemetry.territoryTilt || 'Balanced (50/50)'}
- Set Pieces & Crosses: ${telemetry.setPieceShots || 0} shots from ${telemetry.setPieceAttempts || 0} corners/free kicks · Crosses: ${telemetry.crosses || 0}
- Turnovers by Third: Defending ${telemetry.toD || 0}, Middle ${telemetry.toM || 0}, Attacking ${telemetry.toA || 0} (Total: ${telemetry.turnovers ?? ((telemetry.toD || 0) + (telemetry.toM || 0) + (telemetry.toA || 0))})
- Fouls & Discipline: Ajax Fouls ${telemetry.ajaxFouls || 0}, Ajax Yellows ${telemetry.ajaxYellows || 0} (Carded: ${telemetry.cardedPlayers || 'None'}), Opponent Fouls ${telemetry.oppFouls || 0}
- Key Events / Highlights: ${telemetry.recentEventsSummary || 'None'}`;

    const response = await fetch(
      `${baseUrl}/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
            maxOutputTokens: 2048
          }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini API error:', data);
      return json({ error: data.error?.message || 'Gemini API error' }, response.status);
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('');

    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    return json({ report: parsed, raw: text });
  } catch (err) {
    console.error('Halftime AI function error:', err);
    return json({ error: err.message }, 500);
  }
};
