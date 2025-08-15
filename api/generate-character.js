import OpenAI from "openai";
import applyCors from "../lib/cors.js";

// WHY: Centralize client and model configuration; allow safe-mode via env flags
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL_STORY || process.env.OPENAI_MODEL || "gpt-5"; // WHY: default to gpt-5; can be overridden to gpt-4o via env
const isGpt5 = (name) => typeof name === 'string' && name.toLowerCase().includes('gpt-5');

// WHY: Feature flags for safe-mode behavior (no stream/json/tools by default)
const USE_STREAM = String(process.env.CHAR_GEN_USE_STREAM || 'false').toLowerCase() === 'true';
const USE_JSON = String(process.env.CHAR_GEN_USE_JSON || 'false').toLowerCase() === 'true';
const USE_TOOLS = String(process.env.CHAR_GEN_USE_TOOLS || 'false').toLowerCase() === 'true';
const MAX_TOKENS = Number(process.env.CHAR_GEN_MAX_TOKENS || 1000);
const DEBUG = String(process.env.DEBUG_CHAR_GEN || 'false').toLowerCase() === 'true';

// WHY: Utility helpers for reliability and diagnostics
const safeTruncate = (value, max = 2000) => {
	try {
		const str = typeof value === 'string' ? value : JSON.stringify(value);
		return str.length > max ? str.slice(0, max) + '…[truncated]' : str;
	} catch { return '[unserializable]' }
};

const wait = (ms) => new Promise(r => setTimeout(r, ms));

const withTimeout = async (promise, ms = 30000) => {
	// WHY: Avoid platform-level 502s by bounding upstream latency
	let id;
	const t = new Promise((_, rej) => { id = setTimeout(() => rej(Object.assign(new Error('timeout'), { status: 504 })), ms); });
	try { return await Promise.race([promise, t]); } finally { clearTimeout(id); }
};

export default async function handler(req, res) {
	if (applyCors(req, res)) return;
	if (req.method !== "POST") return res.status(405).json({ error: { type: 'method_not_allowed', message: "Method not allowed" } });

	// WHY: Defensive parse (body may arrive as a string)
	let body = req.body; if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }
	const { prompt } = body || {};
	if (!prompt) return res.status(400).json({ error: { type: 'missing_prompt', message: "Missing prompt" } });

	const reqId = `char_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
	if (DEBUG) console.log(`[char] start id=${reqId} model=${MODEL} flags=${JSON.stringify({ stream: USE_STREAM, json: USE_JSON, tools: USE_TOOLS })} len=${String(prompt).length} max=${MAX_TOKENS}`);

	// WHY: Build safe-mode params from flags
	const buildParams = (modelOverride) => {
		const model = modelOverride || MODEL;
		const messages = [
			{ role: 'system', content: "You are StorySeed's character writer. Return a concise plain-text description only. Do not call tools. Do not return JSON. Keep it short and friendly." }, // WHY: enforce plain text output
			{ role: 'user', content: prompt }
		];
		const params = { model, messages };
		if (isGpt5(model)) params.max_completion_tokens = MAX_TOKENS; else params.max_tokens = MAX_TOKENS;
		if (USE_JSON) params.response_format = { type: 'json_object' }; // WHY: optional JSON mode via flag
		if (USE_STREAM) params.stream = true; // WHY: optional streaming via flag
		// WHY: We do not include tools array; omitting tool_choice avoids 400 when no tools are present
		return params;
	};

	// WHY: Perform an upstream call with timeout and basic retries for 429/5xx
	const callUpstream = async (params, retries = 2) => {
		let err;
		for (let i = 0; i <= retries; i++) {
			try {
				const resp = await withTimeout(openai.chat.completions.create(params), 30000);
				if (DEBUG) console.log(`[char] upstream_ok id=${reqId} finish=${resp?.choices?.[0]?.finish_reason || 'unknown'} raw=${safeTruncate(resp?.choices?.[0]?.message)}`);
				return { ok: true, data: resp };
			} catch (e) {
				err = e;
				const status = e?.status || e?.response?.status || 0;
				if (DEBUG) console.error(`[char] upstream_err id=${reqId} status=${status} body=${safeTruncate(e?.response?.data || e?.message)}`);
				if (status === 429 || status >= 500) { if (i < retries) { await wait(500 * (i + 1)); continue; } }
				break;
			}
		}
		return { ok: false, error: err };
	};

	try {
		// First attempt: flags as configured
		let params = buildParams();
		let result = await callUpstream(params);
		if (!result.ok) {
			const code = result.error?.status || result.error?.response?.status || 500;
			const type = code === 429 ? 'rate_limit' : (code >= 500 ? 'upstream_5xx' : (code >= 400 ? 'validation' : 'unknown'));
			return res.status(code).json({ error: { type, message: result.error?.message || 'Failed to generate character.' }, model: MODEL });
		}

		let text = result.data?.choices?.[0]?.message?.content || '';
		let toolCalls = result.data?.choices?.[0]?.message?.tool_calls || null;
		text = typeof text === 'string' ? text.trim() : '';

		// WHY: If GPT-5 tries a tool-call or returns empty, retry once with strict overrides
		if ((!text || (Array.isArray(toolCalls) && toolCalls.length > 0)) && isGpt5(MODEL)) {
			if (DEBUG) console.warn(`[char] retry_plain id=${reqId} reason=${!text ? 'empty' : 'tool_call'}`);
			const p2 = buildParams();
			delete p2.response_format; delete p2.stream; // WHY: force plain text, no stream
			result = await callUpstream(p2, 1);
			if (result.ok) {
				text = result.data?.choices?.[0]?.message?.content || '';
				toolCalls = result.data?.choices?.[0]?.message?.tool_calls || null;
				text = typeof text === 'string' ? text.trim() : '';
			}
		}

		// WHY: Fallback per-request to gpt-4o if still empty
		if (!text) {
			if (DEBUG) console.warn(`[char] fallback_to_4o id=${reqId} reason=empty_or_toolonly len=${String(prompt).length}`);
			const params4o = buildParams('gpt-4o');
			delete params4o.response_format; delete params4o.stream;
			const fb = await callUpstream(params4o, 0);
			if (fb.ok) {
				const fbText = fb.data?.choices?.[0]?.message?.content || '';
				const finalText = typeof fbText === 'string' ? fbText.trim() : '';
				if (finalText) return res.status(200).json({ character: finalText, model: 'gpt-4o', fallback: true });
			}
		}

		if (!text) {
			// WHY: Return typed JSON with 200 to avoid platform/edge 502 handling on the client
			return res.status(200).json({ error: { type: 'upstream_empty', message: 'Empty response from model' }, model: MODEL });
		}

		return res.status(200).json({ character: text, model: MODEL });
	} catch (fatal) {
		if (DEBUG) console.error(`[char] fatal id=${reqId} err=${safeTruncate(fatal?.message || fatal)}`);
		return res.status(500).json({ error: { type: 'server_error', message: 'Character generation failed.' }, model: MODEL });
	}
}
