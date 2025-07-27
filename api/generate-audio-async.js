// Firebase imports - will be loaded only when needed
let firebaseApp, firestore, doc, setDoc, getDoc, updateDoc;

// Initialize Firebase function - called only when needed
function initializeFirebase() {
  if (firestore) return firestore; // Already initialized
  
  try {
    // Dynamic imports to avoid module-level crashes
    const { initializeApp } = require('firebase/app');
    const { getFirestore } = require('firebase/firestore');
    
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
    };

    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.error('[generate-audio-async] Missing Firebase environment variables');
      return null;
    }

    firebaseApp = initializeApp(firebaseConfig);
    firestore = getFirestore(firebaseApp);
    
    // Get Firestore functions
    const { doc: docFn, setDoc: setDocFn, getDoc: getDocFn, updateDoc: updateDocFn } = require('firebase/firestore');
    doc = docFn;
    setDoc = setDocFn;
    getDoc = getDocFn;
    updateDoc = updateDocFn;
    
    console.log('[generate-audio-async] Firebase initialized successfully');
    return firestore;
  } catch (error) {
    console.error('[generate-audio-async] Firebase initialization failed:', error.message);
    return null;
  }
}

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

  // Initialize Firebase only when needed
  const db = initializeFirebase();
  if (!db) {
    console.error('[generate-audio-async] Firebase not available');
    return res.status(500).json({ error: 'Database not available' });
  }

  // Generate unique job ID
  const jobId = `tts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Store job in Firestore
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

  try {
    // Store job in Firestore
    const jobRef = doc(db, 'tts_jobs', jobId);
    await setDoc(jobRef, job);
    console.log(`[generate-audio-async] Job created in Firestore: ${jobId}`);

    // Start TTS generation in background
    generateTTSAsync(jobId, text, selectedVoice, tts_provider);

    // Return immediately with job ID
    return res.status(200).json({
      jobId,
      status: 'processing',
      message: 'TTS generation started'
    });
  } catch (error) {
    console.error(`[generate-audio-async] Error creating job: ${error.message}`);
    return res.status(500).json({ error: 'Failed to create job' });
  }
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

    // Update job status in Firestore
    const jobRef = doc(db, 'tts_jobs', jobId);
    const jobDoc = await getDoc(jobRef);
    
    if (jobDoc.exists()) {
      const updateData = {
        status: audioUrl ? 'completed' : 'failed',
        result: audioUrl,
        error: error,
        completed_at: new Date().toISOString()
      };
      await updateDoc(jobRef, updateData);
      console.log(`[generateTTSAsync] Job ${jobId} updated to status: ${updateData.status}`);
    } else {
      console.log(`[generateTTSAsync] Job ${jobId} not found when updating status`);
    }

  } catch (err) {
    console.error(`[generateTTSAsync] Error: ${err.message}`);
    // Update job with error in Firestore
    try {
      const jobRef = doc(db, 'tts_jobs', jobId);
      const jobDoc = await getDoc(jobRef);
      if (jobDoc.exists()) {
        await updateDoc(jobRef, {
          status: 'failed',
          error: err.message,
          completed_at: new Date().toISOString()
        });
      }
    } catch (updateError) {
      console.error(`[generateTTSAsync] Failed to update job with error: ${updateError.message}`);
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