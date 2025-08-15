// lib/cors.js

const parseOrigins = (envValue) => {
	if (!envValue || typeof envValue !== 'string') return [];
	return envValue
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
};

export default function applyCors(req, res) {
	const origin = req.headers.origin || '';
	const allowed = parseOrigins(process.env.CORS_ORIGINS);
	const isAllowed = allowed.length === 0 ? false : allowed.includes(origin);

	// Vary: Origin for proper caching semantics
	res.setHeader('Vary', 'Origin');

	if (isAllowed) {
		res.setHeader('Access-Control-Allow-Origin', origin);
	} else {
		// Do not reflect arbitrary origins; omit header if not allowed
	}
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
	res.setHeader('Access-Control-Max-Age', '3600');

	// Early return for preflight
	if (req.method === 'OPTIONS') {
		return res.status(200).end();
	}

	return false;
} 