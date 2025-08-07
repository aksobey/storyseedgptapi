// Firebase imports - will be loaded only when needed
let firebaseApp, firestore, doc, setDoc, getDoc, updateDoc;

// Initialize Firebase function - called only when needed
async function initializeFirebase() {
  if (firestore) return firestore; // Already initialized
  
  try {
    // Dynamic imports to avoid module-level crashes
    const { initializeApp } = await import('firebase/app');
    const { getFirestore } = await import('firebase/firestore');
    
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
    const { doc: docFn, setDoc: setDocFn, getDoc: getDocFn, updateDoc: updateDocFn } = await import('firebase/firestore');
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

export const config = {
  runtime: 'nodejs'
};

export default async function handler(req, res) {
  // CORS headers - inline to avoid import issues
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

  const { text, voice_id, tts_provider = 'elevenlabs' } = req.body;
  const selectedVoice = voice_id || '21m00Tcm4TlvDq8ikWAM'; // Default ElevenLabs voice

  if (!text) {
    return res.status(400).json({ error: 'Missing "text" in request body' });
  }

  // Initialize Firebase only when needed
  const db = await initializeFirebase();
  if (!db) {
    console.warn('[generate-audio-async] Firebase not available, using fallback mode');
    // Fallback: generate TTS directly without job tracking
    try {
      console.log('[generate-audio-async] Using fallback mode for provider:', tts_provider);
      let audioUrl = null;
      
      if (tts_provider === 'elevenlabs') {
        console.log('[generate-audio-async] Attempting ElevenLabs TTS...');
        audioUrl = await generateElevenLabsTTS(text, selectedVoice);
        console.log('[generate-audio-async] ElevenLabs TTS completed successfully, audioUrl type:', typeof audioUrl, 'length:', audioUrl ? audioUrl.length : 'null');
      } else if (tts_provider === 'google') {
        console.log('[generate-audio-async] Attempting Google TTS...');
        audioUrl = await generateGoogleTTS(text, selectedVoice);
        console.log('[generate-audio-async] Google TTS completed successfully, audioUrl type:', typeof audioUrl, 'length:', audioUrl ? audioUrl.length : 'null');
      } else {
        console.error('[generate-audio-async] Unsupported provider:', tts_provider);
        return res.status(400).json({ error: `Unsupported TTS provider: ${tts_provider}` });
      }
      
      if (audioUrl) {
        console.log('[generate-audio-async] Fallback TTS generation successful, audioUrl length:', audioUrl.length);
        console.log('[generate-audio-async] About to return response with audioUrl');
        const response = {
          success: true,
          audioUrl,
          status: 'completed'
        };
        console.log('[generate-audio-async] Response object keys:', Object.keys(response));
        console.log('[generate-audio-async] Response object:', JSON.stringify(response, null, 2));
        return res.status(200).json(response);
      } else {
        console.error('[generate-audio-async] TTS generation returned null audioUrl');
        return res.status(500).json({ error: 'TTS generation failed - no audio URL returned' });
      }
    } catch (error) {
      console.error('[generate-audio-async] Fallback TTS generation failed:', error);
      return res.status(500).json({ error: 'TTS generation failed: ' + error.message });
    }
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
    const firestore = await initializeFirebase();
    if (!firestore) {
      console.error('[generate-audio-async] Firebase not available for job creation');
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const jobRef = doc(firestore, 'tts_jobs', jobId);
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
    try {
      const firestore = await initializeFirebase();
      if (!firestore) {
        console.error(`[generateTTSAsync] Firebase not available for job ${jobId}`);
        return;
      }
      
      const jobRef = doc(firestore, 'tts_jobs', jobId);
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
    } catch (updateError) {
      console.error(`[generateTTSAsync] Failed to update job with error: ${updateError.message}`);
    }
  } catch (err) {
    console.error(`[generateTTSAsync] Error: ${err.message}`);
    // Update job with error in Firestore
    try {
      const firestore = await initializeFirebase();
      if (firestore) {
        const jobRef = doc(firestore, 'tts_jobs', jobId);
        const jobDoc = await getDoc(jobRef);
        if (jobDoc.exists()) {
          await updateDoc(jobRef, {
            status: 'failed',
            error: err.message,
            completed_at: new Date().toISOString()
          });
        }
      }
    } catch (updateError) {
      console.error(`[generateTTSAsync] Failed to update job with error: ${updateError.message}`);
    }
  }
}

async function generateElevenLabsTTS(text, voiceId) {
  console.log('[generateElevenLabsTTS] Starting with voiceId:', voiceId);
  
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('[generateElevenLabsTTS] Missing ElevenLabs API key');
    throw new Error('Missing ElevenLabs API key');
  }

  console.log('[generateElevenLabsTTS] Making request to ElevenLabs API...');
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

  console.log('[generateElevenLabsTTS] Response status:', response.status);
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[generateElevenLabsTTS] ElevenLabs API error:', error);
    throw new Error(`ElevenLabs TTS failed: ${error}`);
  }

  console.log('[generateElevenLabsTTS] Converting response to base64...');
  const audioBuffer = await response.arrayBuffer();
  
  // For now, we'll return a data URL
  // In production, you'd upload to cloud storage and return the URL
  const base64 = Buffer.from(audioBuffer).toString('base64');
  const dataUrl = `data:audio/mpeg;base64,${base64}`;
  console.log('[generateElevenLabsTTS] Successfully generated base64 audio, dataUrl length:', dataUrl.length);
  console.log('[generateElevenLabsTTS] DataUrl starts with:', dataUrl.substring(0, 50) + '...');
  return dataUrl;
}

async function generateGoogleTTS(text, voiceId) {
  try {
    // Dynamic import to avoid module-level crashes
    const textToSpeech = require('@google-cloud/text-to-speech');
    
    // Initialize Google Cloud client
    const client = new textToSpeech.TextToSpeechClient({
      credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    });

    // Parse voice ID to get language and voice name
    // Expected format: "en-US-Standard-A" or "en-US-Wavenet-A"
    const voiceParts = voiceId.split('-');
    if (voiceParts.length < 3) {
      throw new Error('Invalid Google TTS voice ID format. Expected format: "en-US-Standard-A"');
    }
    
    const languageCode = `${voiceParts[0]}-${voiceParts[1]}`; // e.g., "en-US"
    const voiceName = voiceId; // Use full voice ID as name

    // Configure the request
    const request = {
      input: { text: text },
      voice: { 
        languageCode: languageCode,
        name: voiceName
      },
      audioConfig: { 
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0.0
      },
    };

    // Perform the text-to-speech request
    const [response] = await client.synthesizeSpeech(request);
    
    // Convert the audio content to base64
    const audioContent = response.audioContent;
    const base64 = Buffer.from(audioContent).toString('base64');
    
    return `data:audio/mp3;base64,${base64}`;
  } catch (error) {
    console.error('Google TTS error:', error);
    throw new Error(`Google TTS failed: ${error.message}`);
  }
} 