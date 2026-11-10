import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Plus } from 'lucide-react';
import { supabase, q, rpc } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Chip, Empty, Spinner } from '../components/bits';
import { CATEGORIES } from '../lib/constants';

function TeamRow({ t, mine }) {
  const size = t.team_members?.[0]?.count ?? t.members ?? 0;
  return (
    <Link to={`/teams/${t.id}`} className="team-row">
      <span className="team-mark" aria-hidden="true">{t.name.slice(0, 2).toUpperCase()}</span>
      <span className="team-info">
        <b>{t.name}</b>
        <small>{t.hackathon?.name || 'No hackathon picked'} · {size}/{t.max_size} members</small>
        {t.needed_categories?.length > 0 && <span className="chips">{t.needed_categories.map((c) => <Chip key={c} tone="need">Needs {c}</Chip>)}</span>}
      </span>
      {!mine && t.is_open && size < t.max_size && <span className="open-tag">Open</span>}
    </Link>
  );
}

export default function Teams() {
  const { profile } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [mine, setMine] = useState(null);
  const [open, setOpen] = useState(null);
  const [hackathons, setHackathons] = useState([]);
  const [form, setForm] = useState({ name: '', hackathon: params.get('event') || '', description: '', needed: [], max: 4 });
  const creating = params.get('new') === '1';
  const pickedHk = hackathons.find((h) => h.id === form.hackathon);

  useEffect(() => {
    const sel = 'id,name,max_size,is_open,needed_categories,hackathon:hackathons(name),team_members(count)';
    q(supabase.from('team_members').select(`team:teams(${sel})`).eq('user_id', profile.id))
      .then((r) => setMine(r.map((x) => x.team))).catch(() => setMine([]));
    q(supabase.from('teams').select(sel).eq('is_open', true).order('created_at', { ascending: false }).limit(40))
      .then(setOpen).catch(() => setOpen([]));
    q(supabase.from('hackathons').select('id,name,registration_deadline,team_max').order('registration_deadline', { nullsFirst: false }))
      .then(setHackathons).catch(() => {});
  }, [profile.id]);

  async function create(e) {
    e.preventDefault();
    try {
      const id = await rpc('create_team', { p_name: form.name.trim(), p_hackathon: form.hackathon, p_description: form.description.trim(), p_needed: form.needed, p_max: Number(form.max) });
      toast('Team created. Captain badge unlocked.', 'good');
      nav(`/teams/${id}`);
    } catch (err) { toast(err.message, 'bad'); }
  }

  const myIds = new Set((mine || []).map((t) => t.id));
  const others = (open || []).filter((t) => !myIds.has(t.id));

  return (
    <div className="teams">
      <div className="page-head row">
        <div><h1>Teams</h1><p>Create a team, see which skills it still needs, and invite the builders who fill the gap.</p></div>
        {!creating && <button className="btn btn-primary" onClick={() => setParams({ new: '1' })}><Plus size={18} aria-hidden="true" />Create a team</button>}
      </div>

      {creating && (
        <form className="panel create-team" onSubmit={create}>
          <h2>New team</h2>
          <div className="form-grid">
            <label className="field"><span>Team name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={50} required /></label>
            <label className="field"><span>Hackathon</span>
              <select value={form.hackathon} onChange={(e) => setForm({ ...form, hackathon: e.target.value })}>
                <option value="">Not decided yet</option>{hackathons.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </label>
            <label className="field wide"><span>What are you building?</span><textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={400} /></label>
            <label className="field"><span>Team size{pickedHk ? ` (this hackathon allows up to ${pickedHk.team_max})` : ''}</span>
              <input type="number" min="2" max={pickedHk?.team_max || 10} value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} />
            </label>
          </div>
          <fieldset className="group"><legend>Skills the team needs</legend>
            <div className="pills">{CATEGORIES.map((c) => (
              <button type="button" key={c} className="pill" aria-pressed={form.needed.includes(c)}
                onClick={() => setForm({ ...form, needed: form.needed.includes(c) ? form.needed.filter((x) => x !== c) : [...form.needed, c] })}>{c}</button>
            ))}</div>
          </fieldset>
          <div className="dialog-actions">
            <button type="button" className="btn btn-quiet" onClick={() => setParams({})}>Cancel</button>
            <button className="btn btn-primary" disabled={form.name.trim().length < 2}>Create team</button>
          </div>
        </form>
      )}

      <section>
        <h2>Your teams</h2>
        {mine === null ? <Spinner /> : mine.length === 0
          ? <Empty icon={Users} title="You're not in a team yet">Create one above, or ask to join an open team below.</Empty>
          : <div className="team-list">{mine.map((t) => <TeamRow key={t.id} t={t} mine />)}</div>}
      </section>

      <section>
        <h2>Open teams looking for people</h2>
        {open === null ? <Spinner /> : others.length === 0
          ? <p className="muted">No open teams right now.</p>
          : <div className="team-list">{others.map((t) => <TeamRow key={t.id} t={t} />)}</div>}
      </section>
    </div>
  );
}
