// NOTE: This file must be placed in the /api directory for Vercel deployment.

export default async function handler(req, res) {
  // --- CORS HEADERS ---
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); // Or specify your domain instead of '*'
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, type, options } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Support both REPLICATE_API_KEY and REPLICATE_API_TOKEN
    const replicateApiKey = process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN;
    if (!replicateApiKey) {
      return res.status(500).json({ error: 'Replicate API key/token not configured' });
    }

    // Use model version from env
    const modelVersion = process.env.REPLICATE_MODEL_VERSION;
    if (!modelVersion) {
      return res.status(500).json({ error: 'Replicate model version not configured (set REPLICATE_MODEL_VERSION in env)' });
    }

    // Start prediction with selected model
    const startResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${replicateApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: modelVersion,
        input: {
          prompt: options?.prompt || prompt,
          seed: options?.seed || 1,
          speed_mode: options?.speed_mode || 'Juiced 🔥 (more speed)',
          output_quality: options?.output_quality || 80
        }
      })
    });

    if (!startResponse.ok) {
      const errorData = await startResponse.json();
      console.error('Replicate start error:', errorData);
      return res.status(startResponse.status).json({ error: 'Failed to start Replicate prediction' });
    }

    const prediction = await startResponse.json();
    console.log('Replicate prediction started:', prediction.id);

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    const pollInterval = 5000; // 5 seconds

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;

      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          'Authorization': `Token ${replicateApiKey}`,
        }
      });

      if (!statusResponse.ok) {
        console.error('Replicate status check failed:', statusResponse.status);
        continue;
      }

      const statusData = await statusResponse.json();
      console.log(`Replicate status (attempt ${attempts}):`, statusData.status);
      console.log('Replicate statusData:', statusData); // Debug: log the full Replicate response

      if (statusData.status === 'succeeded') {
        let imageUrl = null;
        if (statusData.output && Array.isArray(statusData.output) && statusData.output.length > 0) {
          imageUrl = statusData.output[0];
        } else {
          console.error('No valid output from Replicate:', statusData);
          return res.status(500).json({ error: 'No image URL returned from Replicate.' });
        }
        return res.json({ imageUrl, provider: 'replicate' });
      } else if (statusData.status === 'failed') {
        return res.status(500).json({ error: 'Replicate prediction failed' });
      }
    }

    return res.status(408).json({ error: 'Replicate prediction timeout' });

  } catch (error) {
    console.error('Replicate API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}