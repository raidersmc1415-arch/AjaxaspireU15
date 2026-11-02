// Netlify Function (v2) — Halftime AI Engine
// Calls Gemini with match telemetry to provide an elite youth soccer tactical assessment.

const MODEL = 'gemini-2.5-flash';

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
    const { telemetry } = await req.json();

    const systemPrompt = `Act as an elite youth competitive soccer tactical analyst and performance director. Analyze 1st-half match telemetry.
Respond strictly in valid JSON matching this schema:
{
  "sentiment": "Dominant" | "Contested" | "Under Pressure",
  "gameFlowSummary": "2-sentence breakdown of field tilt, territory, and phase efficiency.",
  "tacticalInsights": ["Bullet 1", "Bullet 2", "Bullet 3"],
  "riskAlerts": ["Yellow card management or counter-press failure risks"],
  "recommendedHalfTimeAdjustments": ["Actionable adjustment 1", "Actionable adjustment 2"]
}`;

    const userPrompt = `Match Telemetry (1st Half):
- Opponent: ${telemetry.opponent || 'Opponent'}
- Score: Ajax Aspire ${telemetry.ajaxScore || 0} - ${telemetry.oppScore || 0} ${telemetry.opponent || 'Opponent'}
- Total Shots: Ajax ${telemetry.ajaxShots || 0} (On Target: ${telemetry.ajaxSot || 0}, Off Target: ${telemetry.ajaxSoff || 0}, Outside 18: ${telemetry.shotsOutside18 || 0}) vs Opponent ${telemetry.oppShots || 0}
- Pressing: ${telemetry.pressWon || 0} Won, ${telemetry.pressLost || 0} Lost (Efficiency: ${telemetry.pressEfficiency || '0%'})
- Territory: ${telemetry.goalKicksDefending || 0} Defending Goal Kicks (Opponent pinned deep) vs ${telemetry.goalKicksAttacking || 0} Attacking Goal Kicks (Ajax build-out)
- Crosses: ${telemetry.crosses || 0}
- Turnovers by Third: Defending ${telemetry.toD || 0}, Middle ${telemetry.toM || 0}, Attacking ${telemetry.toA || 0}
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
