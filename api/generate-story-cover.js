// pages/api/generate-story-cover.js
import applyCors from "../lib/cors.js";
import Replicate from "replicate";

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
  if (!REPLICATE_API_TOKEN) {
    return res.status(500).json({ error: "Missing REPLICATE_API_TOKEN" });
  }

  try {
    // Use Replicate SDK without specifying version; uses latest published version.
    const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

    const input = {
      prompt: prompt || '',
      input_image_1: characterImageUrl,
      input_image_2: worldImageUrl,
      aspect_ratio: (options && options.aspect_ratio) || '3:4'
    };

    const output = await replicate.run("flux-kontext-apps/multi-image-kontext-max", { input });
    // Output may be a string URL or an array of URLs
    let imageUrl = null;
    if (typeof output === 'string') imageUrl = output;
    else if (Array.isArray(output) && typeof output[0] === 'string') imageUrl = output[0];

    if (!imageUrl) {
      return res.status(502).json({ error: "Replicate returned no URL", raw: output });
    }
    return res.status(200).json({ imageUrl });
  } catch (error) {
    return res.status(500).json({ error: "Replicate image generation failed", detail: error?.message || String(error) });
  }
}


