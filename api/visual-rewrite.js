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

  const { description } = req.body;

  if (!description) {
    return res.status(400).json({ error: "Missing description" });
  }

  const prompt = `Rewrite the following as a purely visual, present-tense scene description for an illustrator. Do not mention or imply any text, writing, labels, captions, or book pages. Focus only on what should be seen, not read. Use a cinematic, child-friendly, colorful style.\n\nDescription: ${description}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
    });

    const result = completion.choices[0].message.content;
    res.status(200).json({ visualDescription: result.trim() });
  } catch (error) {
    console.error("Error in visual-rewrite:", error);
    res.status(500).json({ error: "Failed to rewrite description." });
  }
} 