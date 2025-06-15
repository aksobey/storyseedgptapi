import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // CORS headers patch (same as we've done before)
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

  const { name, species, gender, aesthetic } = req.body;

  if (!aesthetic) {
    return res.status(400).json({ error: "Missing character aesthetic" });
  }

  const imagePrompt = `
  Create a children's book style illustration of the following character:

  Name: ${name || "Unnamed"}
  Species: ${species}
  Gender: ${gender}
  Appearance Details: ${aesthetic}

  The illustration should be colorful, friendly, child-safe, cute, highly illustrative, and suitable for kids aged 4-10.
  Use a centered portrait style on a neutral background.
  `;

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imageUrl = response.data.data[0].url;
    return res.status(200).json({ imageUrl });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Image generation failed" });
  }
}
