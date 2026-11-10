import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { supabase, q } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Empty, Spinner } from '../components/bits';
import { timeAgo } from '../lib/constants';

export default function Notifications() {
  const { profile } = useAuth();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    q(supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(60)).then((r) => {
      setRows(r);
      if (r.some((x) => !x.read)) supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false).then(() => {});
    }).catch(() => setRows([]));
  }, [profile.id]);

  return (
    <div className="notifications">
      <div className="page-head"><h1>Notifications</h1></div>
      {rows === null ? <Spinner /> : rows.length === 0 ? <Empty icon={Bell} title="Nothing yet">Invites, kudos, new followers and badges show up here.</Empty> : (
        <ul className="notif-list">
          {rows.map((n) => (
            <li key={n.id} className={n.read ? '' : 'unread'}>
              <span className={`notif-kind k-${n.kind}`} aria-hidden="true" />
              <div>
                {n.link ? <Link to={n.link}>{n.title}</Link> : <b>{n.title}</b>}
                {n.body && <p>{n.body}</p>}
              </div>
              <small>{timeAgo(n.created_at)}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
