import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, q } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import SkillPicker from '../components/SkillPicker';
import SearchSelect from '../components/SearchSelect';
import InterestPicker from '../components/InterestPicker';
import GithubImport from '../components/GithubImport';
import { DEPARTMENTS } from '../lib/departments';
import { STATES, citiesOf, findColleges } from '../lib/places';
import { BadgeMedal, Spinner } from '../components/bits';
import { AVAILABILITY, EXPERIENCE, MODES, YEARS } from '../lib/constants';

const FIELDS = ['display_name', 'handle', 'headline', 'bio', 'college', 'department', 'year_of_study', 'city', 'state',
  'event_mode', 'hours_per_week', 'experience_level', 'hackathons_count', 'availability', 'interests',
  'github_url', 'linkedin_url', 'portfolio_url', 'looking_for_team', 'visible', 'showcase_badges'];

export default function Settings() {
  const { profile, refresh } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [f, setF] = useState(null);
  const [contacts, setContacts] = useState({ phone: '', whatsapp: '', discord: '', email: '' });
  const [skills, setSkills] = useState([]);
  const [picked, setPicked] = useState(new Map());
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setF(Object.fromEntries(FIELDS.map((k) => [k, profile[k] ?? (Array.isArray(profile[k]) ? [] : '')])));
    q(supabase.from('profile_contacts').select('*').eq('profile_id', profile.id).maybeSingle()).then((c) => c && setContacts({ phone: c.phone || '', whatsapp: c.whatsapp || '', discord: c.discord || '', email: c.email || '' }));
    q(supabase.from('skills').select('*').order('name')).then(setSkills);
    q(supabase.from('profile_skills').select('skill_id, level').eq('profile_id', profile.id)).then((r) => setPicked(new Map(r.map((x) => [x.skill_id, x.level]))));
    q(supabase.from('user_badges').select('badge:badges(*)').eq('user_id', profile.id)).then((r) => setMine(r.map((x) => x.badge)));
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!f) return <Spinner />;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const toggleIn = (k, v, max) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : (max && f[k].length >= max ? f[k] : [...f[k], v]));

  async function save(e) {
    e.preventDefault();
    if (picked.size === 0) { toast('Keep at least one skill on your profile.', 'bad'); return; }
    setBusy(true);
    try {
      const clean = { ...f };
      ['headline', 'bio', 'department', 'city', 'state', 'github_url', 'linkedin_url', 'portfolio_url'].forEach((k) => { clean[k] = (clean[k] || '').trim() || null; });
      clean.hours_per_week = clean.hours_per_week === '' ? null : Number(clean.hours_per_week);
      clean.hackathons_count = Number(clean.hackathons_count) || 0;
      await q(supabase.from('profiles').update(clean).eq('id', profile.id));
      await q(supabase.from('profile_contacts').update(Object.fromEntries(Object.entries(contacts).map(([k, v]) => [k, v.trim() || null]))).eq('profile_id', profile.id));
      await q(supabase.from('profile_skills').delete().eq('profile_id', profile.id));
      await q(supabase.from('profile_skills').insert([...picked].map(([skill_id, level]) => ({ profile_id: profile.id, skill_id, level }))));
      supabase.functions.invoke('embed-profile').catch(() => {});
      await refresh();
      toast('Profile saved', 'good');
      nav('/me');
    } catch (err) {
      toast(err.message.includes('handle') ? 'That username is taken or invalid.' : err.message.includes('_url') ? 'Links must start with https:// and point to the right site.' : err.message, 'bad');
    } finally { setBusy(false); }
  }

  return (
    <form className="settings" onSubmit={save}>
      <div className="page-head"><h1>Edit profile</h1><p>Changes update your matches straight away.</p></div>

      <section className="panel"><h2>Basics</h2>
        <div className="form-grid">
          <label className="field"><span>Full name</span><input value={f.display_name} onChange={(e) => set('display_name', e.target.value)} maxLength={60} /></label>
          <label className="field"><span>Username</span><input value={f.handle} onChange={(e) => set('handle', e.target.value.toLowerCase())} maxLength={24} /></label>
          <label className="field wide"><span>Headline</span><input value={f.headline || ''} onChange={(e) => set('headline', e.target.value)} maxLength={90} /></label>
          <label className="field wide"><span>About you</span><textarea rows={4} value={f.bio || ''} onChange={(e) => set('bio', e.target.value)} maxLength={400} /></label>
          <SearchSelect className="wide" label="College" value={f.college || ''} onChange={(v) => set('college', v)} load={(q) => findColleges(q, { state: f.state, city: f.city })}
            minChars={2} placeholder="Type your college" onPick={(c) => { if (c.state) set('state', c.state); if (c.district) set('city', c.district); }} />
          <SearchSelect label="Department" value={f.department || ''} onChange={(v) => set('department', v)} options={DEPARTMENTS} placeholder="Type, e.g. CSE, ECE, B.Com" />
          <label className="field"><span>Year</span><select value={f.year_of_study || ''} onChange={(e) => set('year_of_study', e.target.value)}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select></label>
          <SearchSelect label="State" value={f.state || ''} onChange={(v) => { set('state', v); if (v !== f.state) set('city', ''); }} options={STATES} placeholder="Type your state" allowCustom={false} />
          <SearchSelect key={f.state} label="City / district" value={f.city || ''} onChange={(v) => set('city', v)} options={citiesOf(f.state)} placeholder={f.state ? 'Type your city' : 'Pick a state first'} disabled={!f.state} />
        </div>
      </section>

      <section className="panel"><h2>Skills</h2>
        <details className="gh-details">
          <summary>Find skills from my GitHub</summary>
          <GithubImport skills={skills} url={f.github_url || ''} onUrl={(v) => set('github_url', v)} actionLabel="Add these to my skills"
            onAction={(sel) => { const next = new Map(picked); sel.forEach((lv, id) => next.set(id, Math.max(lv, next.get(id) || 0))); setPicked(next); toast(`${sel.size} skills added. Save to keep them.`, 'good'); }} />
        </details>
        <SkillPicker skills={skills} value={picked} onChange={setPicked} />
      </section>

      <section className="panel"><h2>Interests and time</h2>
        <fieldset className="group"><legend>Interests</legend><InterestPicker value={f.interests} onChange={(v) => set('interests', v)} /></fieldset>
        <fieldset className="group"><legend>Free times</legend><div className="pills">{AVAILABILITY.map((a) => <button type="button" key={a.id} className="pill" aria-pressed={f.availability.includes(a.id)} onClick={() => toggleIn('availability', a.id)}>{a.label}</button>)}</div></fieldset>
        <div className="form-grid">
          <label className="field"><span>Experience</span><select value={f.experience_level} onChange={(e) => set('experience_level', e.target.value)}>{EXPERIENCE.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
          <label className="field"><span>Events you can join</span><select value={f.event_mode} onChange={(e) => set('event_mode', e.target.value)}>{MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
          <label className="field"><span>Hours a week for hackathons</span><input type="number" min="0" max="80" value={f.hours_per_week ?? ''} onChange={(e) => set('hours_per_week', e.target.value)} /></label>
          <label className="field"><span>Hackathons done</span><input type="number" min="0" max="200" value={f.hackathons_count} onChange={(e) => set('hackathons_count', e.target.value)} /></label>
        </div>
      </section>

      <section className="panel"><h2>Badge showcase</h2>
        <p className="hint">Pick up to three badges to pin at the top of your profile.</p>
        {mine.length === 0 ? <p className="muted">Earn badges first, then pin them here.</p> : (
          <div className="pills">{mine.map((b) => (
            <button type="button" key={b.code} className="pill pill-badge" aria-pressed={f.showcase_badges.includes(b.code)} onClick={() => toggleIn('showcase_badges', b.code, 3)}>
              <BadgeMedal badge={b} size={26} />{b.name}
            </button>
          ))}</div>
        )}
      </section>

      <section className="panel"><h2>Links and contacts</h2>
        <div className="form-grid">
          <label className="field"><span>GitHub</span><input value={f.github_url || ''} onChange={(e) => set('github_url', e.target.value)} placeholder="https://github.com/you" /></label>
          <label className="field"><span>LinkedIn</span><input value={f.linkedin_url || ''} onChange={(e) => set('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/you" /></label>
          <label className="field wide"><span>Portfolio</span><input value={f.portfolio_url || ''} onChange={(e) => set('portfolio_url', e.target.value)} placeholder="https://…" /></label>
        </div>
        <p className="hint">Only you and your teammates can see these:</p>
        <div className="form-grid">
          <label className="field"><span>WhatsApp</span><input value={contacts.whatsapp} onChange={(e) => setContacts({ ...contacts, whatsapp: e.target.value })} inputMode="tel" /></label>
          <label className="field"><span>Phone</span><input value={contacts.phone} onChange={(e) => setContacts({ ...contacts, phone: e.target.value })} inputMode="tel" /></label>
          <label className="field"><span>Discord</span><input value={contacts.discord} onChange={(e) => setContacts({ ...contacts, discord: e.target.value })} /></label>
          <label className="field"><span>Email</span><input type="email" value={contacts.email} onChange={(e) => setContacts({ ...contacts, email: e.target.value })} /></label>
        </div>
      </section>

      <section className="panel"><h2>Privacy</h2>
        <label className="check"><input type="checkbox" checked={f.looking_for_team} onChange={(e) => set('looking_for_team', e.target.checked)} />Show that I'm looking for a team</label>
        <label className="check"><input type="checkbox" checked={f.visible} onChange={(e) => set('visible', e.target.checked)} />Show my profile in matches and search</label>
      </section>

      <div className="sticky-save"><button type="button" className="btn btn-quiet" onClick={() => nav('/me')}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
    </form>
  );
}
