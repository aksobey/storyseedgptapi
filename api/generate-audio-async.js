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

  // Generate unique job ID
  const jobId = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Store job in memory (in production, use Redis or database)
  const job = {
    id: jobId,
    status: 'processing',
    text,
    voice_id: selectedVoice,
    tts_provider,
    created_at: new Date().toISOString(),
    result: null,
    error: null
  };

  // Store job in global memory (simple in-memory storage for now)
  if (!global.ttsJobs) {
    global.ttsJobs = new Map();
  }
  global.ttsJobs.set(jobId, job);
  console.log(`[generate-audio-async] Job created: ${jobId}, total jobs: ${global.ttsJobs.size}`);

  // Start TTS generation in background
  generateTTSAsync(jobId, text, selectedVoice, tts_provider);

  // Return immediately with job ID
  return res.status(200).json({
    jobId,
    status: 'processing',
    message: 'TTS generation started'
  });
}

async function generateTTSAsync(jobId, text, voiceId, ttsProvider) {
  console.log(`[generateTTSAsync] Starting TTS generation for jobId: ${jobId}`);
  try {
    let audioUrl = null;
    let error = null;

    if (ttsProvider === 'elevenlabs') {
      console.log(`[generateTTSAsync] Using ElevenLabs for jobId: ${jobId}`);
      audioUrl = await generateElevenLabsTTS(text, voiceId);
    } else if (ttsProvider === 'google') {
      audioUrl = await generateGoogleTTS(text, voiceId);
    } else {
      error = `Unsupported TTS provider: ${ttsProvider}`;
    }

    // Update job status
    const job = global.ttsJobs.get(jobId);
    if (job) {
      job.status = audioUrl ? 'completed' : 'failed';
      job.result = audioUrl;
      job.error = error;
      job.completed_at = new Date().toISOString();
      global.ttsJobs.set(jobId, job);
      console.log(`[generateTTSAsync] Job ${jobId} updated to status: ${job.status}`);
    } else {
      console.log(`[generateTTSAsync] Job ${jobId} not found when updating status`);
    }

  } catch (err) {
    // Update job with error
    const job = global.ttsJobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = err.message;
      job.completed_at = new Date().toISOString();
      global.ttsJobs.set(jobId, job);
    }
  }
}

async function generateElevenLabsTTS(text, voiceId) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ElevenLabs API key');
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
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
    throw new Error(`ElevenLabs TTS failed: ${error}`);
  }

  const audioBuffer = await response.arrayBuffer();
  
  // For now, we'll return a data URL
  // In production, you'd upload to cloud storage and return the URL
  const base64 = Buffer.from(audioBuffer).toString('base64');
  return `data:audio/mpeg;base64,${base64}`;
}

async function generateGoogleTTS(text, voiceId) {
  // Placeholder for Google TTS implementation
  // This would use Google Cloud Text-to-Speech API
  throw new Error('Google TTS not yet implemented');
} 