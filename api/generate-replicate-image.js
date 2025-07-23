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
    const REPLICATE_MODEL_VERSION = process.env.REPLICATE_MODEL_VERSION;
    // Use fetch to call Replicate REST API directly
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: REPLICATE_MODEL_VERSION,
        input: {
          prompt,
          // Optionally add input_image and output_format if needed
          // input_image: "<image_url>",
          output_format: "jpg"
        }
      })
    });
    let data = await response.json();

    // Poll for completion if not succeeded
    let attempts = 0;
    while (data.status !== "succeeded" && data.status !== "failed" && attempts < 30) {
      await new Promise(res => setTimeout(res, 2000));
      const pollResponse = await fetch(data.urls.get, {
        headers: { "Authorization": `Token ${REPLICATE_API_TOKEN}` }
      });
      data = await pollResponse.json();
      attempts++;
    }

    console.log("🖼️ Replicate API response:", data);

    if (data.status === "succeeded" && data.output) {
      let imageUrl = null;
      if (typeof data.output === "string") imageUrl = data.output;
      else if (Array.isArray(data.output) && typeof data.output[0] === "string") imageUrl = data.output[0];
      return res.status(200).json({ imageUrl });
    } else {
      console.error("⚠️ No valid imageUrl from Replicate API:", data);
      return res.status(500).json({ error: "No valid image URL from Replicate", raw: data });
    }
  } catch (error) {
    console.error("🔥 Error during Replicate image generation:", error);
    return res.status(500).json({
      error: "Replicate image generation failed",
      detail: error
    });
  }
}
