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
  "currentLocation": "Where is the story taking place? Include world/setting details (time, mood, weather, etc.)",
  "knownCharacters": [
    {
      "name": "...",
      "currentState": "...",
      "goal": "...",
      "relationships": "..."
    }
  ],
  "importantObjects": [
    {
      "name": "...",
      "description": "...",
      "possessedBy": "..."
    }
  ],
  "moralsLearned": ["..."],
  "openPlotPoints": ["List unresolved mysteries, quests, or conflicts"],
  "latestEventSummary": "A 1-2 sentence summary of the most recent events.",
  "tone": "Overall tone/style of the story"
}

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
    res.status(200).json({ storyState: parsed });
  } catch (error) {
    console.error("Error extracting story state:", error);
    res.status(500).json({ error: "Failed to extract story state." });
  }
}
