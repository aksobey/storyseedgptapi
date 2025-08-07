export const config = {
  runtime: 'nodejs'
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'Missing ElevenLabs API key',
      status: 'missing_key'
    });
  }

  try {
    // Test with the exact same parameters as the working TTS generation
    console.log('[test-elevenlabs-simple] Testing with exact TTS parameters...');
    
    const testText = "Test";
    const voiceId = '21m00Tcm4TlvDq8ikWAM'; // Same as backend default
    
    console.log('[test-elevenlabs-simple] API Key present:', !!apiKey);
    console.log('[test-elevenlabs-simple] Voice ID:', voiceId);
    console.log('[test-elevenlabs-simple] Text:', testText);
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: testText,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    console.log('[test-elevenlabs-simple] Response status:', response.status);
    console.log('[test-elevenlabs-simple] Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[test-elevenlabs-simple] ElevenLabs API error:', error);
      return res.status(500).json({ 
        error: `ElevenLabs API test failed: ${error}`,
        status: 'api_error',
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries())
      });
    }

    const audioBuffer = await response.arrayBuffer();
    console.log('[test-elevenlabs-simple] Success! Audio size:', audioBuffer.byteLength);
    
    return res.status(200).json({
      success: true,
      status: 'working',
      audioSize: audioBuffer.byteLength,
      message: 'ElevenLabs API key is working correctly'
    });

  } catch (error) {
    console.error('[test-elevenlabs-simple] Error:', error);
    return res.status(500).json({ 
      error: `ElevenLabs API test failed: ${error.message}`,
      status: 'network_error',
      stack: error.stack
    });
  }
} 