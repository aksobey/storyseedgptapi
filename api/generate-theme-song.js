export const config = {
  runtime: 'nodejs'
};

// Minimal ElevenLabs Music integration (debug/MVP)
// Expects env ELEVENLABS_API_KEY and optional ELEVEN_MUSIC_ENDPOINT
// Falls back to returning a base64 data URL in JSON: { success, audioUrl }

export default async function handler(req, res) {
  // Mimic other working endpoints: permissive inline CORS for now
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;

  try {
    const {
      prompt,
      durationSeconds = 12,
      style = 'storybook, whimsical, kid-friendly, orchestral-lite, no vocals, loopable',
      loop = true
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "prompt"' });
    }

    // Endpoint is configurable to allow quick fixes without redeploy
    const endpoint = process.env.ELEVEN_MUSIC_ENDPOINT || 'https://api.elevenlabs.io/v1/music/generate';

    // Build a conservative payload. The exact schema may vary by access tier;
    // using generic fields that many text-to-music APIs accept.
    const payload = {
      prompt: `${prompt}. Style: ${style}. ${loop ? 'Loopable' : ''}`.trim(),
      duration_seconds: Math.max(5, Math.min(30, Number(durationSeconds) || 12)),
      // Room for provider-specific options without breaking clients
      options: {
        loop,
        safe: true
      }
    };

    // Prefer ElevenLabs Music first when key has access
    if (!apiKey) {
      // If no EL key, go straight to Replicate fallback
      return await tryReplicateFallback({ prompt, durationSeconds, loop, res });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const maybeJson = await safeReadJson(response);
      // If limited access, try Replicate fallback
      const limited = maybeJson && (maybeJson.detail?.status === 'limited_access' || maybeJson.status === 'limited_access');
      if (response.status === 403 && limited) {
        return await tryReplicateFallback({ prompt, durationSeconds, loop, res, providerError: maybeJson });
      }
      const text = !maybeJson ? await response.text() : undefined;
      return res.status(response.status).json({
        error: 'Music generation failed',
        details: maybeJson || text || `HTTP ${response.status}`
      });
    }

    const contentType = response.headers.get('content-type') || '';
    // Prefer audio buffer; fall back to JSON contract if provider returns JSON
    if (contentType.includes('audio/')) {
      const audioBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(audioBuffer).toString('base64');
      const dataUrl = `data:audio/mpeg;base64,${base64}`;
      return res.status(200).json({ success: true, audioUrl: dataUrl, provider: 'elevenlabs' });
    } else {
      const data = await response.json();
      // If provider returns a URL directly
      if (data && (data.audioUrl || data.url)) {
        return res.status(200).json({ success: true, audioUrl: data.audioUrl || data.url, provider: 'elevenlabs' });
      }
      return res.status(200).json({ success: true, result: data, provider: 'elevenlabs' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}

async function safeReadJson(response) {
  try {
    const text = await response.text();
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

// Replicate fallback using a configurable model version
async function tryReplicateFallback({ prompt, durationSeconds, loop, res, providerError = null }) {
  try {
    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY;
    const REPLICATE_MODEL_VERSION_MUSIC = process.env.REPLICATE_MODEL_VERSION_MUSIC;
    if (!REPLICATE_API_TOKEN || !REPLICATE_MODEL_VERSION_MUSIC) {
      return res.status(403).json({
        error: 'Music generation failed',
        details: providerError || { error: 'Replicate fallback unavailable: missing REPLICATE_API_TOKEN or REPLICATE_MODEL_VERSION_MUSIC' }
      });
    }

    const createResp = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: REPLICATE_MODEL_VERSION_MUSIC,
        input: {
          prompt,
          duration: Math.max(5, Math.min(30, Number(durationSeconds) || 12)),
          loop: !!loop
        }
      })
    });

    const created = await createResp.json();
    if (!createResp.ok || !created?.urls?.get) {
      return res.status(createResp.status || 502).json({ error: 'Replicate create failed', details: created });
    }

    let attempts = 0;
    let data = created;
    while (data.status !== 'succeeded' && data.status !== 'failed' && data.status !== 'canceled' && attempts < 60) {
      await new Promise(r => setTimeout(r, 2000));
      const poll = await fetch(data.urls.get, { headers: { 'Authorization': `Token ${REPLICATE_API_TOKEN}` } });
      const polled = await poll.json();
      if (!poll.ok) {
        return res.status(502).json({ error: 'Replicate poll failed', details: polled });
      }
      data = polled;
      attempts++;
    }

    if (data.status === 'succeeded' && data.output) {
      // Many music models return an array of URLs; pick the first if string
      let audioUrl = null;
      if (typeof data.output === 'string') audioUrl = data.output;
      else if (Array.isArray(data.output) && typeof data.output[0] === 'string') audioUrl = data.output[0];
      if (audioUrl) return res.status(200).json({ success: true, audioUrl, provider: 'replicate' });
      return res.status(502).json({ error: 'Replicate success but no output URL', details: data });
    }

    return res.status(502).json({ error: 'Replicate generation failed', details: data });
  } catch (e) {
    return res.status(500).json({ error: 'Replicate fallback error', details: e?.message || String(e) });
  }
}


