import { Configuration, OpenAIApi } from 'openai';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { character, world } = req.body;
  if (!character || !world) {
    res.status(400).json({ error: 'Missing character or world' });
    return;
  }

  const prompt = `Given the following character and world, rate how compatible they are for a story (0-100%), and explain your reasoning in a fun, kid-friendly way.\n\nCharacter:\n${character.name || ''}, a ${character.species || ''}. Traits: ${(character.traits || []).join(', ')}. Special Ability: ${character.specialAbility || ''}.\n\nWorld:\n${world.name || ''}, a ${world.biome || world.worldStyle || ''}. Description: ${world.description || ''}\n\nRespond in this JSON format:\n{\n  "score": <number 0-100>,\n  "explanation": "<short, fun explanation>"\n}`;

  try {
    const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
    const openai = new OpenAIApi(configuration);
    const completion = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant for a children\'s story app.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.7,
    });
    // Extract JSON from response
    const text = completion.data.choices[0].message.content;
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      // Try to extract JSON from text
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        result = JSON.parse(match[0]);
      } else {
        throw new Error('Could not parse JSON from GPT response');
      }
    }
    res.status(200).json(result);
  } catch (error) {
    console.error('GPT compatibility error:', error);
    res.status(500).json({ error: 'Failed to get compatibility score', details: error.message });
  }
} 