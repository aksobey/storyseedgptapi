// Firebase Admin imports - will be loaded only when needed
let firebaseAdminApp, firestore, bucket;

// Initialize Firebase Admin function - called only when needed
async function initializeFirebaseAdmin() {
  if (firestore && bucket) return { firestore, bucket }; // Already initialized
  
  try {
    // Dynamic imports to avoid module-level crashes
    const { initializeApp, cert } = await import('firebase-admin/app');
    const { getStorage } = await import('firebase-admin/storage');
    const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
    
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      console.log('[TTS] ✅ Parsed GOOGLE_APPLICATION_CREDENTIALS_JSON');
    } catch (err) {
      console.error('[TTS] ❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', err.message);
    }
    
    if (serviceAccount && process.env.FIREBASE_STORAGE_BUCKET) {
      firebaseAdminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
      
      firestore = getFirestore(firebaseAdminApp);
      bucket = getStorage(firebaseAdminApp).bucket();
      console.log('[TTS] ✅ Firebase Admin initialized');
    } else {
      console.warn('[TTS] ⚠️ Missing service account or bucket env var');
    }
    
    console.log('[TTS] Firebase Admin initialization complete');
    
    return { firestore, bucket };
  } catch (error) {
    console.error('[initializeFirebaseAdmin] Firebase Admin initialization failed:', error.message);
    console.error('[initializeFirebaseAdmin] Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return { firestore: null, bucket: null };
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
  
  // Set appropriate default voice based on provider
  let selectedVoice;
  if (tts_provider === 'google') {
    selectedVoice = voice_id || 'en-US-Wavenet-D'; // Default Google voice
  } else {
    selectedVoice = voice_id || '21m00Tcm4TlvDq8ikWAM'; // Default ElevenLabs voice
  }

  if (!text) {
    return res.status(400).json({ error: 'Missing "text" in request body' });
  }

  // Initialize Firebase Admin only when needed
  const { firestore, bucket } = await initializeFirebaseAdmin();
  console.log('[TTS] Using provider:', tts_provider);
  
  // For Vercel serverless functions, we need to use a different async approach
  // Instead of background processing, we'll use a "delayed response" pattern
  const useVercelAsyncMode = firestore && bucket;
  console.log('[TTS] Use Vercel async mode:', useVercelAsyncMode);
  
  if (!useVercelAsyncMode) {
          console.warn('[TTS] ⚠️ Using fallback mode (synchronous TTS generation)');
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
        // For fallback mode, create a temporary job ID
        const tempJobId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        audioUrl = await generateGoogleTTS(text, selectedVoice, tempJobId);

        // 🩹 Manually save job if Firestore is available
        if (audioUrl && firestore) {
          const jobId = tempJobId;
          await firestore.collection('tts_jobs').doc(jobId).set({
            id: jobId,
            status: 'completed',
            audioUrl,
            result: audioUrl,
            text,
            voice_id: selectedVoice,
            tts_provider,
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          });
          console.log('[TTS] ✅ Fallback mode: Google job saved to Firestore');
        }
        
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
    // Store job in Firestore using Firebase Admin
    const { firestore } = await initializeFirebaseAdmin();
    if (!firestore) {
      console.error('[generate-audio-async] Firebase not available for job creation');
      return res.status(500).json({ error: 'Database not available' });
    }
    
    console.log('[generate-audio-async] Attempting to create job in Firestore:', jobId);
    console.log('[generate-audio-async] Job data:', job);
    
    await firestore.collection('tts_jobs').doc(jobId).set(job);
    console.log(`[generate-audio-async] Job created successfully in Firestore: ${jobId}`);

    // For Vercel, we need to generate TTS synchronously but simulate async behavior
    // This allows us to keep the notification system while working within Vercel's constraints
    console.log('[generate-audio-async] Starting synchronous TTS generation for Vercel compatibility...');
    
    try {
      let audioUrl = null;
      let error = null;

      if (tts_provider === 'elevenlabs') {
        console.log(`[generate-audio-async] Using ElevenLabs for jobId: ${jobId}`);
        try {
          audioUrl = await generateElevenLabsTTS(text, selectedVoice);
          console.log(`[generate-audio-async] ElevenLabs TTS completed for jobId: ${jobId}, audioUrl length: ${audioUrl?.length || 'null'}`);
        } catch (ttsError) {
          console.error(`[generate-audio-async] ElevenLabs TTS failed for jobId: ${jobId}:`, ttsError);
          error = ttsError.message;
        }
      } else if (tts_provider === 'google') {
        console.log(`[generate-audio-async] Using Google TTS for jobId: ${jobId}`);
        try {
          audioUrl = await generateGoogleTTS(text, selectedVoice, jobId);
          console.log(`[generate-audio-async] Google TTS completed for jobId: ${jobId}, audioUrl length: ${audioUrl?.length || 'null'}`);
        } catch (ttsError) {
          console.error(`[generate-audio-async] Google TTS failed for jobId: ${jobId}:`, ttsError);
          error = ttsError.message;
        }
      } else {
        error = `Unsupported TTS provider: ${tts_provider}`;
        console.error(`[generate-audio-async] Unsupported TTS provider for jobId: ${jobId}: ${tts_provider}`);
      }

      // Update job status in Firestore
      const updateData = {
        status: audioUrl ? 'completed' : 'failed',
        audioUrl: audioUrl,
        result: audioUrl,
        error: error,
        completed_at: new Date().toISOString()
      };
      
      console.log(`[generate-audio-async] Updating job ${jobId} with data:`, updateData);
      await firestore.collection('tts_jobs').doc(jobId).set(updateData, { merge: true });
      console.log(`[generate-audio-async] Job ${jobId} updated to status: ${updateData.status}`);

      // Return the completed result immediately
      if (audioUrl) {
        return res.status(200).json({
          success: true,
          audioUrl,
          status: 'completed',
          jobId
        });
      } else {
        return res.status(500).json({
          error: error || 'TTS generation failed',
          status: 'failed',
          jobId
        });
      }
      
    } catch (error) {
      console.error(`[generate-audio-async] Error in synchronous TTS generation: ${error.message}`);
      
      // Update job with error
      await firestore.collection('tts_jobs').doc(jobId).set({
        status: 'failed',
        error: error.message,
        completed_at: new Date().toISOString()
      }, { merge: true });
      
      return res.status(500).json({
        error: error.message,
        status: 'failed',
        jobId
      });
    }
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
      try {
        audioUrl = await generateElevenLabsTTS(text, voiceId);
        console.log(`[generateTTSAsync] ElevenLabs TTS completed for jobId: ${jobId}, audioUrl length: ${audioUrl?.length || 'null'}`);
      } catch (ttsError) {
        console.error(`[generateTTSAsync] ElevenLabs TTS failed for jobId: ${jobId}:`, ttsError);
        error = ttsError.message;
      }
    } else if (ttsProvider === 'google') {
      console.log(`[generateTTSAsync] Using Google TTS for jobId: ${jobId}`);
      try {
        audioUrl = await generateGoogleTTS(text, voiceId, jobId);
        console.log(`[generateTTSAsync] Google TTS completed for jobId: ${jobId}, audioUrl length: ${audioUrl?.length || 'null'}`);
      } catch (ttsError) {
        console.error(`[generateTTSAsync] Google TTS failed for jobId: ${jobId}:`, ttsError);
        error = ttsError.message;
      }
    } else {
      error = `Unsupported TTS provider: ${ttsProvider}`;
      console.error(`[generateTTSAsync] Unsupported TTS provider for jobId: ${jobId}: ${ttsProvider}`);
    }

    // Update job status in Firestore using Firebase Admin
    try {
      console.log(`[generateTTSAsync] Attempting to update job ${jobId} in Firestore...`);
      const { firestore, Timestamp } = await initializeFirebaseAdmin();
      if (!firestore) {
        console.error(`[generateTTSAsync] Firebase not available for job ${jobId}`);
        return;
      }
      
      const jobDoc = await firestore.collection('tts_jobs').doc(jobId).get();
      console.log(`[generateTTSAsync] Job document exists: ${jobDoc.exists}`);
    
      if (jobDoc.exists) {
              const updateData = {
        status: audioUrl ? 'completed' : 'failed',
        audioUrl: audioUrl, // Use audioUrl field for consistency
        result: audioUrl,   // Keep result for backward compatibility
        error: error,
        completed_at: new Date().toISOString()
      };
        console.log(`[generateTTSAsync] Updating job ${jobId} with data:`, updateData);
        
        await firestore.collection('tts_jobs').doc(jobId).set(updateData, { merge: true });
        console.log(`[generateTTSAsync] Job ${jobId} successfully updated to status: ${updateData.status}`);
        
        if (audioUrl) {
          console.log(`[generateTTSAsync] Job ${jobId} completed with audioUrl length: ${audioUrl.length}`);
        } else {
          console.log(`[generateTTSAsync] Job ${jobId} failed with error: ${error}`);
        }
      } else {
        console.error(`[generateTTSAsync] Job ${jobId} not found when updating status`);
      }
    } catch (updateError) {
      console.error(`[generateTTSAsync] Failed to update job ${jobId} with error:`, updateError);
      console.error(`[generateTTSAsync] Error details:`, {
        message: updateError.message,
        code: updateError.code,
        stack: updateError.stack
      });
    }
  } catch (err) {
    console.error(`[generateTTSAsync] Error: ${err.message}`);
    // Update job with error in Firestore using Firebase Admin
    try {
      const { firestore, Timestamp } = await initializeFirebaseAdmin();
      if (firestore) {
        const jobDoc = await firestore.collection('tts_jobs').doc(jobId).get();
        if (jobDoc.exists) {
          await firestore.collection('tts_jobs').doc(jobId).set({
            status: 'failed',
            error: err.message || 'TTS generation failed',
            completed_at: new Date().toISOString()
          }, { merge: true });
        } else {
          console.warn(`[generateTTSAsync] Failed to update job: jobId not found`);
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
  console.log('[generateElevenLabsTTS] API Key present:', !!apiKey);
  console.log('[generateElevenLabsTTS] Voice ID:', voiceId);
  console.log('[generateElevenLabsTTS] Text length:', text.length);
  
  try {
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
  } catch (fetchError) {
    console.error('[generateElevenLabsTTS] Fetch error:', fetchError);
    console.error('[generateElevenLabsTTS] Error details:', {
      message: fetchError.message,
      code: fetchError.code,
      stack: fetchError.stack
    });
    throw new Error(`ElevenLabs API request failed: ${fetchError.message}`);
  }
}

async function generateGoogleTTS(text, voiceId, jobId) {
  try {
    if (!voiceId || !voiceId.startsWith('en-')) {
      throw new Error(`Invalid or unsupported Google TTS voice: ${voiceId}`);
    }

    console.log('[generateGoogleTTS] Starting Google TTS generation for jobId:', jobId);
    console.log('[generateGoogleTTS] Voice ID:', voiceId);
    console.log('[generateGoogleTTS] Text length:', text.length);

    const textToSpeech = await import('@google-cloud/text-to-speech');
    const client = new textToSpeech.default.TextToSpeechClient({
      credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)
    });

    const [lang, region, ...rest] = voiceId.split('-');
    const languageCode = `${lang}-${region}`;
    const voiceName = voiceId;

    const request = {
      input: { text },
      voice: {
        languageCode,
        name: voiceName
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0.0
      },
    };

    console.log('[generateGoogleTTS] Making request to Google TTS API...');
    console.log('[generateGoogleTTS] Request config:', {
      languageCode,
      voiceName,
      textLength: text.length,
      audioEncoding: 'MP3'
    });

    const [response] = await client.synthesizeSpeech(request);
    if (!response.audioContent) throw new Error('No audio content returned from Google TTS');

    console.log('[generateGoogleTTS] Google TTS API response received');
    console.log('[generateGoogleTTS] Audio content length:', response.audioContent.length);

    const { bucket } = await initializeFirebaseAdmin();
    const filePath = `tts_audio/google_${jobId}.mp3`;
    const file = bucket.file(filePath);

    console.log('[generateGoogleTTS] Uploading to Firebase Storage:', filePath);

    await file.save(response.audioContent, {
      metadata: { contentType: 'audio/mpeg' },
      public: true
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    console.log('[generateGoogleTTS] Successfully uploaded to Firebase Storage, URL:', publicUrl);
    
    return publicUrl;

  } catch (error) {
    console.error('[generateGoogleTTS] Error:', error.message);
    throw new Error(`Google TTS failed: ${error.message}`);
  }
} 