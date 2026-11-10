import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, q, rpc } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Avatar, Spinner } from '../components/bits';
import { timeAgo } from '../lib/constants';

export default function Admin() {
  const { account, profile } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');
  const [fb, setFb] = useState(null);
  const [hk, setHk] = useState({ id: '', name: '', organizer: '', mode: 'online', registration_deadline: '', url: '', team_max: 4 });

  const load = () => {
    rpc('admin_stats').then(setStats).catch((e) => toast(e.message, 'bad'));
    rpc('admin_list_users', { p_search: search || null }).then(setUsers).catch(() => setUsers([]));
    rpc('admin_feedback').then(setFb).catch(() => {});
  };
  useEffect(() => { if (account?.role === 'admin') load(); }, [account?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  if (account?.role !== 'admin') return <p>Only admins can see this page.</p>;

  async function update(u, patch) {
    try { await rpc('admin_update_user', { p_user: u.id, p_role: patch.role ?? u.role, p_status: patch.status ?? u.status }); toast('User updated', 'good'); load(); }
    catch (e) { toast(e.message, 'bad'); }
  }

  async function addHackathon(e) {
    e.preventDefault();
    try {
      await q(supabase.from('hackathons').insert({ ...hk, id: hk.id || hk.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60), registration_deadline: hk.registration_deadline || null, url: hk.url || null, created_by: profile.id }));
      toast('Hackathon added', 'good');
      setHk({ id: '', name: '', organizer: '', mode: 'online', registration_deadline: '', url: '', team_max: 4 });
    } catch (err) { toast(err.message, 'bad'); }
  }

  return (
    <div className="admin">
      <div className="page-head"><h1>Admin</h1><p>Manage users and hackathons. Every change here is checked again by the database.</p></div>
      {stats && (
        <dl className="stat-row">
          {[['users', 'Users'], ['onboarded', 'Finished setup'], ['active_7d', 'Active this week'], ['teams', 'Teams'], ['posts', 'Posts'], ['suspended', 'Suspended']].map(([k, l]) => (
            <div key={k}><dt>{l}</dt><dd>{stats[k]}</dd></div>
          ))}
        </dl>
      )}

      <section className="panel">
        <div className="section-head">
          <h2>Users</h2>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="inline-search">
            <label className="sr-only" htmlFor="us">Search users</label>
            <input id="us" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" />
            <button className="btn btn-quiet btn-sm">Search</button>
          </form>
        </div>
        {users === null ? <Spinner /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>User</th><th>Email</th><th>Level</th><th>Setup</th><th>Last seen</th><th>Role</th><th>Status</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><span className="cell-user"><Avatar src={u.avatar_url} name={u.full_name || u.email} size={30} />{u.handle ? <Link to={`/u/${u.handle}`}>{u.full_name}</Link> : u.full_name}</span></td>
                    <td>{u.email}</td>
                    <td>{u.level} <small className="muted">({u.xp} XP)</small></td>
                    <td>{u.onboarded ? 'Done' : 'Not yet'}</td>
                    <td>{u.last_seen_at ? timeAgo(u.last_seen_at) : 'Never'}</td>
                    <td>
                      <select aria-label={`Role for ${u.email}`} value={u.role} onChange={(e) => update(u, { role: e.target.value })}>
                        <option value="member">Member</option><option value="moderator">Moderator</option><option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>
                      <button className={`btn btn-sm ${u.status === 'active' ? 'btn-ghost' : 'btn-danger'}`} onClick={() => update(u, { status: u.status === 'active' ? 'suspended' : 'active' })}>
                        {u.status === 'active' ? 'Suspend' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {fb && (
        <section className="panel">
          <h2>Student feedback</h2>
          <dl className="stat-row">
            <div><dt>Matches rated</dt><dd>{fb.match_total}</dd></div>
            <div><dt>Rated good</dt><dd>{fb.match_total ? Math.round((100 * fb.match_helpful) / fb.match_total) : 0}%</dd></div>
            <div><dt>Feedback forms</dt><dd>{fb.general_total}</dd></div>
            <div><dt>Average rating</dt><dd>{fb.general_avg ?? '–'}/5</dd></div>
          </dl>
          {fb.recent.length === 0 ? <p className="muted">No written feedback yet.</p> : (
            <ul className="fb-list">
              {fb.recent.map((f) => (
                <li key={f.created_at + f.handle}><b>{f.rating}/5</b> {f.comment || <span className="muted">No comment</span>} <small className="muted">· <Link to={`/u/${f.handle}`}>{f.display_name}</Link>, {timeAgo(f.created_at)}</small></li>
              ))}
            </ul>
          )}
        </section>
      )}

      <form className="panel" onSubmit={addHackathon}>
        <h2>Add a hackathon</h2>
        <div className="form-grid">
          <label className="field wide"><span>Name</span><input value={hk.name} onChange={(e) => setHk({ ...hk, name: e.target.value })} required /></label>
          <label className="field"><span>Organizer</span><input value={hk.organizer} onChange={(e) => setHk({ ...hk, organizer: e.target.value })} /></label>
          <label className="field"><span>Mode</span><select value={hk.mode} onChange={(e) => setHk({ ...hk, mode: e.target.value })}><option value="online">Online</option><option value="offline">Offline</option><option value="hybrid">Hybrid</option></select></label>
          <label className="field"><span>Registration closes</span><input type="date" value={hk.registration_deadline} onChange={(e) => setHk({ ...hk, registration_deadline: e.target.value })} /></label>
          <label className="field"><span>Max team size</span><input type="number" min="1" max="10" value={hk.team_max} onChange={(e) => setHk({ ...hk, team_max: Number(e.target.value) })} /></label>
          <label className="field wide"><span>Website</span><input value={hk.url} onChange={(e) => setHk({ ...hk, url: e.target.value })} placeholder="https://…" /></label>
        </div>
        <div className="dialog-actions"><button className="btn btn-primary" disabled={!hk.name.trim()}>Add hackathon</button></div>
      </form>
    </div>
  );
}
