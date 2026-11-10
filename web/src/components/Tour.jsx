import { useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rpc } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';

// Coach-mark tour of the community. Each step highlights a nav item.
const STEPS = [
  { target: 'nav-home', path: '/home', title: 'Your base', text: 'Your level, your next badges and the best matches for you today live here.' },
  { target: 'nav-discover', path: '/discover', title: 'Find teammates', text: 'Every builder gets a Team DNA score out of 100. The coloured strand shows why: missing skill, meaning, free time, location and experience.' },
  { target: 'nav-events', path: '/events', title: 'Pick a hackathon', text: 'Each hackathon shows its open teams and the teammates who fit its rules: online or in person, team size, and people who are still free.' },
  { target: 'nav-teams', path: '/teams', title: 'Build a team', text: 'Create a team, invite people, and work together with team chat and a shared task list. Contact details unlock only once both sides accept.' },
  { target: 'nav-community', path: '/community', title: 'The community', text: 'Post updates, show off projects, ask questions and give kudos. Join hubs like AI & ML or Hardware & IoT to meet builders in your area.' },
  { target: 'nav-leaderboard', path: '/leaderboard', title: 'Earn XP', text: 'Posting, helping, endorsing and teaming up earn XP. Level up and climb the weekly leaderboard.' },
  { target: 'nav-badges', path: '/badges', title: 'Collect badges', text: 'Unlock badges like Squad Up, Helping Hand and Crowd Favourite. Pin your best three to your profile.' },
];

export default function Tour({ onDone }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const nav = useNavigate();
  const { refresh } = useAuth();
  const toast = useToast();
  const step = STEPS[i];

  useEffect(() => { nav(step.path); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const place = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [i, step.target]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') finish(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function finish() {
    try { await rpc('finish_tour'); toast('Tour complete. Navigator badge unlocked.', 'good'); } catch { /* already done */ }
    await refresh();
    onDone?.();
    nav('/home');
  }

  const narrow = typeof window !== 'undefined' && window.innerWidth < 860;
  const pos = rect && !narrow
    ? { top: Math.min(rect.top, window.innerHeight - 260), left: rect.right + 18 }
    : { bottom: 24, left: 16, right: 16 };

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect && !narrow && <div className="tour-spot" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }} />}
      <div className="tour-card" style={pos}>
        <p className="tour-count">Step {i + 1} of {STEPS.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p>{step.text}</p>
        <div className="tour-actions">
          <button className="btn btn-ghost" onClick={finish}>Skip tour</button>
          {i > 0 && <button className="btn btn-quiet" onClick={() => setI(i - 1)}>Back</button>}
          {i < STEPS.length - 1
            ? <button className="btn btn-primary" onClick={() => setI(i + 1)} autoFocus>Next</button>
            : <button className="btn btn-primary" onClick={finish} autoFocus>Finish tour</button>}
        </div>
      </div>
    </div>
  );
}
