// pages/api/generate-story-cover.js
import applyCors from "../lib/cors.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {}
  }

  const { characterImageUrl, worldImageUrl, prompt = '', options = {} } = body || {};

  if (!characterImageUrl || !worldImageUrl) {
    return res.status(400).json({ error: "Missing characterImageUrl or worldImageUrl" });
  }

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  const REPLICATE_MODEL_VERSION_COVER = process.env.REPLICATE_MODEL_VERSION_COVER;
  if (!REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: "Missing REPLICATE_API_TOKEN" });
  }
  if (!REPLICATE_MODEL_VERSION_COVER) {
    return res.status(500).json({ error: "Missing REPLICATE_MODEL_VERSION_COVER" });
  }

  try {
    // Compose input for multi-image model. Many Replicate models accept an array of URLs under `images`.
    // We also allow arbitrary keys via `options` for model-specific tuning.
    const input = {
      prompt,
      images: [characterImageUrl, worldImageUrl],
      image_1: characterImageUrl,
      image_2: worldImageUrl,
      output_format: 'jpg',
      ...(options && typeof options === 'object' ? options : {})
    };

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: REPLICATE_MODEL_VERSION_COVER,
        input
      })
    });
    let data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Replicate cover request failed",
        detail: data?.detail || data?.error || data,
        status: response.status
      });
    }

    // Poll for completion if not succeeded
    let attempts = 0;
    if (!data?.urls?.get) {
      return res.status(502).json({ error: "Unexpected Replicate response (missing prediction URL)", raw: data });
    }

    while (data.status !== "succeeded" && data.status !== "failed" && attempts < 30) {
      await new Promise(res => setTimeout(res, 2000));
      const pollResponse = await fetch(data.urls.get, {
        headers: { "Authorization": `Token ${REPLICATE_API_TOKEN}` }
      });
      data = await pollResponse.json();
      if (!pollResponse.ok) {
        return res.status(502).json({ error: "Replicate polling failed", raw: data });
      }
      attempts++;
    }

    if (data.status === "succeeded" && data.output) {
      let imageUrl = null;
      if (typeof data.output === "string") imageUrl = data.output;
      else if (Array.isArray(data.output) && typeof data.output[0] === "string") imageUrl = data.output[0];
      return res.status(200).json({ imageUrl });
    } else {
      return res.status(500).json({ error: "No valid image URL from Replicate", raw: data });
    }
  } catch (error) {
    return res.status(500).json({ error: "Replicate image generation failed", detail: error?.message || String(error) });
  }
}


