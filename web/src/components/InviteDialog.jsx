import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, q, rpc } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';

// Invite a builder into one of your teams
export default function InviteDialog({ target, onClose }) {
  const { profile } = useAuth();
  const toast = useToast();
  const ref = useRef(null);
  const [teams, setTeams] = useState(null);
  const [team, setTeam] = useState('');
  const [msg, setMsg] = useState(`Hi ${target.display_name.split(' ')[0]}, want to join our team?`);

  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => {
    q(supabase.from('team_members').select('team:teams(id,name,max_size,team_members(count))').eq('user_id', profile.id))
      .then((rows) => { const t = rows.map((r) => r.team); setTeams(t); if (t[0]) setTeam(t[0].id); })
      .catch((e) => toast(e.message, 'bad'));
  }, [profile.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e) {
    e.preventDefault();
    try {
      await rpc('send_team_request', { p_team: team, p_user: target.user_id || target.id, p_message: msg });
      toast(`Invite sent to ${target.display_name}`, 'good');
      onClose();
    } catch (err) { toast(err.message, 'bad'); }
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-labelledby="inv-title">
      <form onSubmit={send}>
        <h2 id="inv-title">Invite {target.display_name}</h2>
        {teams === null && <p className="muted">Loading your teams…</p>}
        {teams?.length === 0 && <p>You are not in a team yet. <Link to="/teams?new=1" onClick={onClose}>Create a team</Link> first, then invite.</p>}
        {teams?.length > 0 && (
          <>
            <label className="field"><span>Team</span>
              <select value={team} onChange={(e) => setTeam(e.target.value)}>
                {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.team_members[0].count}/{t.max_size})</option>)}
              </select>
            </label>
            <label className="field"><span>Message</span><textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={300} /></label>
            <p className="hint">Contact details unlock for both of you once they accept.</p>
          </>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn btn-quiet" onClick={onClose}>Cancel</button>
          {teams?.length > 0 && <button className="btn btn-primary">Send invite</button>}
        </div>
      </form>
    </dialog>
  );
}
