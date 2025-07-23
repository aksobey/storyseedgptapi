export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  const replicateToken = process.env.REPLICATE_API_TOKEN;
  const Replicate = (await import('replicate')).default;
  const replicate = new Replicate({ auth: replicateToken });

  try {
    const output = await replicate.run(
      "prunaai/hidream-l1-full:70e52dbcff0149b38a2d1006427c5d35471e90010b1355220e40574fbef306fb",
      {
        input: {
          seed: 1,
          prompt,
          model_type: "full",
          resolution: "1024 × 1024 (Square)", // Note: includes UTF-8 multiply sign
          speed_mode: "Juiced 🔥 (more speed)", // Emoji and casing matter!
          output_format: "webp",
          output_quality: 80
        }
      }
    );

    if (!output || typeof output !== "string") {
      console.error("Unexpected Replicate output:", output);
      return res.status(500).json({ error: "Invalid image output from Replicate" });
    }

    res.status(200).json({ imageUrl: output });
  } catch (err) {
    console.error("[Replicate Error]", err);
    return res.status(500).json({
      error: "Image generation failed",
      detail: err?.message || err
    });
  }
}
