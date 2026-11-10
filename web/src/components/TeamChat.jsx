import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { supabase, q } from '../lib/supabase';
import { useToast } from './Toast';
import { Avatar } from './bits';

const time = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// Live team chat. Only team members can read or send (checked by the database).
export default function TeamChat({ teamId, members, me }) {
  const toast = useToast();
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const people = Object.fromEntries(members.map((m) => [m.member.id, m.member]));

  useEffect(() => {
    let alive = true;
    q(supabase.from('team_messages').select('id,author_id,body,created_at').eq('team_id', teamId)
      .order('created_at', { ascending: false }).limit(100))
      .then((rows) => alive && setMsgs(rows.reverse()))
      .catch((e) => { setMsgs([]); toast(e.message, 'bad'); });

    const ch = supabase.channel('chat-' + teamId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `team_id=eq.${teamId}` },
        ({ new: m }) => setMsgs((cur) => (cur && !cur.some((x) => x.id === m.id) ? [...cur, m] : cur)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'team_messages' },
        ({ old }) => setMsgs((cur) => cur && cur.filter((x) => x.id !== old.id)))
      .subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs?.length]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const m = await q(supabase.from('team_messages').insert({ team_id: teamId, body }).select('id,author_id,body,created_at').single());
      setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      setText('');
    } catch (err) { toast(err.message, 'bad'); }
    setSending(false);
  }

  return (
    <section className="panel chat" id="chat" aria-labelledby="chat-h">
      <h2 id="chat-h">Team chat</h2>
      <p className="hint">Only members of this team can see these messages.</p>
      <ol className="chat-list" ref={listRef} aria-live="polite">
        {msgs === null && <li className="muted">Loading messages…</li>}
        {msgs?.length === 0 && <li className="chat-empty">No messages yet. Say hello and share your idea.</li>}
        {msgs?.map((m) => {
          const who = people[m.author_id] || { display_name: 'Former member' };
          const mine = m.author_id === me;
          return (
            <li key={m.id} className={`msg ${mine ? 'msg-me' : ''}`}>
              {!mine && <Avatar src={who.avatar_url} name={who.display_name} size={30} />}
              <div className="msg-bubble">
                {!mine && <b>{who.display_name}</b>}
                <p>{m.body}</p>
                <time dateTime={m.created_at}>{time(m.created_at)}</time>
              </div>
            </li>
          );
        })}
      </ol>
      <form className="chat-send" onSubmit={send}>
        <label className="sr-only" htmlFor="chat-input">Message</label>
        <input id="chat-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Write a message" autoComplete="off" />
        <button className="btn btn-primary" disabled={sending || !text.trim()}><Send size={17} aria-hidden="true" />Send</button>
      </form>
    </section>
  );
}
