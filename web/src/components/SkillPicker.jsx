import { useMemo, useState } from 'react';
import { CATEGORIES } from '../lib/constants';

const LEVELS = ['', 'Learning', 'Comfortable', 'Strong'];

// value: Map(skillId -> level 1..3)
export default function SkillPicker({ skills, value, onChange }) {
  const [filter, setFilter] = useState('');
  const groups = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return CATEGORIES.map((cat) => ({
      cat,
      items: skills.filter((s) => s.category === cat && (!f || s.name.toLowerCase().includes(f))),
    })).filter((g) => g.items.length);
  }, [skills, filter]);

  const toggle = (id) => {
    const next = new Map(value);
    if (!next.has(id)) next.set(id, 2);
    else if (next.get(id) < 3) next.set(id, next.get(id) + 1);
    else next.delete(id);
    onChange(next);
  };

  return (
    <div className="skill-picker">
      <label className="field">
        <span>Search skills</span>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="React, Figma, Arduino…" />
      </label>
      <p className="hint">Tap once to add a skill, tap again to raise your level, a fourth tap removes it.</p>
      {groups.map((g) => (
        <fieldset key={g.cat} className="skill-group">
          <legend>{g.cat}</legend>
          <div className="pills">
            {g.items.map((s) => {
              const lv = value.get(s.id) || 0;
              return (
                <button type="button" key={s.id} className={`pill pill-lv${lv}`} aria-pressed={lv > 0} onClick={() => toggle(s.id)}>
                  {s.name}{lv > 0 && <small>{LEVELS[lv]}</small>}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
