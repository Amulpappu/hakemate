import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Lock, Phone, Mail, MessageCircle, UserPlus } from 'lucide-react';
import { supabase, q, rpc } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import GapRadar from '../components/GapRadar';
import MatchCard from '../components/MatchCard';
import TeamChat from '../components/TeamChat';
import TaskBoard from '../components/TaskBoard';
import { Avatar, Chip, Spinner } from '../components/bits';
import { timeAgo } from '../lib/constants';

export default function TeamDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [contacts, setContacts] = useState({});
  const [gap, setGap] = useState([]);
  const [requests, setRequests] = useState([]);
  const [matches, setMatches] = useState(null);

  const load = useCallback(async () => {
    try {
      const t = await q(supabase.from('teams').select('*, hackathon:hackathons(id,name,mode,registration_deadline)').eq('id', id).single());
      setTeam(t);
      const m = await q(supabase.from('team_members')
        .select('role_title, joined_at, member:profiles!team_members_user_id_fkey(id,handle,display_name,avatar_url,headline,level)').eq('team_id', id).order('joined_at'));
      setMembers(m);
      const c = await q(supabase.from('profile_contacts').select('*').in('profile_id', m.map((x) => x.member.id)));
      setContacts(Object.fromEntries(c.map((x) => [x.profile_id, x])));
      setGap(await rpc('team_gap', { p_team: id }));
      setRequests(await q(supabase.from('team_requests')
        .select('*, who:profiles!team_requests_user_id_fkey(handle,display_name,avatar_url)').eq('team_id', id).eq('status', 'pending')));
    } catch (e) { toast(e.message, 'bad'); }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const inTeam = members.some((m) => m.member.id === profile.id);
  useEffect(() => {
    if (!inTeam) return;
    rpc('match_candidates', { p_team: id, p_limit: 6 }).then(setMatches).catch(() => setMatches([]));
  }, [inTeam, id]);

  if (!team) return <Spinner />;
  const full = members.length >= team.max_size;
  const myPending = requests.find((r) => r.user_id === profile.id);
  const missing = gap.filter((g) => g.needed && g.members === 0).map((g) => g.category);

  async function act(fn) { try { await fn(); await load(); } catch (e) { toast(e.message, 'bad'); } }

  return (
    <div className="team-detail">
      <div className="page-head row">
        <div>
          <p className="crumb"><Link to="/teams">Teams</Link></p>
          <h1>{team.name}</h1>
          <p>{team.hackathon ? <Link to={`/events/${team.hackathon.id}`}>{team.hackathon.name}</Link> : 'No hackathon picked'} · {members.length}/{team.max_size} members{team.hackathon?.registration_deadline && ` · registration closes ${new Date(team.hackathon.registration_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}</p>
        </div>
        <div className="head-actions">
          {!inTeam && !myPending && team.is_open && !full && (
            <button className="btn btn-primary" onClick={() => act(async () => { await rpc('send_team_request', { p_team: id, p_user: profile.id, p_message: null }); toast('Request sent to the team', 'good'); })}>
              <UserPlus size={18} aria-hidden="true" />Ask to join
            </button>
          )}
          {myPending?.kind === 'request' && <span className="muted">Your request is waiting for the team</span>}
          {inTeam && (
            <button className="btn btn-quiet" onClick={() => { if (window.confirm('Leave this team?')) act(async () => { await rpc('leave_team', { p_team: id }); nav('/teams'); }); }}>Leave team</button>
          )}
        </div>
      </div>
      {team.description && <p className="team-desc">{team.description}</p>}

      {myPending?.kind === 'invite' && (
        <section className="notice">
          <h2>You're invited to {team.name}</h2>
          {myPending.message && <p>"{myPending.message}"</p>}
          <div className="dialog-actions start">
            <button className="btn btn-primary" onClick={() => act(async () => { await rpc('respond_team_request', { p_request: myPending.id, p_accept: true }); toast(`You joined ${team.name}. Squad Up badge unlocked.`, 'good'); })}>Accept and join</button>
            <button className="btn btn-quiet" onClick={() => act(() => rpc('respond_team_request', { p_request: myPending.id, p_accept: false }))}>Decline</button>
          </div>
        </section>
      )}

      <div className="team-grid">
        <section className="panel">
          <h2>Team Gap Radar</h2>
          <GapRadar rows={gap} />
          <p className="radar-note">{missing.length ? `Still needed: ${missing.join(', ')}` : 'Every skill your team asked for is covered.'}</p>
        </section>

        <section className="panel">
          <h2>Members</h2>
          <ul className="members">
            {members.map(({ member: m, role_title }) => {
              const c = contacts[m.id];
              return (
                <li key={m.id}>
                  <Link to={`/u/${m.handle}`}><Avatar src={m.avatar_url} name={m.display_name} size={44} /></Link>
                  <div>
                    <Link to={`/u/${m.handle}`}><b>{m.display_name}</b></Link>
                    <small>{role_title || m.headline || `Level ${m.level}`}{m.id === team.owner_id && role_title !== 'Captain' && ' · Captain'}</small>
                    {c ? (
                      <span className="contacts">
                        {c.whatsapp && <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"><MessageCircle size={14} aria-hidden="true" />WhatsApp</a>}
                        {c.phone && <a href={`tel:${c.phone}`}><Phone size={14} aria-hidden="true" />{c.phone}</a>}
                        {c.email && <a href={`mailto:${c.email}`}><Mail size={14} aria-hidden="true" />Email</a>}
                      </span>
                    ) : <span className="locked"><Lock size={13} aria-hidden="true" />Contacts unlock when you join</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {inTeam && (
        <div className="collab-grid">
          <TaskBoard teamId={id} members={members} />
          <TeamChat teamId={id} members={members} me={profile.id} />
        </div>
      )}

      {inTeam && requests.filter((r) => r.kind === 'request').length > 0 && (
        <section className="panel">
          <h2>Join requests</h2>
          <ul className="requests">
            {requests.filter((r) => r.kind === 'request').map((r) => (
              <li key={r.id}>
                <Avatar src={r.who.avatar_url} name={r.who.display_name} size={36} />
                <span><Link to={`/u/${r.who.handle}`}>{r.who.display_name}</Link><small>{timeAgo(r.created_at)}</small></span>
                <button className="btn btn-primary btn-sm" disabled={full} onClick={() => act(() => rpc('respond_team_request', { p_request: r.id, p_accept: true }))}>Accept</button>
                <button className="btn btn-quiet btn-sm" onClick={() => act(() => rpc('respond_team_request', { p_request: r.id, p_accept: false }))}>Decline</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inTeam && !full && (
        <section>
          <div className="section-head"><h2>Builders who fill your gaps</h2><Link to="/discover">Search everyone</Link></div>
          {matches === null ? <Spinner label="Running the Team DNA engine" /> : (
            <div className="match-grid">
              {matches.map((m) => (
                <MatchCard key={m.user_id} m={m} action={
                  requests.some((r) => r.user_id === m.user_id)
                    ? <Chip tone="soft">Invited</Chip>
                    : <button className="btn btn-primary btn-sm" onClick={() => act(async () => { await rpc('send_team_request', { p_team: id, p_user: m.user_id, p_message: `Join ${team.name}?` }); toast(`Invite sent to ${m.display_name}`, 'good'); })}>Invite</button>
                } />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
