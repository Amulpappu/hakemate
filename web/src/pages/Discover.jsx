import { useEffect, useMemo, useState } from 'react';
import { Search, Sparkles, UserPlus, Compass } from 'lucide-react';
import { supabase, q, rpc } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import MatchCard from '../components/MatchCard';
import InviteDialog from '../components/InviteDialog';
import { Spinner, Empty } from '../components/bits';
import { CATEGORIES, AVAILABILITY } from '../lib/constants';

export default function Discover() {
  const { profile } = useAuth();
  const toast = useToast();
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState('');
  const [all, setAll] = useState(null);
  const [cats, setCats] = useState([]);
  const [avail, setAvail] = useState('');
  const [city, setCity] = useState('');
  const [text, setText] = useState('');
  const [nl, setNl] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    q(supabase.from('team_members').select('team:teams(id,name)').eq('user_id', profile.id))
      .then((r) => setTeams(r.map((x) => x.team))).catch(() => {});
  }, [profile.id]);

  useEffect(() => {
    setAll(null);
    rpc('match_candidates', { p_team: teamId || null, p_limit: 60 })
      .then(setAll).catch((e) => { toast(e.message, 'bad'); setAll([]); });
  }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // availability is not returned by the engine; load it for the filter
  const [availMap, setAvailMap] = useState({});
  useEffect(() => {
    if (!all?.length) return;
    q(supabase.from('profiles').select('id, availability').in('id', all.map((m) => m.user_id)))
      .then((rows) => setAvailMap(Object.fromEntries(rows.map((r) => [r.id, r.availability])))).catch(() => {});
  }, [all]);

  const shown = useMemo(() => (all || []).filter((m) =>
    (!cats.length || cats.some((c) => m.categories?.includes(c))) &&
    (!avail || availMap[m.user_id]?.includes(avail)) &&
    (!city || (m.city || '').toLowerCase().includes(city.toLowerCase())) &&
    (!text || [m.display_name, m.headline, m.college, ...(m.categories || [])].join(' ').toLowerCase().includes(text.toLowerCase()))
  ), [all, cats, avail, city, text, availMap]);

  async function askAi(e) {
    e.preventDefault();
    if (!nl.trim()) return;
    setAiBusy(true);
    try {
      const res = await fetch('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: nl }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search is unavailable right now');
      setCats(data.categories || []);
      setAvail(data.availability || '');
      setCity(data.city || '');
      setText(data.keyword || '');
      toast('Filters set from your search', 'good');
    } catch (err) {
      toast(`${err.message}. Use the filters below instead.`, 'bad');
    } finally { setAiBusy(false); }
  }

  const toggleCat = (c) => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c]);

  return (
    <div className="discover">
      <div className="page-head">
        <h1>Find teammates</h1>
        <p>Ranked by Team DNA score. Open "Why this score?" on any card to see how each part adds up.</p>
      </div>

      <form className="ai-search" onSubmit={askAi}>
        <Sparkles size={20} aria-hidden="true" />
        <label className="sr-only" htmlFor="nl">Describe who you need</label>
        <input id="nl" value={nl} onChange={(e) => setNl(e.target.value)} placeholder="Need a Flutter dev free on weekends near Coimbatore" />
        <button className="btn btn-primary" disabled={aiBusy || !nl.trim()}>{aiBusy ? 'Reading…' : 'Search'}</button>
      </form>

      <div className="filters">
        <label className="field field-inline"><span>Match for</span>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">Me (no team yet)</option>
            {teams.map((t) => <option key={t.id} value={t.id}>Team {t.name}</option>)}
          </select>
        </label>
        <label className="field field-inline"><span>Free</span>
          <select value={avail} onChange={(e) => setAvail(e.target.value)}>
            <option value="">Any time</option>{AVAILABILITY.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <label className="field field-inline"><span>City</span><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Any" /></label>
        <label className="field field-inline grow"><span><Search size={15} aria-hidden="true" /> Name or college</span><input value={text} onChange={(e) => setText(e.target.value)} /></label>
      </div>
      <div className="pills cat-filter" role="group" aria-label="Skill areas">
        {CATEGORIES.map((c) => <button key={c} className="pill" aria-pressed={cats.includes(c)} onClick={() => toggleCat(c)}>{c}</button>)}
        {(cats.length > 0 || avail || city || text) && <button className="pill pill-clear" onClick={() => { setCats([]); setAvail(''); setCity(''); setText(''); }}>Clear filters</button>}
      </div>

      {all === null ? <Spinner label="Running the Team DNA engine" /> : shown.length === 0 ? (
        <Empty icon={Compass} title={all.length ? 'No one matches these filters' : 'No builders to match yet'}>
          {all.length ? 'Clear a filter or two to see more people.' : 'Invite friends from other departments to join Hakemate, then check back.'}
        </Empty>
      ) : (
        <div className="match-grid">
          {shown.map((m) => (
            <MatchCard key={m.user_id} m={m} action={
              <button className="btn btn-primary btn-sm" onClick={() => setInvite(m)}><UserPlus size={16} aria-hidden="true" />Invite</button>
            } />
          ))}
        </div>
      )}
      {invite && <InviteDialog target={invite} onClose={() => setInvite(null)} />}
    </div>
  );
}
