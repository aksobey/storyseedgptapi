// lib/cors.js
export default function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 🔥 Critical: stop early for OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  return false;
} 