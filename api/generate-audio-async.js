// Simplified version without Firebase for now - just to get CORS working
console.log('[generate-audio-async] Starting simplified version');

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, voice_id, tts_provider = 'elevenlabs' } = req.body;
  const selectedVoice = voice_id || '21m00Tcm4TlvDq8ikWAM'; // Default ElevenLabs voice

  if (!text) {
    return res.status(400).json({ error: 'Missing "text" in request body' });
  }

  // Simplified response - just return success for now
  const jobId = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[generate-audio-async] Received request for text: "${text.substring(0, 50)}..."`);
  
  return res.status(200).json({
    jobId,
    status: 'processing',
    message: 'TTS generation started (simplified version)'
  });
}

// Simplified version - Firebase functions removed for now 