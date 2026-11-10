// Reads a student's public GitHub repos (in their own browser, no login needed) and suggests
// Hakemate skills from the languages GitHub detects in each repo, plus repo topics and descriptions.
// When "Sign in with GitHub" is added, pass the user's token to analyzeGithub for higher limits.

// GitHub language -> Hakemate skills
const LANGUAGE_SKILLS = {
  JavaScript: ['JavaScript'], TypeScript: ['TypeScript', 'JavaScript'], HTML: ['HTML/CSS'], CSS: ['HTML/CSS'], SCSS: ['HTML/CSS'],
  Less: ['HTML/CSS'], Vue: ['Vue', 'JavaScript'], Svelte: ['JavaScript'], Astro: ['JavaScript'],
  Python: ['Python'], 'Jupyter Notebook': ['Python', 'Data Analysis'], Java: ['Java/Spring'], Kotlin: ['Android (Kotlin)'],
  Dart: ['Flutter'], Swift: ['Swift (iOS)'], 'Objective-C': ['Swift (iOS)'], C: ['C/C++'], 'C++': ['C/C++'], 'C#': ['C#/.NET'],
  Go: ['Go'], Rust: ['Rust'], PHP: ['PHP'], Ruby: ['Ruby'], R: ['R'], MATLAB: ['MATLAB'], Solidity: ['Solidity'],
  Shell: ['Bash/Shell'], PowerShell: ['Bash/Shell'], Dockerfile: ['Docker'], HCL: ['AWS/GCP/Azure'],
  PLpgSQL: ['SQL/PostgreSQL'], TSQL: ['SQL/PostgreSQL'], 'Arduino': ['Arduino', 'Embedded C'], VHDL: ['PCB/Circuit Design'], Verilog: ['PCB/Circuit Design'],
};
// Small helper languages that show up in many repos; only count them when they are a real share of the code
const NOISY = new Set(['Shell', 'PowerShell', 'Batchfile', 'Makefile', 'CMake', 'Dockerfile', 'Procfile', 'HCL', 'Nix']);

// [pattern, skills]; matched against repo name + description + topics
const KEYWORD_SKILLS = [
  [/\breact(js)?\b(?![- ]?native)/, ['React']], [/\bnext\.?js\b|\bnextjs\b/, ['Next.js', 'React']], [/tailwind/, ['Tailwind CSS']],
  [/\bangular\b/, ['Angular']], [/\bvue(js)?\b|nuxt/, ['Vue']],
  [/\bnode(js)?\b|\bnode\.js\b/, ['Node.js']], [/\bexpress(js)?\b/, ['Express', 'Node.js']], [/django/, ['Django']],
  [/flask|fastapi/, ['Flask/FastAPI']], [/spring[- ]?boot|\bspring\b/, ['Java/Spring']], [/supabase/, ['Supabase']],
  [/firebase/, ['Firebase']], [/mongo/, ['MongoDB']], [/postgres|\bsql\b|mysql|sqlite/, ['SQL/PostgreSQL']],
  [/tensorflow|pytorch|\bkeras\b|\btorch\b/, ['TensorFlow/PyTorch', 'Machine Learning']],
  [/machine[- ]?learning|\bml\b|sklearn|scikit/, ['Machine Learning']], [/deep[- ]?learning|neural|\bcnn\b|\blstm\b/, ['Deep Learning']],
  [/opencv|computer[- ]?vision|\byolo\b|object[- ]?detection|gesture|\bface\b|mediapipe/, ['Computer Vision']],
  [/\bnlp\b|\bllms?\b|\bgpt\b|gemini|chatbot|langchain|\brag\b|openai|\bbot\b/, ['NLP/LLMs']], [/prompt/, ['Prompt Engineering']],
  [/flutter/, ['Flutter']], [/react[- ]?native|\bexpo\b/, ['React Native']], [/android/, ['Android (Kotlin)']],
  [/arduino/, ['Arduino', 'Embedded C']], [/esp32|esp8266|nodemcu/, ['ESP32', 'Embedded C']], [/raspberry|\brpi\b/, ['Raspberry Pi']],
  [/\biot\b|embedded|sensor|microcontroller/, ['Embedded C']],
  [/\bctf\b|pentest|hacking|exploit|\bvuln|malware|forensic/, ['Ethical Hacking', 'CTF']],
  [/web[- ]?security|\bxss\b|owasp|sql[- ]?injection/, ['Web Security']], [/nmap|wireshark|network[- ]?security|firewall|\bids\b/, ['Network Security']],
  [/cyber|security/, ['Ethical Hacking']], [/figma|ui[- /]?ux/, ['UI/UX Design', 'Figma']], [/blender|\b3d\b/, ['3D/Blender']],
  [/docker|kubernetes|\bk8s\b/, ['Docker']], [/\baws\b|\bgcp\b|azure|cloud/, ['AWS/GCP/Azure']], [/vercel|netlify/, ['Vercel/Netlify']],
  [/power[- ]?bi|tableau/, ['Power BI/Tableau']], [/pandas|data[- ]?analysis|analytics|\beda\b/, ['Data Analysis']],
  [/blockchain|web3|ethereum|smart[- ]?contract/, ['Solidity']], [/portfolio|landing[- ]?page|website/, ['HTML/CSS']],
];
const HARDWARE = /arduino|esp32|esp8266|iot|embedded|sensor|microcontroller|robot/;

