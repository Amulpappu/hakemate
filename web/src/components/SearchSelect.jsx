import { useEffect, useId, useRef, useState } from 'react';
import { Search, Check } from 'lucide-react';

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Type-to-search box. Matches show in a list; pick one with mouse or keyboard.
// If nothing fits, the student can keep what they typed ("Use “...”").
// Give `options` (array of strings) for a local list, or `load(query)` -> Promise<[{ value, meta, extra }]> for a server search.
export default function SearchSelect({ label, value, onChange, onPick, options, load, placeholder = 'Start typing to search', hint, required, disabled, className = '', minChars = 1, allowCustom = true }) {
  const id = useId();
  const [text, setText] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const wrap = useRef(null);
  const seq = useRef(0);

  useEffect(() => { setText(value || ''); }, [value]);

  // close when clicking outside
  useEffect(() => {
    const onDoc = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // find matches as the student types
  useEffect(() => {
    if (!open) return;
    const q = norm(text);
    if (options) {
      const words = q.split(' ').filter(Boolean);
      const list = options
        .map((o) => { const n = norm(o); return [n.startsWith(q) ? 2 : words.every((w) => n.includes(w)) ? 1 : 0, o]; })
        .filter(([s]) => !q || s > 0)
        .sort((a, b) => b[0] - a[0])
        .slice(0, 40)
        .map(([, o]) => ({ value: o }));
      setItems(list); setActive(list.length ? 0 : -1);
      return;
    }
    if (q.length < minChars) { setItems([]); return; }
    const my = ++seq.current;
    setBusy(true);
    const t = setTimeout(() => {
      load(text).then((list) => { if (my === seq.current) { setItems(list); setActive(list.length ? 0 : -1); } })
        .catch(() => { if (my === seq.current) setItems([]); })
        .finally(() => { if (my === seq.current) setBusy(false); });
    }, 220);
    return () => clearTimeout(t);
  }, [text, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const exact = items.some((i) => norm(i.value) === norm(text));
  const showCustom = allowCustom && text.trim().length > 1 && !exact;
  const total = items.length + (showCustom ? 1 : 0);

  function choose(i) {
    if (i < items.length) {
      const it = items[i];
      setText(it.value); onChange(it.value); onPick?.(it);
    } else if (showCustom) {
      onChange(text.trim());
    }
    setOpen(false);
  }

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(total - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && open && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div className={`field search-select ${className}`} ref={wrap}>
      <label htmlFor={id}><span>{label}</span></label>
      <div className="ss-box">
        <Search size={16} aria-hidden="true" className="ss-icon" />
        <input id={id} role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
          value={text} disabled={disabled} required={required} placeholder={placeholder} autoComplete="off"
          onChange={(e) => { setText(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }}
          onFocus={() => setOpen(true)} onKeyDown={onKey}
          onBlur={() => {
            if (text.trim() === (value || '')) return;
            if (allowCustom) onChange(text.trim());
            else { const hit = (options || []).find((o) => norm(o) === norm(text)); if (hit) { setText(hit); onChange(hit); } else setText(value || ''); }
          }} />
        {value && norm(value) === norm(text) && <Check size={16} className="ss-ok" aria-label="Selected" />}
      </div>
      {hint && <small>{hint}</small>}
      {open && (busy || total > 0 || norm(text).length >= minChars) && (
        <ul className="ss-list" id={`${id}-list`} role="listbox">
          {busy && items.length === 0 && <li className="ss-note">Searching…</li>}
          {items.map((it, i) => (
            <li key={it.value + (it.meta || '') + i} id={`${id}-${i}`} role="option" aria-selected={i === active}
              className={i === active ? 'on' : ''} onMouseDown={(e) => { e.preventDefault(); choose(i); }} onMouseEnter={() => setActive(i)}>
              <b>{it.value}</b>{it.meta && <small>{it.meta}</small>}
            </li>
          ))}
          {showCustom && (
            <li id={`${id}-${items.length}`} role="option" aria-selected={active === items.length} className={`ss-custom ${active === items.length ? 'on' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); choose(items.length); }} onMouseEnter={() => setActive(items.length)}>
              Use “{text.trim()}”{items.length === 0 ? ' (not in the list)' : ''}
            </li>
          )}
          {!busy && total === 0 && <li className="ss-note">No matches. Keep typing.</li>}
        </ul>
      )}
    </div>
  );
}
