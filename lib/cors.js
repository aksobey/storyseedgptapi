// lib/cors.js
export default function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Short-circuit OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true; // CORS handled
  }

  return false; // Continue to normal logic
} 