import { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';
import { supabase, q } from '../lib/supabase';
import { useToast } from './Toast';
import { Avatar } from './bits';

const COLS = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'Doing' },
  { id: 'done', label: 'Done' },
];
const ORDER = COLS.map((c) => c.id);

// Shared task list for the team: add, assign, move between To do / Doing / Done.
export default function TaskBoard({ teamId, members }) {
  const toast = useToast();
  const [tasks, setTasks] = useState(null);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const people = Object.fromEntries(members.map((m) => [m.member.id, m.member]));

  const load = () => q(supabase.from('team_tasks').select('*').eq('team_id', teamId).order('created_at'))
    .then(setTasks).catch((e) => { setTasks([]); toast(e.message, 'bad'); });

  useEffect(() => {
    load();
    const ch = supabase.channel('tasks-' + teamId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_tasks', filter: `team_id=eq.${teamId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(e) {
    e.preventDefault();
    try {
      await q(supabase.from('team_tasks').insert({ team_id: teamId, title: title.trim(), assignee_id: assignee || null, due_on: due || null }));
      setTitle(''); setAssignee(''); setDue('');
      load();
    } catch (err) { toast(err.message, 'bad'); }
  }

  async function patch(t, change) {
    setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, ...change } : x)));
    try {
      await q(supabase.from('team_tasks').update(change).eq('id', t.id));
      if (change.status === 'done') toast('Task done. +5 XP', 'good');
    } catch (err) { toast(err.message, 'bad'); load(); }
  }

  async function remove(t) {
    if (!window.confirm(`Delete the task "${t.title}"?`)) return;
    try { await q(supabase.from('team_tasks').delete().eq('id', t.id)); load(); } catch (err) { toast(err.message, 'bad'); }
  }

  return (
    <section className="panel" id="tasks" aria-labelledby="tasks-h">
      <h2 id="tasks-h">Team tasks</h2>
      <form className="task-add" onSubmit={add}>
        <label className="field grow"><span>New task</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Make the pitch deck" required />
        </label>
        <label className="field"><span>Who</span>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Anyone</option>
            {members.map(({ member: m }) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        </label>
        <label className="field"><span>Due</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        <button className="btn btn-primary" disabled={!title.trim()}><Plus size={17} aria-hidden="true" />Add task</button>
      </form>

      {tasks === null ? <p className="muted">Loading tasks…</p> : (
        <div className="taskboard">
          {COLS.map((col) => {
            const list = tasks.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className={`board-col col-${col.id}`}>
                <h3>{col.label} <span className="count">{list.length}</span></h3>
                {list.length === 0 && <p className="board-empty">Nothing here</p>}
                <ul>
                  {list.map((t) => {
                    const who = t.assignee_id && people[t.assignee_id];
                    const i = ORDER.indexOf(t.status);
                    const late = t.due_on && t.status !== 'done' && new Date(t.due_on) < new Date(new Date().toDateString());
                    return (
                      <li key={t.id} className="task">
                        <p className="task-title">{t.title}</p>
                        <div className="task-meta">
                          {who ? <span className="task-who"><Avatar src={who.avatar_url} name={who.display_name} size={22} />{who.display_name.split(' ')[0]}</span> : <span className="muted">Anyone</span>}
                          {t.due_on && <span className={late ? 'late' : 'muted'}>{late ? 'Overdue · ' : 'Due '}{new Date(t.due_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                        </div>
                        <div className="task-actions">
                          {i > 0 && <button className="icon-btn sm" onClick={() => patch(t, { status: ORDER[i - 1] })} aria-label={`Move "${t.title}" back to ${COLS[i - 1].label}`}><ArrowLeft size={16} /></button>}
                          {i < 2 && <button className="btn btn-quiet btn-sm" onClick={() => patch(t, { status: ORDER[i + 1] })}>{i === 0 ? 'Start' : 'Mark done'}<ArrowRight size={15} aria-hidden="true" /></button>}
                          <button className="icon-btn sm" onClick={() => remove(t)} aria-label={`Delete "${t.title}"`}><Trash2 size={16} /></button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
