import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, ExternalLink, Copy } from 'lucide-react';
import { supabase, q, rpc } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import MatchCard from '../components/MatchCard';
import InviteDialog from '../components/InviteDialog';
import { Chip, Spinner } from '../components/bits';
import { fmtDate } from './Events';

const MODE = { online: 'Online', offline: 'In person', hybrid: 'Hybrid' };

// One hackathon: its rules, open teams, and teammates ranked for this event.
// ACE can link any event page here: https://<hakemate-site>/join?event=<id>
export default function EventDetail() {
  const { id } = useParams();
  const { profile, account } = useAuth();
  const toast = useToast();
  const [hk, setHk] = useState(undefined);
  const [teams, setTeams] = useState(null);
  const [matches, setMatches] = useState(null);
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    setHk(undefined); setTeams(null); setMatches(null);
    q(supabase.from('hackathons').select('*').eq('id', id).maybeSingle()).then(setHk).catch(() => setHk(null));
    q(supabase.from('teams').select('id,name,max_size,is_open,needed_categories,description,team_members(user_id)').eq('hackathon_id', id).order('created_at', { ascending: false }))
      .then(setTeams).catch(() => setTeams([]));
    rpc('match_candidates', { p_team: null, p_limit: 9, p_hackathon: id }).then(setMatches).catch(() => setMatches([]));
  }, [id]);

  if (hk === undefined) return <Spinner />;
  if (hk === null) return <div className="panel"><h1>Hackathon not found</h1><p>This link may be old. <Link to="/events">See all hackathons</Link></p></div>;

  const myTeam = teams?.find((t) => (t.team_members || []).some((m) => m.user_id === profile.id));
  const open = (teams || []).filter((t) => t !== myTeam && t.is_open && (t.team_members || []).length < t.max_size);
  const aceLink = `${window.location.origin}/join?event=${hk.id}`;
  const closed = hk.registration_deadline && new Date(hk.registration_deadline) < new Date(new Date().toDateString());

  return (
    <div className="event">
      <div className="page-head row">
        <div>
          <p className="crumb"><Link to="/events">Hackathons</Link></p>
          <h1>{hk.name}</h1>
          <p>{[hk.organizer, MODE[hk.mode], hk.location].filter(Boolean).join(' · ')}</p>
          <div className="chips">
            {hk.registration_deadline && <Chip tone={closed ? 'soft' : 'need'}>{closed ? 'Registration closed' : `Register by ${fmtDate(hk.registration_deadline)}`}</Chip>}
            <Chip tone="soft">Teams of {hk.team_min}–{hk.team_max}</Chip>
            {hk.domains?.map((d) => <Chip key={d} tone="soft">{d}</Chip>)}
          </div>
        </div>
        <div className="head-actions">
          {hk.url && <a className="btn btn-quiet" href={hk.url} target="_blank" rel="noreferrer"><ExternalLink size={17} aria-hidden="true" />Event page</a>}
          {myTeam
            ? <Link className="btn btn-primary" to={`/teams/${myTeam.id}`}>Open your team</Link>
            : <Link className="btn btn-primary" to={`/teams?new=1&event=${hk.id}`}><Plus size={18} aria-hidden="true" />Create a team for this</Link>}
        </div>
      </div>

      <section>
        <h2>Open teams for this hackathon</h2>
        {teams === null ? <Spinner /> : open.length === 0 ? <p className="muted">No open teams yet. Create one and invite the people below.</p> : (
          <div className="team-list">
            {open.map((t) => (
              <Link key={t.id} to={`/teams/${t.id}`} className="team-row">
                <span className="team-mark" aria-hidden="true">{t.name.replace('Sample: ', '').slice(0, 2).toUpperCase()}</span>
                <span className="team-info">
                  <b>{t.name}</b>
                  <small>{(t.team_members || []).length}/{t.max_size} members{t.description ? ` · ${t.description}` : ''}</small>
                  {t.needed_categories?.length > 0 && <span className="chips">{t.needed_categories.map((c) => <Chip key={c} tone="need">Needs {c}</Chip>)}</span>}
                </span>
                <span className="open-tag">Open</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="section-head"><h2>Best teammates for this hackathon</h2><Link to="/discover">Search everyone</Link></div>
        <p className="hint">Ranked for this event: its {MODE[hk.mode].toLowerCase()} format{hk.location ? ` in ${hk.location}` : ''}, your missing skills, and people who aren't already in a team for it.</p>
        {matches === null ? <Spinner label="Running the Team DNA engine" /> : matches.length === 0 ? <p className="muted">No free builders for this hackathon right now.</p> : (
          <div className="match-grid">
            {matches.map((m) => (
              <MatchCard key={m.user_id} m={m} action={<button className="btn btn-primary btn-sm" onClick={() => setInvite(m)}>Invite</button>} />
            ))}
          </div>
        )}
      </section>

      {account?.role === 'admin' && (
        <section className="panel ace-box">
          <h2>Link from AllCollegeEvent</h2>
          <p>Put this link on the ACE page for this hackathon (a "Find teammates" button). Students land straight here after signing in.</p>
          <div className="copy-row">
            <code>{aceLink}</code>
            <button className="btn btn-quiet btn-sm" onClick={() => navigator.clipboard.writeText(aceLink).then(() => toast('Link copied', 'good'))}><Copy size={15} aria-hidden="true" />Copy</button>
          </div>
        </section>
      )}

      {invite && <InviteDialog target={invite} onClose={() => setInvite(null)} />}
    </div>
  );
}
