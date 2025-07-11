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
You are an assistant that extracts structured story state data from children's bedtime stories. 

Given the story, return a JSON object containing:
{
  "currentLocation": "...",
  "knownCharacters": [...],
  "importantObjects": [...],
  "moralsLearned": [...],
  "openPlotPoints": [...],
  "latestEventSummary": "..."
}

Only return valid JSON.

STORY:
${story}
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: extractionPrompt }],
      max_tokens: 500,
    });

    const result = completion.choices[0].message.content;
    const parsed = JSON.parse(result);
    res.status(200).json({ storyState: parsed });
  } catch (error) {
    console.error("Error extracting story state:", error);
    res.status(500).json({ error: "Failed to extract story state." });
  }
}
