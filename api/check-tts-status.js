// Simplified version without Firebase for now - just to get CORS working
console.log('[check-tts-status] Starting simplified version');

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;

  if (!jobId) {
    return res.status(400).json({ error: 'Missing "jobId" query parameter' });
  }

  console.log(`[check-tts-status] Checking jobId: ${jobId}`);

  // Simplified response - just return a mock completed status
  return res.status(200).json({
    jobId: jobId,
    status: 'completed',
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    tts_provider: 'elevenlabs',
    voice_id: '21m00Tcm4TlvDq8ikWAM',
    audioUrl: 'data:audio/mpeg;base64,mock_audio_data'
  });
} 