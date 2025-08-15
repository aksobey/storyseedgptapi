import OpenAI from "openai";
import applyCors from "../lib/cors";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL_STORY || process.env.OPENAI_MODEL || "gpt-4o";

export default async function handler(req, res) {
	if (applyCors(req, res)) return;
	if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

	const { prompt } = req.body || {};
	if (!prompt) return res.status(400).json({ error: "Missing prompt" });

	try {
		const completion = await openai.chat.completions.create({
			model: MODEL,
			messages: [{ role: "user", content: prompt }],
			max_tokens: 800,
		});
		res.status(200).json({ character: completion.choices?.[0]?.message?.content || "", model: MODEL });
	} catch (error) {
		const code = error?.status || 500;
		const type = error?.status === 429 ? "rate_limit" : (error?.status >= 500 ? "upstream_5xx" : "unknown");
		res.status(code).json({ error: "Failed to generate character.", type });
	}
}
