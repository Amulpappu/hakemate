// Hakemate 3.0 Node server
// - POST /api/search : plain-word teammate search (Gemini, with keyword fallback)
// - GET  /api/health : status check for your host
// - serves the built React app from ../web/dist, with SPA fallback
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geminiParse, keywordParse } from './search.js';
import { searchColleges } from '../web/api/_lib/colleges.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8787;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

app.disable('x-powered-by');
app.use(express.json({ limit: '4kb' }));
app.use((_req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY' });
  next();
});

// small per-IP rate limit so nobody burns the free Gemini quota
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 20;
}

app.get('/api/health', (_req, res) => res.json({ ok: true, ai: Boolean(GEMINI_API_KEY) }));

app.get('/api/colleges', (req, res) => {
  const q = String(req.query.q || '').slice(0, 80);
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ results: searchColleges(q, { state: String(req.query.state || '').slice(0, 60), city: String(req.query.city || '').slice(0, 60) }) });
});

app.post('/api/search', async (req, res) => {
  const query = String(req.body?.query || '').trim().slice(0, 200);
  if (!query) return res.status(400).json({ error: 'Type what kind of teammate you need' });
  if (limited(req.ip)) return res.status(429).json({ error: 'Too many searches. Wait a minute and try again' });
  if (GEMINI_API_KEY) {
    try { return res.json(await geminiParse(query, GEMINI_API_KEY, GEMINI_MODEL)); }
    catch (e) { console.warn('Gemini failed, using keyword search:', e.message); }
  }
  res.json(keywordParse(query));
});

const dist = path.resolve(__dirname, '../web/dist');
app.use(express.static(dist, { maxAge: '1h', index: false }));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(dist, 'index.html'), (err) => err && res.status(404).send('Build the web app first: cd web && npm run build'));
});

app.listen(PORT, () => console.log(`Hakemate server on http://localhost:${PORT} (AI search: ${GEMINI_API_KEY ? 'Gemini' : 'keywords'})`));