export function parseGithubUser(input) {
  const s = String(input || '').trim().replace(/\/+$/, '');
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})(?:[/?#].*)?$/i) || s.match(/^@?([A-Za-z0-9-]{1,39})$/);
  return m ? m[1] : null;
}

// Pure part, easy to test.
// repos: GitHub API repo objects; langs: { repoName: { Language: bytes } } (missing repos fall back to the main language)
export function suggestSkills(repos, allSkills, langs = {}) {
  const own = repos.filter((r) => !r.fork && !r.archived);
  const byName = Object.fromEntries(allSkills.map((s) => [s.name, s]));
  const hits = {};        // skill -> Set(repo)
  const bytes = {};       // language -> total bytes across repos
  const langRepos = {};   // language -> repo count

  for (const r of own) {
    const text = [r.name.replace(/[-_]/g, ' '), r.description || '', ...(r.topics || [])].join(' ').toLowerCase();
    const found = new Set();
    let mix = langs[r.name];
    if (!mix || !Object.keys(mix).length) mix = r.language ? { [r.language]: 1 } : {};
    const total = Object.values(mix).reduce((a, b) => a + b, 0) || 1;
    for (const [lang, b] of Object.entries(mix)) {
      const share = b / total;
      if (share < 0.03 || (NOISY.has(lang) && share < 0.25)) continue; // ignore tiny bits of a language
      bytes[lang] = (bytes[lang] || 0) + b;
      langRepos[lang] = (langRepos[lang] || 0) + 1;
      (LANGUAGE_SKILLS[lang] || []).forEach((s) => found.add(s));
      if ((lang === 'C' || lang === 'C++') && HARDWARE.test(text)) found.add('Embedded C');
    }
    for (const [re, skills] of KEYWORD_SKILLS) if (re.test(text)) skills.forEach((s) => found.add(s));
    if (/vercel\.app|netlify\.app/.test(r.homepage || '')) found.add('Vercel/Netlify');
    found.forEach((s) => { (hits[s] ||= new Set()).add(r.name); });
  }
  if (own.length) hits['Git/GitHub'] = new Set(own.map((r) => r.name));

  const allBytes = Object.values(bytes).reduce((a, b) => a + b, 0) || 1;
  const languages = Object.entries(bytes)
    .map(([name, b]) => ({ name, pct: Math.round((100 * b) / allBytes), repos: langRepos[name] }))
    .filter((l) => l.pct >= 1)
    .sort((a, b) => b.pct - a.pct);

  // level: how many repos use it, or how much of all their code it is
  const shareOf = (skill) => Math.max(0, ...Object.entries(LANGUAGE_SKILLS).filter(([, s]) => s.includes(skill)).map(([l]) => (bytes[l] || 0) / allBytes));
  const suggestions = Object.entries(hits)
    .filter(([name]) => byName[name])
    .map(([name, set]) => {
      const n = set.size;
      const share = shareOf(name);
      const level = name === 'Git/GitHub' ? (n >= 5 ? 2 : 1) : n >= 4 || share >= 0.3 ? 3 : n >= 2 || share >= 0.1 ? 2 : 1;
      return { id: byName[name].id, name, category: byName[name].category, level, repos: [...set].slice(0, 3), count: n, share };
    })
    .sort((a, b) => b.level - a.level || b.count - a.count || a.name.localeCompare(b.name));

  return { repoCount: own.length, languages, suggestions };
}

async function gh(path, token) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  return res;
}

// Checks up to `maxRepos` most recently updated repos for their full language mix.
export async function analyzeGithub(input, allSkills, { token, maxRepos = 20, onProgress } = {}) {
  const user = parseGithubUser(input);
  if (!user) throw new Error('That does not look like a GitHub link. Use https://github.com/yourname');
  const res = await gh(`/users/${user}/repos?per_page=100&sort=pushed&type=owner`, token);
  if (res.status === 404) throw new Error(`No GitHub account called "${user}"`);
  if (res.status === 403 || res.status === 429) throw new Error('GitHub is limiting checks from this network right now. Try again later, or pick your skills yourself');
  if (!res.ok) throw new Error('Could not reach GitHub. Pick your skills yourself for now');
  const repos = await res.json();

  const own = repos.filter((r) => !r.fork && !r.archived).slice(0, maxRepos);
  const langs = {};
  let limited = false;
  let done = 0;
  // 4 at a time; if GitHub starts limiting, stop and use each repo's main language instead
  for (let i = 0; i < own.length && !limited; i += 4) {
    await Promise.all(own.slice(i, i + 4).map(async (r) => {
      try {
        const lr = await gh(`/repos/${user}/${encodeURIComponent(r.name)}/languages`, token);
        if (lr.status === 403 || lr.status === 429) { limited = true; return; }
        if (lr.ok) langs[r.name] = await lr.json();
      } catch { /* keep the main language */ }
      onProgress?.(++done, own.length);
    }));
  }
  return { user, url: `https://github.com/${user}`, partial: limited, checked: Object.keys(langs).length, ...suggestSkills(repos, allSkills, langs) };
}
