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
    const tryOnce = async (input) => {
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
        return { ok: false, status: createResp.status, data };
      }
      if (!data?.urls?.get) {
        return { ok: false, status: 502, data: { error: 'Missing prediction URL', raw: data } };
      }
      let attempts = 0;
      while (data.status !== "succeeded" && data.status !== "failed" && data.status !== "canceled" && attempts < 30) {
        await new Promise(r => setTimeout(r, 2000));
        const pollResponse = await fetch(data.urls.get, {
          headers: { "Authorization": `Token ${REPLICATE_API_TOKEN}` }
        });
        const polled = await pollResponse.json();
        if (!pollResponse.ok) {
          return { ok: false, status: 502, data: { error: 'Polling failed', raw: polled } };
        }
        data = polled;
        attempts++;
      }
      if (data.status === "succeeded" && data.output) {
        let imageUrl = null;
        if (typeof data.output === "string") imageUrl = data.output;
        else if (Array.isArray(data.output) && typeof data.output[0] === "string") imageUrl = data.output[0];
        if (imageUrl) return { ok: true, imageUrl };
        return { ok: false, status: 502, data: { error: 'No output URL', raw: data } };
      }
      return { ok: false, status: 502, data };
    };

    // First attempt with requested aspect ratio (default 3:4)
    const baseInput = {
      prompt: prompt || '',
      input_image_1: characterImageUrl,
      input_image_2: worldImageUrl,
      aspect_ratio: (options && options.aspect_ratio) || '3:4'
    };

    let attempt = await tryOnce(baseInput);
    if (!attempt.ok) {
      // Fallback: try square aspect ratio which is broadly supported
      const fallbackInput = { ...baseInput, aspect_ratio: '1:1' };
      const second = await tryOnce(fallbackInput);
      if (second.ok) {
        return res.status(200).json({ imageUrl: second.imageUrl, note: 'fallback_aspect_ratio_1_1' });
      }
      const detail = attempt.data?.detail || attempt.data?.error || attempt.data;
      return res.status(attempt.status || 502).json({ error: 'Prediction failed', detail, raw: attempt.data });
    }
    return res.status(200).json({ imageUrl: attempt.imageUrl });
  } catch (error) {
    return res.status(500).json({ error: "Replicate image generation failed", detail: error?.message || String(error) });
  }
}


