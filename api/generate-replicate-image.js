// /api/generate-replicate-image.js

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  const MODEL_VERSION =
    process.env.REPLICATE_MODEL_VERSION ||
    "70e52dbcff0149b38a2d1006427c5d35471e90010b1355220e40574fbef306fb";

  if (!REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: "Missing REPLICATE_API_TOKEN" });
  }

  try {
    const Replicate = (await import("replicate")).default;
    const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

    console.log("[Replicate Debug] Prompt:", prompt);

    const output = await replicate.run(
      `prunaai/hidream-l1-full:${MODEL_VERSION}`,
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

    console.log("[Replicate Debug] Raw output:", output);

    let imageUrl = null;

    if (typeof output === "string") {
      imageUrl = output;
    } else if (Array.isArray(output) && typeof output[0] === "string") {
      imageUrl = output[0];
    } else if (output?.output && typeof output.output === "string") {
      imageUrl = output.output;
    }

    if (!imageUrl) {
      return res.status(500).json({ error: "Invalid image output from Replicate", raw: output });
    }

    return res.status(200).json({ imageUrl });
  } catch (err) {
    console.error("[Replicate Error]", err);
    return res.status(500).json({
      error: "Image generation failed",
      details: err.message || err,
    });
  }
}
