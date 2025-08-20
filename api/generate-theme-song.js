export const config = {
  runtime: 'nodejs'
};

// ElevenLabs Music integration (themes)
// Expects env ELEVENLABS_API_KEY and optional ELEVEN_MUSIC_ENDPOINT

export default async function handler(req, res) {
  // CORS (permissive for dev/testing)
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
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing ElevenLabs API key' });
  }

  try {
    const {
      prompt,
      durationSeconds = 12,
      style = 'storybook, whimsical, kid-friendly, orchestral-lite, loopable',
      loop = true,
      lyrics = '',
      vocalsStyle = ''
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "prompt"' });
    }

    const endpoint = process.env.ELEVEN_MUSIC_ENDPOINT || 'https://api.elevenlabs.io/v1/music/generate';

    const dur = Math.max(5, Math.min(30, Number(durationSeconds) || 12));
    // Provider-safe prompt: avoid flagged tokens (use natural language)
    const promptParts = [
      prompt,
      style && `in a ${style} style`,
      loop && 'designed to loop cleanly',
      `lasting about ${dur} seconds`,
      vocalsStyle === 'lyrics' ? 'featuring gentle, kid-safe vocals and original lyrics' : 'instrumental or very soft wordless vocals'
    ].filter(Boolean);

    const payload = {
      prompt: promptParts.join('. ').trim(),
      duration_seconds: dur,
      // Add common alternative keys for duration for broader compatibility
      duration: dur,
      length_seconds: dur,
      // Prefer provider-driven lyric generation when vocalsStyle is 'lyrics'
      options: { loop, safe: true, vocals: vocalsStyle || 'instrumental' }
    };

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
      const text = !maybeJson ? await response.text() : undefined;
      return res.status(response.status).json({
        error: 'Music generation failed',
        details: maybeJson || text || `HTTP ${response.status}`
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('audio/')) {
      const audioBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(audioBuffer).toString('base64');
      const dataUrl = `data:audio/mpeg;base64,${base64}`;
      return res.status(200).json({ success: true, audioUrl: dataUrl, provider: 'elevenlabs' });
    } else {
      const data = await response.json();
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


