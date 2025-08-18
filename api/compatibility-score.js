import OpenAI from "openai";
import applyCors from "../lib/cors.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL_MISC || process.env.OPENAI_MODEL || "gpt-4o";

export default async function handler(req, res) {
	if (applyCors(req, res)) return;
	if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
	// Defensive parse in case body is a string
	let body = req.body;
	if (typeof body === 'string') {
		try { body = JSON.parse(body); } catch {}
	}
	const { character, world } = body || {};
	if (!character || !world) return res.status(400).json({ error: "Missing character or world" });
	if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
	try {
		const completion = await openai.chat.completions.create({
			model: MODEL,
			messages: [{ role: "user", content: `Score (0-100) and explain (2 sentences) compatibility between character and world. Return JSON {score, explanation}.\n\nCharacter: ${JSON.stringify(character)}\nWorld: ${JSON.stringify(world)}` }],
			max_tokens: 250,
			temperature: 0.2,
		});
		let score = 0; let explanation = "";
		try { ({ score, explanation } = JSON.parse(completion.choices?.[0]?.message?.content || '{}')); } catch {}
		res.status(200).json({ score, explanation, model: MODEL });
	} catch (error) {
		const code = error?.status || 500;
		const type = error?.status === 429 ? "rate_limit" : (error?.status >= 500 ? "upstream_5xx" : (error?.status >= 400 ? 'validation' : 'unknown'));
		const detail = error?.error?.message || error?.message || null;
		res.status(code).json({ error: "Failed to score compatibility.", type, detail, model: MODEL });
	}
}