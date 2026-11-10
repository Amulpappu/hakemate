// GET /api/colleges?q=rathinam&state=Tamil%20Nadu&city=Coimbatore -> top matching colleges
import { searchColleges } from './_lib/colleges.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Use GET' });
  }
  const q = String(req.query?.q || '').slice(0, 80);
  const state = String(req.query?.state || '').slice(0, 60);
  const city = String(req.query?.city || '').slice(0, 60);
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return res.status(200).json({ results: searchColleges(q, { state, city }) });
}
