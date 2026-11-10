import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { rpc } from '../lib/supabase';
import { Avatar, DnaStrand, ScoreBadge, Chip } from './bits';

const EXP = { first_timer: 'First hackathon', some: 'A few hackathons', veteran: 'Veteran' };

// One shared fetch of "which matches did I already rate", reused by every card on the page
let ratingsPromise = null;
function myRatings() {
  if (!ratingsPromise) {
    ratingsPromise = rpc('my_match_ratings')
      .then((rows) => Object.fromEntries(rows.map((r) => [r.about_user, r.helpful])))
      .catch(() => ({}));
  }
  return ratingsPromise;
}

// Student feedback on each suggestion, used to improve the matching
function RateMatch({ userId, name }) {
  const [rated, setRated] = useState(undefined);
  useEffect(() => { myRatings().then((r) => setRated(r[userId])); }, [userId]);

  async function rate(helpful) {
    const before = rated;
    setRated(helpful);
    try {
      await rpc('rate_match', { p_user: userId, p_helpful: helpful });
      ratingsPromise = myRatings().then((r) => ({ ...r, [userId]: helpful }));
    } catch { setRated(before); }
  }

  return (
    <span className="rate" role="group" aria-label={`Was ${name} a good suggestion?`}>
      <span className="rate-q">{rated === undefined ? 'Good match?' : 'Thanks!'}</span>
      <button type="button" className={`icon-btn sm ${rated === true ? 'on-good' : ''}`} aria-pressed={rated === true} aria-label="Yes, good match" onClick={() => rate(true)}><ThumbsUp size={16} /></button>
      <button type="button" className={`icon-btn sm ${rated === false ? 'on-bad' : ''}`} aria-pressed={rated === false} aria-label="No, not a good match" onClick={() => rate(false)}><ThumbsDown size={16} /></button>
    </span>
  );
}

export default function MatchCard({ m, action }) {
  const [why, setWhy] = useState(false);
  return (
    <article className="match">
      <div className="match-top">
        <Link to={`/u/${m.handle}`} className="match-who">
          <Avatar src={m.avatar_url} name={m.display_name} size={52} />
          <span>
            <b>{m.display_name}</b>
            <small>{m.headline || [m.college, m.city].filter(Boolean).join(', ')}</small>
          </span>
        </Link>
        <ScoreBadge score={m.score} />
      </div>
      <DnaStrand m={m} showLegend={why} />
      <div className="match-cats">
        {m.is_sample && <Chip tone="sample">Sample profile</Chip>}
        {m.categories?.map((c) => <Chip key={c}>{c}</Chip>)}
        <Chip tone="soft">Level {m.level}</Chip>
        <Chip tone="soft">{EXP[m.experience_level]}</Chip>
      </div>
      {m.reasons?.length > 0 && (
        <ul className="reasons">
          {m.reasons.slice(0, why ? 8 : 2).map((r) => <li key={r}><Check size={15} aria-hidden="true" />{r}</li>)}
        </ul>
      )}
      <div className="match-actions">
        <button className="btn btn-quiet btn-sm" onClick={() => setWhy(!why)} aria-expanded={why}>
          {why ? 'Hide score details' : 'Why this score?'}
        </button>
        {action}
      </div>
      <div className="match-foot"><RateMatch userId={m.user_id} name={m.display_name} /></div>
    </article>
  );
}
