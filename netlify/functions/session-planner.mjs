// Netlify Function (v2) — Session Planner
// Calls Gemini through the Netlify AI Gateway. Credentials (GEMINI_API_KEY /
// GOOGLE_GEMINI_BASE_URL) are injected into the v2 runtime by Netlify — do not
// hardcode or configure your own key here.

const MODEL = 'gemini-3.5-flash';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // The planner response is unique per request, so it must never be cached.
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
    return json({ error: 'API key not configured' }, 500);
  }

  // Netlify points this at the AI Gateway; fall back to the public API host so
  // the function still works when run outside the gateway (e.g. local dev).
  const baseUrl = (
    process.env.GOOGLE_GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com'
  ).replace(/\/+$/, '');

  try {
    const { systemPrompt, userPrompt } = await req.json();

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
            temperature: 0.35,
            maxOutputTokens: 8192
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', data);
      return json({ error: data.error?.message || 'Gemini API error' }, response.status);
    }

    // Gemini may split output across multiple parts — join them all
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('');
    const finishReason = data.candidates?.[0]?.finishReason || 'STOP';

    return json({ text, finishReason });
  } catch (err) {
    console.error('Function error:', err);
    return json({ error: err.message }, 500);
  }
};
