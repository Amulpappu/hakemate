// College search over the AISHE list (Government of India, All India Survey on Higher Education):
// ~70,000 colleges and universities with state and district. Runs on the server so the
// 5 MB list never reaches the phone; the browser only gets the top matches.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const SMALL = new Set(['of', 'and', 'the', 'for', 'in', 'at', 'on', 'to', 'a']);
// everyday names -> official names used in the AISHE list
const ALIAS = {
  trichy: 'tiruchirappalli', tiruchy: 'tiruchirappalli', kovai: 'coimbatore', cbe: 'coimbatore', madras: 'chennai',
  bangalore: 'bengaluru', blr: 'bengaluru', bombay: 'mumbai', calcutta: 'kolkata', pondy: 'puducherry', pondicherry: 'puducherry',
  trivandrum: 'thiruvananthapuram', cochin: 'kochi', ernakulam: 'kochi', vizag: 'visakhapatnam', tuticorin: 'thoothukkudi',
  nellai: 'tirunelveli', mysore: 'mysuru', mangalore: 'mangaluru', gurgaon: 'gurugram', engg: 'engineering', tech: 'technology',
  univ: 'university', inst: 'institute', clg: 'college', govt: 'government',
};
const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

let INDEX = null;
function index() {
  if (INDEX) return INDEX;
  const rows = require('../_data/colleges.json'); // [name, state, district]
  INDEX = rows.map(([name, state, district]) => {
    const n = norm(name);
    const words = n.split(' ');
    // initials, so "iit madras" finds "Indian Institute of Technology Madras"
    const initials = words.filter((w) => !SMALL.has(w)).map((w) => w[0]).join('');
    return { name, state, district, n, starts: ' ' + n, initials, s: norm(state), d: norm(district) };
  });
  return INDEX;
}

export function searchColleges(query, { state = '', city = '', limit = 12 } = {}) {
  const q = norm(query);
  if (q.length < 2) return [];
  const words = q.split(' ').filter((w) => w && !SMALL.has(w));
  if (!words.length) return [];
  const st = norm(state);
  const ct = norm(city);
  const out = [];
  for (const r of index()) {
    let score = 0;
    let ok = true;
    for (const w of words) {
      const a = ALIAS[w];
      if (r.starts.includes(' ' + w) || (a && r.starts.includes(' ' + a))) score += 30; // start of a word
      else if (r.n.includes(w)) score += 12;                                         // inside a word
      else if (w.length >= 2 && r.initials.startsWith(w)) score += 25;              // acronym, e.g. iit
      else if (r.d.includes(w) || r.s.includes(w) || (a && (r.d.includes(a) || r.s.includes(a)))) score += 6; // typed the place
      else { ok = false; break; }
    }
    if (!ok) continue;
    if (r.n.startsWith(q)) score += 60;
    if (st && r.s === st) score += 25;
    if (ct && r.d === ct) score += 20;
    score -= r.n.length / 25;
    out.push([score, r]);
  }
  out.sort((a, b) => b[0] - a[0]);
  return out.slice(0, Math.max(1, Math.min(limit, 25))).map(([, r]) => ({ name: r.name, state: r.state, district: r.district }));
}
