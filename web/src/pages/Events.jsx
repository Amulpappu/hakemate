import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { supabase, q } from '../lib/supabase';
import { Empty, Spinner, Chip } from '../components/bits';

const MODE = { online: 'Online', offline: 'In person', hybrid: 'Hybrid' };
export const fmtDate = (d) => d && new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Hackathons on Hakemate. Each one has its own page that an ACE event page can link to.
export default function Events() {
  const [list, setList] = useState(null);
  useEffect(() => {
    q(supabase.from('hackathons').select('id,name,organizer,mode,location,registration_deadline,team_min,team_max,domains,teams(count)')
      .order('registration_deadline', { nullsFirst: false }))
      .then(setList).catch(() => setList([]));
  }, []);

  return (
    <div className="events">
      <div className="page-head">
        <h1>Hackathons</h1>
        <p>Pick a hackathon to see its open teams and the teammates who fit its rules.</p>
      </div>
      {list === null ? <Spinner /> : list.length === 0 ? <Empty icon={CalendarDays} title="No hackathons yet">An admin can add one from the Admin page.</Empty> : (
        <div className="team-list">
          {list.map((h) => (
            <Link key={h.id} to={`/events/${h.id}`} className="team-row">
              <span className="team-mark event-mark" aria-hidden="true"><CalendarDays size={22} /></span>
              <span className="team-info">
                <b>{h.name}</b>
                <small>{[h.organizer, MODE[h.mode], h.location].filter(Boolean).join(' · ')}</small>
                <span className="chips">
                  {h.registration_deadline && <Chip tone="need">Register by {fmtDate(h.registration_deadline)}</Chip>}
                  <Chip tone="soft">Teams of {h.team_min}–{h.team_max}</Chip>
                  <Chip tone="soft">{h.teams?.[0]?.count || 0} teams</Chip>
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
