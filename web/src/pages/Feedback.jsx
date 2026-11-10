import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { supabase, q } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { timeAgo } from '../lib/constants';

const LABELS = ['', 'Not useful', 'Needs work', 'Okay', 'Good', 'Great'];

// Students tell us how team finding went, so we can improve the matching.
export default function Feedback() {
  const { profile } = useAuth();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState([]);

  const load = () => q(supabase.from('feedback').select('rating,comment,created_at').eq('user_id', profile.id).eq('kind', 'general').order('created_at', { ascending: false }))
    .then(setSent).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault();
    try {
      await q(supabase.from('feedback').insert({ kind: 'general', rating, comment: comment.trim() || null }));
      toast('Feedback sent. Thank you!', 'good');
      setRating(0); setComment('');
      load();
    } catch (err) { toast(err.message, 'bad'); }
  }

  return (
    <div className="feedback-page">
      <div className="page-head">
        <h1>Give feedback</h1>
        <p>How easy was it to find teammates? We read every answer and use it to improve the matching.</p>
      </div>

      <form className="panel" onSubmit={submit}>
        <fieldset className="group">
          <legend>How useful were your teammate suggestions?</legend>
          <div className="stars" role="radiogroup" aria-label="Rating out of 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} role="radio" aria-checked={rating === n} aria-label={`${n} out of 5, ${LABELS[n]}`}
                className={`star ${n <= rating ? 'star-on' : ''}`} onClick={() => setRating(n)}>
                <Star size={28} aria-hidden="true" />
              </button>
            ))}
            <span className="star-label">{LABELS[rating]}</span>
          </div>
        </fieldset>
        <label className="field">
          <span>What was hard, or what should we change? (optional)</span>
          <textarea rows={4} maxLength={600} value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="e.g. I want to filter by college, or the matches were all from other cities" />
        </label>
        <div className="dialog-actions"><button className="btn btn-primary" disabled={!rating}>Send feedback</button></div>
      </form>

      <p className="hint">You can also tap 👍 or 👎 on any suggested teammate to tell us if the match was good.</p>

      {sent.length > 0 && (
        <section className="panel">
          <h2>Your earlier feedback</h2>
          <ul className="fb-list">
            {sent.map((f) => (
              <li key={f.created_at}><b>{f.rating}/5</b> {f.comment || <span className="muted">No comment</span>} <small className="muted">{timeAgo(f.created_at)}</small></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
