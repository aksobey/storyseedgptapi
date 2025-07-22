import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { story } = req.body;

  if (!story) {
    return res.status(400).json({ error: "Missing story text" });
  }

  const extractionPrompt = `
You are an assistant that extracts visually interesting scene moments from children's stories.

Given the story, return a JSON array of 3 objects, each with:
  - "label": a short, catchy name for the scene (max 6 words)
  - "description": a 1-2 sentence description of the scene, suitable for illustration

Only return valid JSON.

STORY:
${story}
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: extractionPrompt }],
      max_tokens: 700,
    });

    const result = completion.choices[0].message.content;
    const parsed = JSON.parse(result);
    res.status(200).json({ moments: parsed });
  } catch (error) {
    console.error("Error extracting scene moments:", error);
    res.status(500).json({ error: "Failed to extract scene moments." });
  }
} 