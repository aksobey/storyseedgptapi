// /pages/api/generate-replicate-image.js

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  // Enforce POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  const modelVersion = '03d58532fd29e39fd2ed80e86c3da1cebec28ef2734081cf1366710d30388f42'; // hidream-l1-full

  const { prompt } = req.body;

  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt' });
    return;
  }

  try {
    // Start the prediction
    const replicateRes = await fetch(
      `https://api.replicate.com/v1/predictions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: modelVersion,
          input: {
            seed: 1,
            prompt: prompt,
            model_type: "full",
            resolution: "1024 × 1024 (Square)",
            speed_mode: "Juiced 🔥 (more speed)",
            output_format: "webp",
            output_quality: 80
          },
        }),
      }
    );

    if (!replicateRes.ok) {
      const errorData = await replicateRes.json();
      console.error('[Replicate API Error]', errorData);
      res.status(422).json({ error: 'Replicate API failed', details: errorData });
      return;
    }

    const prediction = await replicateRes.json();
    let status = prediction.status;
    let output = prediction.output;
    const getUrl = prediction.urls.get;

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60; // up to 5 minutes
    while (status !== 'succeeded' && status !== 'failed' && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
      const pollRes = await fetch(getUrl, {
        headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
      });
      const pollData = await pollRes.json();
      status = pollData.status;
      output = pollData.output;
    }

    if (status === 'succeeded' && output && output.length > 0) {
      res.status(200).json({ imageUrl: output[0] });
    } else {
      res.status(500).json({ error: 'Replicate prediction failed or timed out', details: status });
    }
  } catch (err) {
    console.error('[Server Error]', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}