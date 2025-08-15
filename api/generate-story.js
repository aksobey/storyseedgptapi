import OpenAI from "openai";
import applyCors from "../lib/cors.js";

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL_STORY || process.env.OPENAI_MODEL || "gpt-4o";
const isGpt5 = (name) => typeof name === 'string' && name.toLowerCase().includes('gpt-5');

export default async function handler(req, res) {
	// CORS
	if (applyCors(req, res)) return;

	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	// Defensive parse in case body comes through as string
	let body = req.body;
	if (typeof body === "string") {
		try { body = JSON.parse(body); } catch {}
	}
	const prompt = body?.prompt;
	if (!prompt || typeof prompt !== 'string') {
		return res.status(400).json({ error: "Missing prompt" });
	}

	try {
		const params = {
			model: MODEL,
			messages: [{ role: "user", content: prompt }],
		};
		if (isGpt5(MODEL)) {
			params.max_completion_tokens = 1200;
		} else {
			params.max_tokens = 1200;
		}

		const completion = await openai.chat.completions.create(params);

		const storyResult = completion.choices?.[0]?.message?.content || "";
		res.status(200).json({ story: storyResult, model: MODEL });
	} catch (error) {
		console.error("[generate-story] error:", error);
		const code = error?.status || 500;
		const type = error?.status === 429 ? "rate_limit" : (error?.status >= 500 ? "upstream_5xx" : (error?.status >= 400 ? "validation" : "unknown"));
		const detail = error?.error?.message || error?.message || null;
		res.status(code).json({ error: "Failed to generate story.", type, detail, model: MODEL });
	}
}
