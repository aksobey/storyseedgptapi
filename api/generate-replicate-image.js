// pages/api/generate-replicate-image.js

import Replicate from "replicate";

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    console.warn("⛔ Invalid method:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("✅ Request received at /generate-replicate-image");

  const { prompt } = req.body;
  console.log("📦 Request body:", req.body);

  if (!prompt) {
    console.error("❌ Missing prompt");
    return res.status(400).json({ error: "Missing prompt" });
  }

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  if (!REPLICATE_API_TOKEN) {
    console.error("❌ Missing REPLICATE_API_TOKEN in environment");
    return res.status(500).json({ error: "Missing REPLICATE_API_TOKEN" });
  }

  console.log("🔐 Token loaded successfully");

  try {
    const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });
    console.log("⚙️ Replicate SDK initialized");

    console.log("🚀 Sending to Replicate:", prompt);

    const output = await replicate.run(
      "prunaai/hidream-l1-full:70e52dbcff0149b38a2d1006427c5d35471e90010b1355220e40574fbef306fb",
      {
        input: {
          prompt,
          seed: 1,
          model_type: "full",
          resolution: "1024 × 1024 (Square)", // <-- Use exact allowed value
          speed_mode: "Juiced 🔥 (more speed)", // <-- Use exact allowed value
          output_format: "webp",
          output_quality: 80,
        },
      }
    );

    console.log("🖼️ Replicate response:", output);

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
    console.error("🔥 Error during Replicate image generation:", error);
    return res.status(500).json({
      error: "Replicate image generation failed",
      detail: error
    });
  }
}
