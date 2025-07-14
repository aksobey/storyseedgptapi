import { Configuration, OpenAIApi } from 'openai';

export default async function handler(req, res) {
  // ✅ CORS headers (safe + simple)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { character, world } = req.body;
  if (!character || !world) {
    return res.status(400).json({ error: 'Missing character or world' });
  }

  const prompt = `Given the following character and world, rate how compatible they are for a story (0-100%), and explain your reasoning in a fun, kid-friendly way.

Character:
${character.name || ''}, a ${character.species || ''}. Traits: ${(character.traits || []).join(', ')}. Special Ability: ${character.specialAbility || ''}.

World:
${world.name || ''}, a ${world.biome || world.worldStyle || ''}. Description: ${world.description || ''}

Respond in this JSON format:
{
  "score": <number 0-100>,
  "explanation": "<short, fun explanation>"
}`;

  try {
    const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
    const openai = new OpenAIApi(configuration);
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: "You are a helpful assistant for a children's story app." },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.7
    });

    const text = completion.data.choices[0].message.content;
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
