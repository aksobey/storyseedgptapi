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
	const hasList = allowed.length > 0;
	const isAllowed = hasList ? allowed.includes(origin) : false;

	// Vary: Origin for proper caching semantics
	res.setHeader('Vary', 'Origin');

	if (hasList) {
		if (isAllowed) {
			res.setHeader('Access-Control-Allow-Origin', origin);
		} else {
			// Temporary debug: no header to block CORS, but log origin
			console.log('[CORS] Blocked Origin:', origin, 'Allowed:', allowed);
		}
	} else {
		// Fallback: allow all if no env configured (staging/dev safety)
		res.setHeader('Access-Control-Allow-Origin', '*');
	}
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
	res.setHeader('Access-Control-Max-Age', '3600');

	// Early return for preflight
	if (req.method === 'OPTIONS') {
		return res.status(200).end();
	}

	return false;
} 