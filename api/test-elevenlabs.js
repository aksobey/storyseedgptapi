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
    // Test the API key by getting available voices
    console.log('[test-elevenlabs] Testing ElevenLabs API key...');
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    console.log('[test-elevenlabs] Response status:', response.status);
    
    if (!response.ok) {
      const error = await response.text();
      console.error('[test-elevenlabs] ElevenLabs API error:', error);
      return res.status(500).json({ 
        error: `ElevenLabs API test failed: ${error}`,
        status: 'api_error',
        statusCode: response.status
      });
    }

    const voices = await response.json();
    console.log('[test-elevenlabs] Successfully retrieved voices, count:', voices.length);
    
    return res.status(200).json({
      success: true,
      status: 'working',
      voiceCount: voices.length,
      message: 'ElevenLabs API key is valid and working'
    });

  } catch (error) {
    console.error('[test-elevenlabs] Error:', error);
    return res.status(500).json({ 
      error: `ElevenLabs API test failed: ${error.message}`,
      status: 'network_error'
    });
  }
} 