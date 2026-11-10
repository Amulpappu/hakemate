import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Avatar, Empty, Spinner } from '../components/bits';

const RANGES = [{ d: 7, label: 'This week' }, { d: 30, label: 'This month' }, { d: 365, label: 'This year' }];

export default function Leaderboard() {
  const { profile } = useAuth();
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState(null);
  useEffect(() => { setRows(null); rpc('leaderboard', { p_days: days, p_limit: 50 }).then(setRows).catch(() => setRows([])); }, [days]);

  return (
    <div className="leaderboard">
      <div className="page-head row">
        <div><h1>Leaderboard</h1><p>XP earned by posting, helping, endorsing and teaming up.</p></div>
        <div className="tabs" role="tablist">
          {RANGES.map((r) => <button key={r.d} role="tab" aria-selected={days === r.d} onClick={() => setDays(r.d)}>{r.label}</button>)}
        </div>
      </div>
      {rows === null ? <Spinner /> : rows.length === 0 ? <Empty icon={Trophy} title="No XP earned in this period yet">Post in the community or join a team to get on the board.</Empty> : (
        <ol className="board">
          {rows.map((r, i) => (
            <li key={r.user_id} className={`${i < 3 ? 'top top-' + (i + 1) : ''} ${r.user_id === profile.id ? 'is-me' : ''}`}>
              <span className="rank">{i + 1}</span>
              <Avatar src={r.avatar_url} name={r.display_name} size={40} />
              <span className="who"><Link to={`/u/${r.handle}`}>{r.display_name}</Link><small>{r.college || 'College not set'} · Level {r.level}</small></span>
              <b className="pts">{r.xp_gained} XP</b>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
