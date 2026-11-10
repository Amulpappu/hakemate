import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Users, MessagesSquare } from 'lucide-react';
import { supabase, q, rpc } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { LevelAvatar, BadgeMedal, Spinner } from '../components/bits';
import MatchCard from '../components/MatchCard';
import { levelProgress } from '../lib/constants';

export default function Home() {
  const { profile } = useAuth();
  const [matches, setMatches] = useState(null);
  const [badges, setBadges] = useState([]);
  const [mine, setMine] = useState([]);
  const [hubs, setHubs] = useState([]);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (!profile) return;
    rpc('match_candidates', { p_team: null, p_limit: 3 }).then(setMatches).catch(() => setMatches([]));
    q(supabase.from('badges').select('*').order('sort_order')).then(setBadges).catch(() => {});
    q(supabase.from('user_badges').select('badge_code').eq('user_id', profile.id)).then((r) => setMine(r.map((x) => x.badge_code))).catch(() => {});
    q(supabase.from('hubs').select('*, hub_members(count)').order('sort_order')).then(setHubs).catch(() => {});
    q(supabase.from('team_requests').select('id, kind, message, team:teams(id,name)').eq('user_id', profile.id).eq('status', 'pending').eq('kind', 'invite'))
      .then(setRequests).catch(() => {});
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return <Spinner />;
  const { hi, pct } = levelProgress(profile.xp, profile.level);
  const next = badges.filter((b) => !mine.includes(b.code) && b.category !== 'special').slice(0, 4);

  return (
    <div className="home">
      <section className="hello">
        <LevelAvatar profile={profile} size={72} />
        <div className="hello-text">
          <h1>Hi {profile.display_name.split(' ')[0]}</h1>
          <p>Level {profile.level} · {profile.xp} XP · {hi - profile.xp} XP to level {profile.level + 1}</p>
          <div className="xpbar" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next level"><span style={{ width: `${pct * 100}%` }} /></div>
        </div>
        <div className="hello-actions">
          <Link className="btn btn-primary" to="/discover"><Compass size={18} aria-hidden="true" />Find teammates</Link>
          <Link className="btn btn-quiet" to="/teams?new=1"><Users size={18} aria-hidden="true" />Create a team</Link>
        </div>
      </section>

      {requests.length > 0 && (
        <section className="notice">
          <h2>You have {requests.length} team invite{requests.length > 1 ? 's' : ''}</h2>
          {requests.map((r) => <p key={r.id}><Link to={`/teams/${r.team.id}`}>{r.team.name}</Link>{r.message && `: "${r.message}"`}</p>)}
        </section>
      )}

      <div className="home-grid">
        <section>
          <div className="section-head"><h2>Best matches for you</h2><Link to="/discover">See all matches</Link></div>
          {matches === null && <Spinner label="Running the Team DNA engine" />}
          {matches?.length === 0 && <p className="muted">No matches yet. As more builders join, they show up here ranked by how well they complete you.</p>}
          <div className="match-list">{matches?.map((m) => <MatchCard key={m.user_id} m={m} />)}</div>
        </section>

        <aside className="home-side">
          <section className="panel">
            <div className="section-head"><h2>Next badges</h2><Link to="/badges">All badges</Link></div>
            <ul className="next-badges">
              {next.map((b) => (
                <li key={b.code}><BadgeMedal badge={b} earned={false} size={40} /><span><b>{b.name}</b><small>{b.description}</small></span><em>+{b.xp} XP</em></li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <div className="section-head"><h2>Hubs to join</h2><Link to="/community">Community</Link></div>
            <ul className="hub-list">
              {hubs.slice(0, 4).map((h) => (
                <li key={h.slug}><Link to={`/community?hub=${h.slug}`}><i style={{ background: h.color }} /><span><b>{h.name}</b><small>{h.hub_members[0].count} members</small></span></Link></li>
              ))}
            </ul>
            <Link className="btn btn-quiet btn-block" to="/community"><MessagesSquare size={18} aria-hidden="true" />Open the community</Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
