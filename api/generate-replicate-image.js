// pages/api/generate-replicate-image.js

import Replicate from 'replicate';

export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('✅ Request received to generate-replicate-image');
    console.log('👉 Request body:', req.body);

    const prompt = req.body?.prompt;
    if (!prompt) {
      console.error('❌ No prompt provided');
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
    if (!REPLICATE_API_TOKEN) {
      console.error('❌ REPLICATE_API_TOKEN not found in env');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    console.log('✅ Token found, initializing Replicate');

    const replicate = new Replicate({
      auth: REPLICATE_API_TOKEN,
    });

    console.log('✅ Replicate initialized, running model...');

    const output = await replicate.run(
      'stability-ai/sdxl:latest',
      {
        input: {
          prompt,
          width: 512,
          height: 512,
          guidance_scale: 7.5,
          num_inference_steps: 50,
        }
      }
    );

    console.log('✅ Image generated:', output);

    res.status(200).json({ image: output });
  } catch (error) {
    console.error('❌ Error during Replicate call:', error);
    res.status(500).json({ error: 'Internal Server Error', detail: error.message });
  }
}
