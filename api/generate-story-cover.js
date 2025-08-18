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

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY;
  const REPLICATE_MODEL_VERSION_COVER = process.env.REPLICATE_MODEL_VERSION_COVER;
  if (!REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: "Missing REPLICATE_API_TOKEN" });
  }
  if (!REPLICATE_MODEL_VERSION_COVER) {
    return res.status(500).json({ error: "Missing REPLICATE_MODEL_VERSION_COVER" });
  }

  try {
    // Compose input per model contract
    const input = {
      prompt: prompt || '',
      input_image_1: characterImageUrl,
      input_image_2: worldImageUrl,
      aspect_ratio: (options && options.aspect_ratio) || '3:4'
    };

    // Create prediction via REST with explicit version
    const createResp = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ version: REPLICATE_MODEL_VERSION_COVER, input })
    });
    let data = await createResp.json();
    if (!createResp.ok) {
      return res.status(createResp.status).json({
        error: "Replicate cover request failed",
        detail: data?.detail || data?.error || data,
        status: createResp.status
      });
    }

    if (!data?.urls?.get) {
      return res.status(502).json({ error: "Unexpected Replicate response (missing prediction URL)", raw: data });
    }

    // Poll for completion
    let attempts = 0;
    while (data.status !== "succeeded" && data.status !== "failed" && attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));
      const pollResponse = await fetch(data.urls.get, {
        headers: { "Authorization": `Token ${REPLICATE_API_TOKEN}` }
      });
      const polled = await pollResponse.json();
      if (!pollResponse.ok) {
        return res.status(502).json({ error: "Replicate polling failed", raw: polled });
      }
      data = polled;
      attempts++;
    }

    if (data.status === "succeeded" && data.output) {
      let imageUrl = null;
      if (typeof data.output === "string") imageUrl = data.output;
      else if (Array.isArray(data.output) && typeof data.output[0] === "string") imageUrl = data.output[0];
      if (!imageUrl) {
        return res.status(502).json({ error: "Replicate returned no URL", raw: data });
      }
      return res.status(200).json({ imageUrl });
    }

    return res.status(502).json({ error: "Prediction failed", raw: data });
  } catch (error) {
    return res.status(500).json({ error: "Replicate image generation failed", detail: error?.message || String(error) });
  }
}


