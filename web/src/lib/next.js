// Remember where a signed-out visitor was going (e.g. from an ACE event link),
// so they land there after Google sign-in and profile setup.
const KEY = 'hm_next';
const safe = (p) => typeof p === 'string' && p.startsWith('/') && !p.startsWith('//');

export function rememberNext(path) {
  try { if (safe(path) && path !== '/') sessionStorage.setItem(KEY, path); } catch { /* storage off */ }
}

export function takeNext(fallback = '/home') {
  try {
    const p = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return safe(p) ? p : fallback;
  } catch { return fallback; }
}
