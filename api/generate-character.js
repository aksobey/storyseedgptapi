import OpenAI from "openai";
import applyCors from "../lib/cors.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL_STORY || process.env.OPENAI_MODEL || "gpt-4o";
const isGpt5 = (name) => typeof name === 'string' && name.toLowerCase().includes('gpt-5');

export default async function handler(req, res) {
	if (applyCors(req, res)) return;
	if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

	let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }
	const { prompt } = body || {};
	if (!prompt) return res.status(400).json({ error: "Missing prompt" });

	try {
		const messages = [
			{ role: 'system', content: 'You are StorySeed\'s character writer. Reply with plain text only (no JSON, no code blocks). Keep it short and friendly.' },
			{ role: 'user', content: prompt }
		];
		// No tools are provided; omit tool_choice to satisfy stricter validation on newer models
		const params = { model: MODEL, messages };
		if (isGpt5(MODEL)) params.max_completion_tokens = 800; else params.max_tokens = 800;

		const completion = await openai.chat.completions.create(params);
		let text = completion.choices?.[0]?.message?.content;
		if (typeof text !== 'string') text = '';
		text = text.trim();

		// If empty content but tool calls were attempted, surface a clear error
		if (!text) {
			const toolCalls = completion.choices?.[0]?.message?.tool_calls || null;
			if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
				return res.status(502).json({ error: 'Model attempted a tool call instead of text.', type: 'tool_call', model: MODEL });
			}
		}

		if (!text) {
			return res.status(502).json({ error: 'Empty response from model', type: 'upstream_empty', model: MODEL });
		}

		res.status(200).json({ character: text, model: MODEL });
	} catch (error) {
		const code = error?.status || 500;
		const type = error?.status === 429 ? "rate_limit" : (error?.status >= 500 ? "upstream_5xx" : (error?.status >= 400 ? "validation" : "unknown"));
		res.status(code).json({ error: "Failed to generate character.", type, detail: error?.message, model: MODEL });
	}
}
