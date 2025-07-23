// pages/api/generate-world-image.js

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
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
  const REPLICATE_MODEL_VERSION_WORLD = process.env.REPLICATE_MODEL_VERSION_WORLD;
  if (!REPLICATE_API_TOKEN || !REPLICATE_MODEL_VERSION_WORLD) {
    return res.status(500).json({ error: "Missing Replicate API key or world model version" });
  }

  try {
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: REPLICATE_MODEL_VERSION_WORLD,
        input: {
          prompt
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

    if (data.status === "succeeded" && data.output) {
      let imageUrl = null;
      if (typeof data.output === "string") imageUrl = data.output;
      else if (Array.isArray(data.output) && typeof data.output[0] === "string") imageUrl = data.output[0];
      return res.status(200).json({ imageUrl });
    } else {
      return res.status(500).json({ error: "No valid image URL from Replicate", raw: data });
    }
  } catch (error) {
    return res.status(500).json({ error: "Replicate image generation failed", detail: error });
  }
}
