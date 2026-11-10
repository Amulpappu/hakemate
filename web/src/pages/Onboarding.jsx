import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, q, rpc } from '../lib/supabase';
import { takeNext } from '../lib/next';
import { parseGithubUser } from '../lib/github';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import SkillPicker from '../components/SkillPicker';
import SearchSelect from '../components/SearchSelect';
import InterestPicker from '../components/InterestPicker';
import GithubImport from '../components/GithubImport';
import { AVAILABILITY, EXPERIENCE, MODES, YEARS } from '../lib/constants';
import { DEPARTMENTS } from '../lib/departments';
import { STATES, citiesOf, findColleges } from '../lib/places';
import { LevelAvatar } from '../components/bits';

// Sidebar labels and the question each step asks
const STEPS = [
  { label: 'GitHub', ask: 'Do you have a GitHub account?', sub: 'We read your public repos and suggest your skills. You confirm each one. No GitHub? Skip this step.' },
  { label: 'About you', ask: 'Where do you study?', sub: 'Start typing and pick from the list. Not there? Keep what you typed.' },
  { label: 'Skills', ask: 'What can you do?', sub: 'Tap a skill to add it, tap again to raise your level.' },
  { label: 'Interests and time', ask: 'What do you like building, and when are you free?', sub: 'Teammates with the same interests and free time score higher.' },
  { label: 'Your story', ask: 'How should other builders know you?', sub: 'The engine reads this to find people who think like you.' },
  { label: 'Ready', ask: 'All set?', sub: '' },
];

const githubUrl = (v) => { const u = parseGithubUser(v); return u ? `https://github.com/${u}` : null; };

