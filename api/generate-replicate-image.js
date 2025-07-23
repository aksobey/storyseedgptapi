// /api/generate-replicate-image.js

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  if (!REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: "Missing REPLICATE_API_TOKEN" });
  }

  const Replicate = (await import("replicate")).default;
  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

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

    console.log("🖼️ Replicate response output:", output);

    // Accept array or string
    let imageUrl = null;
    if (typeof output === "string") {
      imageUrl = output;
    } else if (Array.isArray(output) && typeof output[0] === "string") {
      imageUrl = output[0];
    }

    if (!imageUrl) {
      console.error("⚠️ No valid imageUrl from Replicate:", output);
      return res.status(500).json({ error: "No valid image URL from Replicate", raw: output });
    }

    return res.status(200).json({ imageUrl });
  } catch (error) {
    console.error("🔥 Replicate Error:", error);
    return res.status(500).json({ error: "Replicate image generation failed", detail: error.message });
  }
}
