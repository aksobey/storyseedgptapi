import OpenAI from "openai";
import applyCors from "../lib/cors.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL_MISC || process.env.OPENAI_MODEL || "gpt-4o-mini";

export default async function handler(req, res) {
	if (applyCors(req, res)) return;
	if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
	const { story } = req.body || {};
	if (!story) return res.status(400).json({ error: "Missing story" });
	try {
		const completion = await openai.chat.completions.create({
			model: MODEL,
			messages: [{ role: "user", content: `Extract 3-5 key scene moments as a JSON array with {label, description}.\n\nStory:\n${story}` }],
			max_tokens: 400,
		});
		const content = completion.choices?.[0]?.message?.content || "[]";
		let moments = [];
		try { moments = JSON.parse(content); } catch {}
		res.status(200).json({ moments, model: MODEL });
	} catch (error) {
		const code = error?.status || 500;
		const type = error?.status === 429 ? "rate_limit" : (error?.status >= 500 ? "upstream_5xx" : "unknown");
		res.status(code).json({ error: "Failed to extract scene moments.", type });
	}
} 