export default function Onboarding() {
  const { profile, refresh } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [skills, setSkills] = useState([]);
  const [picked, setPicked] = useState(new Map());
  const [fromGithub, setFromGithub] = useState(new Map());
  const [ghSel, setGhSel] = useState(new Map());
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(null);

  useEffect(() => {
    if (!profile || f) return;
    setF({
      display_name: profile.display_name || '', handle: profile.handle || '', college: profile.college || '',
      department: profile.department || '', year_of_study: profile.year_of_study || '', city: profile.city || '',
      state: profile.state || '', interests: profile.interests || [], availability: profile.availability || [],
      event_mode: profile.event_mode || 'any', experience_level: profile.experience_level || 'first_timer',
      hackathons_count: profile.hackathons_count || 0, headline: profile.headline || '', bio: profile.bio || '',
      github_url: profile.github_url || '', linkedin_url: profile.linkedin_url || '', phone: '',
    });
  }, [profile, f]);

  useEffect(() => {
    q(supabase.from('skills').select('*').order('name')).then(setSkills).catch((e) => toast(e.message, 'bad'));
    if (profile) q(supabase.from('profile_skills').select('skill_id, level').eq('profile_id', profile.id))
      .then((rows) => setPicked(new Map(rows.map((r) => [r.skill_id, r.level])))).catch(() => {});
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!f) return <div className="center-page">Loading your profile…</div>;
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const toggleIn = (k, v) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);
  const ghTyped = f.github_url.trim();
  const ghOk = !ghTyped || Boolean(githubUrl(ghTyped));

  const valid = [
    ghOk,
    f.display_name.trim().length >= 2 && /^[a-z0-9_]{3,24}$/.test(f.handle) && f.college.trim() && f.year_of_study && f.state.trim(),
    picked.size >= 1,
    f.availability.length >= 1,
    true,
    true,
  ];
  const help = [
    'That GitHub link looks wrong. Use https://github.com/yourname, or clear it to skip.',
    'Add your name, a username, your college, year and state to continue.',
    'Pick at least one skill to continue.',
    'Choose at least one time you are free to continue.',
  ];

  async function saveStep() {
    setBusy(true);
    try {
      if (step === 0) {
        const url = ghTyped ? githubUrl(ghTyped) : null;
        await q(supabase.from('profiles').update({ github_url: url }).eq('id', profile.id));
        set('github_url', url || '');
        if (ghSel.size) {
          const next = new Map(picked);
          ghSel.forEach((lv, id) => next.set(id, Math.max(lv, next.get(id) || 0)));
          setPicked(next);
          setFromGithub(new Map(ghSel));
        }
      }
      if (step === 1) {
        await q(supabase.from('profiles').update({
          display_name: f.display_name.trim(), handle: f.handle, college: f.college.trim(),
          department: f.department.trim() || null, year_of_study: f.year_of_study,
          city: f.city.trim() || null, state: f.state.trim() || null,
        }).eq('id', profile.id));
      }
      if (step === 2) {
        await q(supabase.from('profile_skills').delete().eq('profile_id', profile.id));
        await q(supabase.from('profile_skills').insert([...picked].map(([skill_id, level]) => ({ profile_id: profile.id, skill_id, level }))));
      }
      if (step === 3) {
        await q(supabase.from('profiles').update({
          interests: f.interests, availability: f.availability, event_mode: f.event_mode,
          experience_level: f.experience_level, hackathons_count: Number(f.hackathons_count) || 0,
        }).eq('id', profile.id));
      }
      if (step === 4) {
        await q(supabase.from('profiles').update({
          headline: f.headline.trim() || null, bio: f.bio.trim() || null, linkedin_url: f.linkedin_url.trim() || null,
        }).eq('id', profile.id));
        if (f.phone.trim()) await q(supabase.from('profile_contacts').update({ phone: f.phone.trim(), whatsapp: f.phone.trim() }).eq('profile_id', profile.id));
      }
      if (step === 5) {
        await rpc('complete_onboarding');
        supabase.functions.invoke('embed-profile').catch(() => {}); // AI meaning vector, optional
        await refresh();
        toast('Profile ready. Welcome Aboard badge unlocked.', 'good');
        nav(takeNext());
        return;
      }
      setStep(step + 1);
    } catch (e) {
      toast(e.message.includes('profiles_handle_key') ? 'That username is taken. Try another.'
        : e.message.includes('linkedin_url') ? 'LinkedIn links must start with https://linkedin.com/in/' : e.message, 'bad');
    } finally { setBusy(false); }
  }

  const S = STEPS[step];

  return (
    <div className="onboard">
      <aside className="onboard-side">
        <span className="brand"><img src="/favicon.svg" alt="" width="30" height="30" /><span>Hakemate</span></span>
        <h1>Set up your builder profile</h1>
        <p>Six short questions. The engine uses your answers to find teammates who complete your team.</p>
        <ol className="onboard-steps">
          {STEPS.map((s, i) => <li key={s.label} className={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>{s.label}</li>)}
        </ol>
      </aside>

      <section className="onboard-main">
        <div className="progress" aria-hidden="true"><span style={{ width: `${(100 * step) / (STEPS.length - 1)}%` }} /></div>
        <p className="q-count">Question {step + 1} of {STEPS.length}</p>
        <h2 className="q-ask">{S.ask}</h2>
        {S.sub && <p className="q-sub">{S.sub}</p>}

        {step === 0 && (
          <GithubImport skills={skills} url={f.github_url} onUrl={(v) => set('github_url', v)} onSelection={setGhSel} />
        )}

        {step === 1 && (
          <div className="form-grid">
            <label className="field"><span>Full name</span><input value={f.display_name} onChange={(e) => set('display_name', e.target.value)} maxLength={60} /></label>
            <label className="field"><span>Username</span><input value={f.handle} onChange={(e) => set('handle', e.target.value.toLowerCase())} maxLength={24} aria-describedby="h-help" /><small id="h-help">3 to 24 letters, numbers or _</small></label>
            <SearchSelect className="wide" label="College" value={f.college} onChange={(v) => set('college', v)} load={(q) => findColleges(q, { state: f.state, city: f.city })}
              minChars={2} placeholder="Type your college, e.g. Rathinam, PSG, KIT" hint="About 70,000 colleges and universities from the government AISHE list."
              onPick={(c) => { if (c.state) set('state', c.state); if (c.district) set('city', c.district); }} required />
            <SearchSelect label="Department" value={f.department} onChange={(v) => set('department', v)} options={DEPARTMENTS} placeholder="Type, e.g. CSE, ECE, B.Com" />
            <label className="field"><span>Year</span>
              <select value={f.year_of_study} onChange={(e) => set('year_of_study', e.target.value)}>
                <option value="">Choose your year</option>{YEARS.map((y) => <option key={y}>{y}</option>)}
              </select>
            </label>
            <SearchSelect label="State" value={f.state} onChange={(v) => { set('state', v); if (v !== f.state) set('city', ''); }} options={STATES} placeholder="Type your state" allowCustom={false} required />
            <SearchSelect key={f.state} label="City / district" value={f.city} onChange={(v) => set('city', v)} options={citiesOf(f.state)} placeholder={f.state ? 'Type your city' : 'Pick a state first'} disabled={!f.state} />
          </div>
        )}

        {step === 2 && (
          <>
            {fromGithub.size > 0 && <p className="gh-note">{fromGithub.size} skill{fromGithub.size === 1 ? '' : 's'} added from your GitHub. Check the levels and add anything we missed.</p>}
            <SkillPicker skills={skills} value={picked} onChange={setPicked} />
          </>
        )}

        {step === 3 && (
          <>
            <fieldset className="group"><legend>What do you like building for?</legend>
              <InterestPicker value={f.interests} onChange={(v) => set('interests', v)} />
            </fieldset>
            <fieldset className="group"><legend>When are you usually free?</legend>
              <div className="pills">{AVAILABILITY.map((a) => <button type="button" key={a.id} className="pill" aria-pressed={f.availability.includes(a.id)} onClick={() => toggleIn('availability', a.id)}>{a.label}</button>)}</div>
            </fieldset>
            <fieldset className="group"><legend>Hackathon experience</legend>
              <div className="choice-row">{EXPERIENCE.map((x) => (
                <button type="button" key={x.id} className="choice" aria-pressed={f.experience_level === x.id} onClick={() => set('experience_level', x.id)}><b>{x.label}</b><small>{x.hint}</small></button>
              ))}</div>
            </fieldset>
            <div className="form-grid">
              <label className="field"><span>Events you can join</span>
                <select value={f.event_mode} onChange={(e) => set('event_mode', e.target.value)}>{MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
              </label>
              <label className="field"><span>Hackathons done so far</span><input type="number" min="0" max="200" value={f.hackathons_count} onChange={(e) => set('hackathons_count', e.target.value)} /></label>
            </div>
          </>
        )}

        {step === 4 && (
          <div className="form-grid">
            <label className="field wide"><span>Headline</span><input value={f.headline} onChange={(e) => set('headline', e.target.value)} maxLength={90} placeholder="Backend dev who loves security" /></label>
            <label className="field wide"><span>About you</span><textarea rows={4} value={f.bio} onChange={(e) => set('bio', e.target.value)} maxLength={400} placeholder="What you've built, what you want to build next, the kind of team you like." /><small>{400 - f.bio.length} characters left.</small></label>
            <label className="field"><span>LinkedIn</span><input value={f.linkedin_url} onChange={(e) => set('linkedin_url', e.target.value)} placeholder="https://linkedin.com/in/you" /></label>
            <label className="field"><span>WhatsApp number (only teammates see this)</span><input value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="+91 98765 43210" /></label>
          </div>
        )}

        {step === 5 && (
          <div className="ready">
            <LevelAvatar profile={{ ...profile, display_name: f.display_name }} size={88} />
            <div>
              <h3>{f.display_name}</h3>
              <p>{[f.college, f.department, f.year_of_study].filter(Boolean).join(' · ')} · {picked.size} skill{picked.size === 1 ? '' : 's'}</p>
              <p>Finishing unlocks the <b>Welcome Aboard</b> badge and 50 XP. Then a quick tour shows you around the community.</p>
            </div>
          </div>
        )}

        <div className="onboard-actions">
          {step > 0 && <button className="btn btn-quiet" onClick={() => setStep(step - 1)} disabled={busy}>Back</button>}
          <button className="btn btn-primary" onClick={saveStep} disabled={!valid[step] || busy}>
            {busy ? 'Saving…' : step === 5 ? 'Finish and start the tour' : step === 0 && !ghTyped ? 'Skip, I have no GitHub' : step === 0 && ghSel.size ? `Continue with ${ghSel.size} skill${ghSel.size === 1 ? '' : 's'}` : 'Save and continue'}
          </button>
        </div>
        {!valid[step] && help[step] && <p className="hint">{help[step]}</p>}
      </section>
    </div>
  );
}
