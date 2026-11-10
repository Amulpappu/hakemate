import { useState } from 'react';
import { Github, Check } from 'lucide-react';
import { analyzeGithub } from '../lib/github';

const LV = ['', 'Learning', 'Comfortable', 'Strong'];
const LANG_COLORS = ['#f26a1b', '#2e8bd8', '#6fae35', '#6b5bd6', '#e2a52f', '#d33d5e', '#12a39a', '#8d9bb0'];

// Step 1 checks the student's public repos. Step 2 asks them to confirm each skill we found.
// onSelection(Map skillId -> level) is called whenever the confirmed set changes.
export default function GithubImport({ skills, url, onUrl, onSelection, actionLabel, onAction }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [keep, setKeep] = useState(new Map());
  const [progress, setProgress] = useState(null);

  function report(next) { setKeep(next); onSelection?.(next); }

  async function check(e) {
    e?.preventDefault();
    setBusy(true); setError(''); setResult(null);
    try {
      setProgress(null);
      const r = await analyzeGithub(url, skills, { onProgress: (d, t) => setProgress(`${d} of ${t}`) });
      setResult(r);
      onUrl(r.url);
      report(new Map(r.suggestions.map((s) => [s.id, s.level])));
    } catch (err) { setError(err.message); report(new Map()); }
    finally { setBusy(false); }
  }

  const toggle = (s) => {
    const next = new Map(keep);
    if (next.has(s.id)) next.delete(s.id); else next.set(s.id, s.level);
    report(next);
  };

  return (
    <div className="gh-import">
      <div className="gh-row">
        <label className="field grow">
          <span><Github size={16} aria-hidden="true" />Your GitHub link</span>
          <input value={url} onChange={(e) => onUrl(e.target.value)} placeholder="https://github.com/yourname"
            onKeyDown={(e) => { if (e.key === 'Enter') check(e); }} />
        </label>
        <button type="button" className="btn btn-primary" onClick={check} disabled={busy || !url.trim()}>{busy ? `Reading repos${progress ? ` ${progress}` : '…'}` : 'Check my GitHub'}</button>
      </div>
      <p className="hint">We read the languages GitHub detects in your public repositories, plus their topics and descriptions. Nothing is posted to GitHub.</p>
      {error && <p className="gh-error" role="alert">{error}</p>}

      {result && (
        <div className="gh-result" aria-live="polite">
          <p className="gh-summary">
            Read <b>{result.repoCount}</b> public repo{result.repoCount === 1 ? '' : 's'}{result.partial ? ' (GitHub limited the check, so some repos only count their main language)' : ''}.
          </p>
          {result.languages.length > 0 && (
            <div className="gh-langs">
              <div className="gh-bar" role="img" aria-label={result.languages.map((l) => `${l.name} ${l.pct}%`).join(', ')}>
                {result.languages.slice(0, 8).map((l, i) => <span key={l.name} style={{ flex: l.pct, background: LANG_COLORS[i % LANG_COLORS.length] }} />)}
              </div>
              <ul className="gh-legend">
                {result.languages.slice(0, 8).map((l, i) => <li key={l.name}><i style={{ background: LANG_COLORS[i % LANG_COLORS.length] }} />{l.name} <b>{l.pct}%</b><small>{l.repos} repo{l.repos === 1 ? '' : 's'}</small></li>)}
              </ul>
            </div>
          )}
          {result.suggestions.length === 0 ? (
            <p className="muted">We couldn't spot skills from these repos. Pick them yourself on the next step.</p>
          ) : (
            <fieldset className="group">
              <legend>Are these right? Untick any skill you don't really have.</legend>
              <ul className="gh-list">
                {result.suggestions.map((s) => (
                  <li key={s.id}>
                    <label className="gh-item">
                      <input type="checkbox" checked={keep.has(s.id)} onChange={() => toggle(s)} />
                      <span>
                        <b>{s.name}</b> <small className="muted">{s.category} · {LV[s.level]}</small>
                        <small className="gh-why">{s.share >= 0.01 ? `${Math.round(s.share * 100)}% of your code · ` : ''}in {s.count} repo{s.count === 1 ? '' : 's'}: {s.repos.join(', ')}{s.count > 3 ? '…' : ''}</small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {onAction && <button type="button" className="btn btn-quiet" onClick={() => onAction(keep)} disabled={keep.size === 0}><Check size={16} aria-hidden="true" />{actionLabel || 'Use these skills'}</button>}
            </fieldset>
          )}
        </div>
      )}
    </div>
  );
}
