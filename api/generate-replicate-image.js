export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  // Restrict to POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  const replicateToken = process.env.REPLICATE_API_TOKEN;

  const Replicate = (await import("replicate")).default;
  const replicate = new Replicate({ auth: replicateToken });

  try {
    const output = await replicate.run(
      "prunaai/hidream-l1-full:70e52dbcff0149b38a2d1006427c5d35471e90010b1355220e40574fbef306fb",
      {
        input: {
          prompt,
          seed: 1,
          model_type: "full",
          resolution: "1024x1024",
          speed_mode: "juiced",
          output_format: "webp",
          output_quality: 80,
        },
      }
    );

    if (!output || !output.output || typeof output.output !== "string") {
      console.error("Replicate returned unexpected output:", output);
      return res.status(500).json({ error: "Unexpected Replicate response format" });
    }

    res.status(200).json({ imageUrl: output.output });
  } catch (error) {
    console.error("🔥 Replicate generation failed:", error);
    res.status(500).json({ error: "Image generation failed", detail: error.message || error });
  }
}
