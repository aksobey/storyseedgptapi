import OpenAI from "openai";
import applyCors from "../lib/cors.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL_STORY || process.env.OPENAI_MODEL || "gpt-4o";
const isGpt5 = (name) => typeof name === 'string' && name.toLowerCase().includes('gpt-5');

// WHY: Ensure we never leak raw message objects to clients
function normalizeCompletion(resp) {
	try {
		const choice = resp?.choices?.[0];
		const msg = choice?.message;
		let text = '';
		if (typeof msg?.content === 'string') {
			text = msg.content;
		} else if (Array.isArray(msg?.content)) {
			text = msg.content.map(p => (typeof p?.text === 'string' ? p.text : '')).join('');
		}
		text = typeof text === 'string' ? text.trim() : '';
		const meta = {
			finish_reason: choice?.finish_reason || null,
			prompt_tokens: resp?.usage?.prompt_tokens ?? null,
			completion_tokens: resp?.usage?.completion_tokens ?? null,
		};
		return { text, meta };
	} catch {
		return { text: '', meta: {} };
	}
}

export default async function handler(req, res) {
	if (applyCors(req, res)) return;
	if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

	let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }
	const { prompt } = body || {};

	// WHY: Dry-run path to verify routing without calling OpenAI
	if (req.query && String(req.query.dry_run) === '1') {
		return res.status(200).json({ ok: true, route: 'generate-character' });
	}
	if (!prompt) return res.status(400).json({ error: "Missing prompt" });

	try {
		const messages = [
			// WHY: Nudge headings for robust client parsing; keep plain text
			{ role: 'system', content: "You are StorySeed's character writer. Return plain text, no JSON. Use these labeled lines exactly, each on its own line: Name: … ; Gender: … ; Species: … ; Visual Traits: … ; Clothing and Accessories: … ; Color Palette: … ; Special Features: … ; Art Style: … . Then a Backstory: section of 2–4 sentences. Keep it kid-friendly and concise." },
			{ role: 'user', content: prompt }
		];
		const params = { model: MODEL, messages };
		if (isGpt5(MODEL)) params.max_completion_tokens = 800; else params.max_tokens = 800;

		// WHY: Pre-platform timeout to avoid Vercel hard timeouts
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 28000);
		let completion;
		try {
			completion = await openai.chat.completions.create({ ...params, signal: controller.signal });
		} finally {
			clearTimeout(timeoutId);
		}
		const { text, meta } = normalizeCompletion(completion);
		if (!text) {
			return res.status(502).json({ error: 'Empty response from model', type: 'upstream_empty', model: MODEL });
		}
		// WHY: Return normalized string while preserving legacy field for clients
		res.status(200).json({ ok: true, model: MODEL, text, character: text, meta });
	} catch (error) {
		const code = error?.status || 500;
		const type = error?.status === 429 ? "rate_limit" : (error?.status >= 500 ? "upstream_5xx" : (error?.status >= 400 ? "validation" : "unknown"));
		res.status(code).json({ error: "Failed to generate character.", type, detail: error?.message, model: MODEL });
	}
}
