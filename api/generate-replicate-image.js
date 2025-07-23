export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }

  // Restrict to POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  const replicateToken = process.env.REPLICATE_API_TOKEN;
  const modelVersion = "70e52dbcff0149b38a2d1006427c5d35471e90010b1355220e40574fbef306fb"; // prunaai/hidream-l1-full

  try {
    // Step 1: Submit prediction job
    const submitResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${replicateToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: modelVersion,
        input: {
          prompt,
          seed: 1,
          model_type: "full",
          resolution: "1024x1024",
          speed_mode: "Juiced",
          output_format: "webp",
          output_quality: 80
        }
      }),
    });

    const prediction = await submitResponse.json();

    if (!prediction?.id) {
      throw new Error("Replicate job submission failed.");
    }

    // Step 2: Poll until it's done
    let imageUrl = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: {
          Authorization: `Token ${replicateToken}`,
          "Content-Type": "application/json",
        },
      });

      const statusData = await pollRes.json();

      if (statusData.status === "succeeded") {
        imageUrl = statusData.output?.[0];
        break;
      }

      if (statusData.status === "failed") {
        throw new Error("Image generation failed on Replicate.");
      }
    }

    if (!imageUrl) {
      throw new Error("Image generation timed out.");
    }

    return res.status(200).json({ imageUrl });
  } catch (err) {
    console.error("[Replicate Error]", err);
    return res.status(500).json({ error: "Image generation failed", details: err.message });
  }
}
