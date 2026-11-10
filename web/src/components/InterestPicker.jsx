import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { INTEREST_GROUPS, ALL_INTERESTS } from '../lib/options';

// Interest chips by group, plus "Other" to type your own.
export default function InterestPicker({ value, onChange }) {
  const [other, setOther] = useState('');
  const custom = value.filter((v) => !ALL_INTERESTS.includes(v));
  const toggle = (i) => onChange(value.includes(i) ? value.filter((x) => x !== i) : [...value, i]);

  function addOther(e) {
    e?.preventDefault();
    const t = other.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (!t) return;
    const existing = ALL_INTERESTS.find((x) => x.toLowerCase() === t.toLowerCase());
    const v = existing || t;
    if (!value.some((x) => x.toLowerCase() === v.toLowerCase()) && value.length < 12) onChange([...value, v]);
    setOther('');
  }

  return (
    <div className="interest-picker">
      {INTEREST_GROUPS.map((g) => (
        <fieldset key={g.group} className="skill-group">
          <legend>{g.group}</legend>
          <div className="pills">{g.items.map((i) => <button type="button" key={i} className="pill" aria-pressed={value.includes(i)} onClick={() => toggle(i)}>{i}</button>)}</div>
        </fieldset>
      ))}
      <fieldset className="skill-group">
        <legend>Other</legend>
        {custom.length > 0 && (
          <div className="pills custom-pills">
            {custom.map((c) => (
              <button type="button" key={c} className="pill" aria-pressed="true" onClick={() => toggle(c)} aria-label={`Remove ${c}`}>{c}<X size={14} aria-hidden="true" /></button>
            ))}
          </div>
        )}
        <div className="other-row">
          <label className="sr-only" htmlFor="other-interest">Type another interest</label>
          <input id="other-interest" value={other} onChange={(e) => setOther(e.target.value)} maxLength={30}
            onKeyDown={(e) => { if (e.key === 'Enter') addOther(e); }} placeholder="Not listed? Type it, e.g. Space Tech" />
          <button type="button" className="btn btn-quiet btn-sm" onClick={addOther} disabled={!other.trim()}><Plus size={16} aria-hidden="true" />Add</button>
        </div>
      </fieldset>
    </div>
  );
}
