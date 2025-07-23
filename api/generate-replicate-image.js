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
  const modelVersion =
    '03d5852342f09e9fd2ed080e8dc9a1c0ebe28cf273f068c1f366710d3588402f'; // hidream-l1-full

  const { prompt } = req.body;

  if (!prompt) {
    res.status(400).json({ error: 'Missing prompt' });
    return;
  }

  try {
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
            prompt: prompt,
            seed: 1,
            speed_mode: 'Juiced 🔥 (more speed)',
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
    res.status(200).json({ image: prediction });
  } catch (err) {
    console.error('[Server Error]', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
