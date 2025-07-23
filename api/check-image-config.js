export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Check all relevant API keys and model versions
    const stabilityApiKey = process.env.STABILITY_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const replicateApiKey = process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN;
    const replicateModelVersion = process.env.REPLICATE_MODEL_VERSION;

    const config = {
      stabilityApiKeyConfigured: !!stabilityApiKey,
      openaiApiKeyConfigured: !!openaiApiKey,
      replicateApiKeyConfigured: !!replicateApiKey,
      replicateModelVersionConfigured: !!replicateModelVersion,
      imageProvider: process.env.IMAGE_PROVIDER || 'dalle',
      useUnifiedImageGeneration: process.env.USE_UNIFIED_IMAGE_GENERATION === 'true',
      stableDiffusionRolloutPercentage: parseInt(process.env.STABLE_DIFFUSION_ROLLOUT_PERCENTAGE) || 0,
      replicateRolloutPercentage: 100,
      enableImageFallback: process.env.ENABLE_IMAGE_FALLBACK !== 'false',
    };

    console.log('[Config] Image generation config:', config);

    res.status(200).json(config);
  } catch (error) {
    console.error("Error checking image config:", error);
    res.status(500).json({ error: "Failed to check image configuration." });
  }
}