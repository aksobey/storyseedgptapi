export const config = {
  runtime: 'nodejs'
};

export default async function handler(req, res) {
  // CORS headers - inline to avoid import issues
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  console.log('[generate-audio] Request received at:', new Date().toISOString());
  console.log('[generate-audio] Request method:', req.method);
  console.log('[generate-audio] Request body:', req.body);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Accept 'voice_id' from the request body, fallback to default if not provided
  const { text, voice_id } = req.body;
  const selectedVoice = voice_id || '21m00Tcm4TlvDq8ikWAM'; // Default ElevenLabs voice

  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing ElevenLabs API key' });
  }

  if (!text) {
    return res.status(400).json({ error: 'Missing "text" in request body' });
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(500).json({ error: 'TTS generation failed', details: error });
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'inline; filename="story.mp3"');
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
}
