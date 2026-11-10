import { useEffect, useState } from 'react';
import { supabase, q } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { BadgeMedal, Spinner } from '../components/bits';

const GROUPS = [
  ['onboarding', 'Getting started'], ['skills', 'Skills and projects'], ['community', 'Community'],
  ['teams', 'Teams'], ['events', 'Hackathons'], ['special', 'Special'],
];

export default function Badges() {
  const { profile } = useAuth();
  const [badges, setBadges] = useState(null);
  const [earned, setEarned] = useState({});
  const [owners, setOwners] = useState({});

  useEffect(() => {
    q(supabase.from('badges').select('*').order('sort_order')).then(setBadges).catch(() => setBadges([]));
    q(supabase.from('user_badges').select('badge_code, awarded_at').eq('user_id', profile.id))
      .then((r) => setEarned(Object.fromEntries(r.map((x) => [x.badge_code, x.awarded_at])))).catch(() => {});
    q(supabase.from('user_badges').select('badge_code'))
      .then((r) => { const c = {}; r.forEach((x) => { c[x.badge_code] = (c[x.badge_code] || 0) + 1; }); setOwners(c); }).catch(() => {});
  }, [profile.id]);

  if (!badges) return <Spinner />;
  const got = Object.keys(earned).length;

  return (
    <div className="badges-page">
      <div className="page-head">
        <h1>Badges</h1>
        <p>You've unlocked {got} of {badges.length}. Pin up to three on your profile from Edit profile.</p>
        <div className="xpbar" role="progressbar" aria-valuenow={got} aria-valuemin={0} aria-valuemax={badges.length} aria-label="Badges unlocked"><span style={{ width: `${(100 * got) / badges.length}%` }} /></div>
      </div>
      {GROUPS.map(([cat, title]) => {
        const list = badges.filter((b) => b.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat}>
            <h2>{title}</h2>
            <ul className="badge-grid">
              {list.map((b) => (
                <li key={b.code} className={earned[b.code] ? 'earned' : 'locked'}>
                  <BadgeMedal badge={b} earned={!!earned[b.code]} size={56} />
                  <b>{b.name}</b>
                  <p>{b.description}</p>
                  <small>
                    {earned[b.code] ? `Unlocked ${new Date(earned[b.code]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : b.xp ? `+${b.xp} XP` : 'Milestone'}
                    {' · '}{owners[b.code] || 0} builder{owners[b.code] === 1 ? '' : 's'} have it
                  </small>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
