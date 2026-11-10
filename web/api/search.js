// Vercel serverless version of the Node server's /api/search.
// Turns "Need a Flutter dev free on weekends near Coimbatore" into filters.
// Uses Gemini when GEMINI_API_KEY is set in Vercel, keyword parsing otherwise.
import { geminiParse, keywordParse } from './_lib/search.js';

const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 20;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST' });
  }
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const query = String(body.query || '').trim().slice(0, 200);
  if (!query) return res.status(400).json({ error: 'Type what kind of teammate you need' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return res.status(429).json({ error: 'Too many searches. Wait a minute and try again' });

  const key = process.env.GEMINI_API_KEY;
  if (key) {
    try { return res.status(200).json(await geminiParse(query, key, process.env.GEMINI_MODEL || 'gemini-2.5-flash')); }
    catch (e) { console.warn('Gemini failed, using keyword search:', e.message); }
  }
  return res.status(200).json(keywordParse(query));
}
