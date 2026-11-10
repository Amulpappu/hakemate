// Plain-word search: turns "Need a Flutter dev free on weekends near Coimbatore"
// into filters the Discover page understands. Uses Gemini when GEMINI_API_KEY is
// set, and a fast keyword parser otherwise (or if Gemini fails / hits limits).

export const CATEGORIES = ['Frontend', 'Backend', 'AI/ML', 'Design', 'Mobile', 'Hardware/IoT', 'Cyber Security', 'Data', 'Cloud/DevOps', 'Presentation'];
export const AVAILABILITY = ['weekday_mornings', 'weekday_evenings', 'weekends', 'late_nights', 'holidays'];

const WORDS = {
  Frontend: ['frontend', 'front-end', 'react', 'next', 'html', 'css', 'javascript', 'ui dev', 'web dev', 'tailwind', 'vue', 'angular'],
  Backend: ['backend', 'back-end', 'node', 'express', 'django', 'flask', 'fastapi', 'api', 'server', 'supabase', 'firebase', 'database', 'sql', 'java', 'spring'],
  'AI/ML': ['ai', 'ml', 'machine learning', 'deep learning', 'llm', 'nlp', 'computer vision', 'model', 'tensorflow', 'pytorch', 'data scientist'],
  Design: ['design', 'designer', 'ui/ux', 'ux', 'figma', 'graphic', 'video edit', 'blender', '3d'],
  Mobile: ['mobile', 'android', 'ios', 'flutter', 'react native', 'kotlin', 'app dev'],
  'Hardware/IoT': ['iot', 'hardware', 'arduino', 'esp32', 'raspberry', 'embedded', 'sensor', 'circuit', 'pcb', 'robotics'],
  'Cyber Security': ['security', 'cyber', 'hacking', 'ctf', 'pentest', 'ethical'],
  Data: ['data analys', 'analytics', 'power bi', 'tableau', 'excel', 'dashboard'],
  'Cloud/DevOps': ['devops', 'cloud', 'aws', 'gcp', 'azure', 'docker', 'deploy', 'vercel'],
  Presentation: ['pitch', 'presentation', 'ppt', 'speaker', 'documentation', 'research', 'content'],
};
const AVAIL_WORDS = {
  weekends: ['weekend', 'saturday', 'sunday'],
  weekday_evenings: ['evening', 'after college', 'after class'],
  weekday_mornings: ['morning'],
  late_nights: ['night', 'late'],
  holidays: ['holiday', 'vacation'],
};

export function keywordParse(query) {
  const s = ` ${query.toLowerCase()} `;
  const has = (w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}`).test(s);
  const categories = CATEGORIES.filter((c) => WORDS[c].some(has));
  const availability = AVAILABILITY.find((a) => AVAIL_WORDS[a].some(has)) || '';
  const cityMatch = query.match(/\b(?:near|in|from|around|at)\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)/);
  return { categories, availability, city: cityMatch ? cityMatch[1] : '', keyword: '', source: 'keywords' };
}

export async function geminiParse(query, apiKey, model = 'gemini-2.5-flash') {
  const prompt = `You turn a student's teammate search into JSON filters for a hackathon teammate finder.
Return only JSON with keys:
"categories": array, each one of ${JSON.stringify(CATEGORIES)};
"availability": one of ${JSON.stringify(AVAILABILITY)} or "";
"city": a city name or "";
"keyword": a college or person name if one is mentioned, else "".
Search: ${JSON.stringify(query)}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
  return sanitize({ ...parsed, source: 'gemini' });
}

export function sanitize(x) {
  return {
    categories: Array.isArray(x.categories) ? x.categories.filter((c) => CATEGORIES.includes(c)) : [],
    availability: AVAILABILITY.includes(x.availability) ? x.availability : '',
    city: typeof x.city === 'string' ? x.city.slice(0, 60) : '',
    keyword: typeof x.keyword === 'string' ? x.keyword.slice(0, 60) : '',
    source: x.source,
  };
}
