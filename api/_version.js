import applyCors from "../lib/cors.js";

// WHY: Lightweight diagnostic endpoint to confirm deploy + flags
export default async function handler(req, res) {
	if (applyCors(req, res)) return;
	const commitHash = process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_HASH || null;
	const modelInUse = process.env.OPENAI_MODEL_STORY || process.env.OPENAI_MODEL || null;
	const flags = {
		CHAR_GEN_USE_STREAM: process.env.CHAR_GEN_USE_STREAM || 'false',
		CHAR_GEN_USE_JSON: process.env.CHAR_GEN_USE_JSON || 'false',
		CHAR_GEN_USE_TOOLS: process.env.CHAR_GEN_USE_TOOLS || 'false',
		CHAR_GEN_MAX_TOKENS: process.env.CHAR_GEN_MAX_TOKENS || null,
	};
	res.status(200).json({ commitHash, modelInUse, flags });
}


