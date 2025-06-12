import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a children's story generator. Write whimsical, age-appropriate short stories based on the prompt provided." },
        { role: "user", content: prompt }
      ],
      max_tokens: 1000,
      temperature: 0.8
    });

    const story = completion.choices[0].message.content.trim();
    res.status(200).json({ story });
  } catch (error) {
    console.error("Error generating story:", error);
    res.status(500).json({ error: "Story generation failed." });
  }
}
