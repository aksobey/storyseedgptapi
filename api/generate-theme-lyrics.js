import OpenAI from "openai";
import applyCors from "../lib/cors.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL_MISC || process.env.OPENAI_MODEL_STORY || process.env.OPENAI_MODEL || "gpt-4o";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch {}
  }

  const { character = {}, tone = '', world = '', durationSeconds = 12 } = body || {};

  try {
    const dur = Math.max(8, Math.min(20, Number(durationSeconds) || 12));
    const lines = dur <= 11 ? 1 : (dur <= 13 ? 1 : 2); // 10–11s: 1 line; 12–13s still 1; 14–15s: 2
    const wordsPerLine = dur <= 11 ? '5-8' : '5-7';
    const maxSyllables = dur <= 11 ? 18 : 28;

    const species = character?.species || '';
    const role = character?.role || '';
    const traits = Array.isArray(character?.traits) ? character.traits.join(', ') : (character?.personality || '');
    const name = character?.name || '';

    const userPrompt = `Write ${lines === 1 ? 'ONE' : 'TWO'} ultra-short, family-friendly lyric line${lines === 1 ? '' : 's'} for a child-safe character theme.
Character: ${species || role || 'character'}; traits: ${traits || 'friendly'}; tone: ${tone || 'whimsical'}; world vibe: ${world || 'storybook'}.
Constraints: ${lines === 1 ? 'ONE line only' : 'TWO lines only'}, ${wordsPerLine} words per line, <= ${maxSyllables} syllables per line, simple vocabulary, chantable, no tongue-twisters.
Safety: no brands, politics, violence, medical, or mature topics. No personal data. Avoid hard-to-sing proper names${name ? ` (if you include a name, prefer an easy nickname or omit).` : '.'}
Formatting: output ONLY the line${lines === 1 ? '' : 's'} with newline separation. No quotes, no punctuation except commas, no emojis.`;

    const params = {
      model: MODEL,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 80,
    };

    const completion = await openai.chat.completions.create(params);
    const text = completion.choices?.[0]?.message?.content?.trim() || '';
    if (!text) return res.status(200).json({ lyrics: '', lines, durationSeconds: dur, model: MODEL });
    const normalized = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, lines).join('\n');
    return res.status(200).json({ lyrics: normalized, lines, durationSeconds: dur, model: MODEL });
  } catch (error) {
    console.error('[generate-theme-lyrics] error:', error);
    const code = error?.status || 500;
    return res.status(code).json({ error: 'Failed to generate lyrics', detail: error?.message || null });
  }
}


