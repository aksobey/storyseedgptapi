import OpenAI from 'openai';

export default async function handler(req, res) {
  // CORS headers force reupload
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Vercel: parse JSON body if needed
  if (req.method === 'POST' && req.headers['content-type'] === 'application/json' && typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { character, world } = req.body;
  if (!character || !world) {
    return res.status(400).json({ error: 'Missing character or world' });
  }

  // Improved, more critical prompt
  const prompt = `Given the following character and world, rate how compatible they are for a story (0-100%), and explain your reasoning in a fun, kid-friendly way.

Be critical! If the character and world are a bad match (e.g., a mermaid in a desert, a dragon in the ocean, a robot in a magical forest), give a low score (10-40%) and explain why. Only give high scores (70%+) for truly great matches. Use the world biome and worldStyle fields, not just the description.

Character:
Name: ${character.name || ''}
Species: ${character.species || ''}
Traits: ${(character.traits || []).join(', ')}
Special Ability: ${character.specialAbility || ''}

World:
Name: ${world.name || ''}
Biome: ${world.biome || ''}
World Style: ${world.worldStyle || ''}
Description: ${world.description || ''}

Respond in this JSON format:
{
  "score": <number 0-100>,
  "explanation": "<short, fun explanation>"
}`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: "You are a helpful assistant for a children's story app." },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.7
    });

    const text = completion.choices[0].message.content;
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      result = match ? JSON.parse(match[0]) : { score: 50, explanation: 'Could not parse GPT response, using fallback.' };
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Compatibility error:', error);
    res.status(500).json({ error: 'Failed to get compatibility score', details: error.message });
  }
}