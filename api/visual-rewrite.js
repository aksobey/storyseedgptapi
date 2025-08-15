import OpenAI from "openai";
import applyCors from "../lib/cors.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL_MISC || process.env.OPENAI_MODEL || "gpt-4o-mini";

export default async function handler(req, res) {
	if (applyCors(req, res)) return;
	if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
	const { description } = req.body || {};
	if (!description) return res.status(400).json({ error: "Missing description" });
	try {
		const completion = await openai.chat.completions.create({
			model: MODEL,
			messages: [{ role: "user", content: `Rewrite this for a family-friendly visual prompt, avoiding text artifacts: ${description}` }],
			max_tokens: 200,
		});
		res.status(200).json({ prompt: completion.choices?.[0]?.message?.content || "", model: MODEL });
	} catch (error) {
		const code = error?.status || 500;
		const type = error?.status === 429 ? "rate_limit" : (error?.status >= 500 ? "upstream_5xx" : "unknown");
		res.status(code).json({ error: "Failed to rewrite visually.", type });
	}
} 