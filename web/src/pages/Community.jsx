import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
import { supabase, q } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import PostCard, { POST_SELECT } from '../components/PostCard';
import { Avatar, Empty, Spinner } from '../components/bits';
import { POST_KINDS, iconFor } from '../lib/constants';

function Composer({ hubs, defaultHub, onPosted }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [body, setBody] = useState('');
  const [kind, setKind] = useState('update');
  const [hub, setHub] = useState(defaultHub || '');
  const [tags, setTags] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setHub(defaultHub || ''), [defaultHub]);

  async function post(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await q(supabase.from('posts').insert({
        author_id: profile.id, body: body.trim(), kind, hub_slug: hub || null,
        tags: tags.split(/[,\s]+/).map((t) => t.replace(/^#/, '').toLowerCase()).filter(Boolean).slice(0, 6),
        link_url: link.trim() || null,
      }));
      setBody(''); setTags(''); setLink(''); setKind('update');
      toast('Posted. +10 XP', 'good');
      onPosted();
    } catch (err) { toast(err.message.includes('link_url') ? 'Links must start with https://' : err.message, 'bad'); }
    finally { setBusy(false); }
  }

  return (
    <form className="composer panel" onSubmit={post}>
      <div className="composer-row">
        <Avatar src={profile.avatar_url} name={profile.display_name} size={40} />
        <label className="sr-only" htmlFor="post-body">Write a post</label>
        <textarea id="post-body" rows={body ? 4 : 2} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000}
          placeholder="Share what you're building, ask for help, or say you're looking for a team" />
      </div>
      {body && (
        <div className="composer-opts">
          <div className="pills" role="radiogroup" aria-label="Post type">
            {POST_KINDS.map((k) => <button type="button" key={k.id} role="radio" aria-checked={kind === k.id} className="pill" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>)}
          </div>
          <div className="form-grid">
            <label className="field"><span>Hub</span><select value={hub} onChange={(e) => setHub(e.target.value)}><option value="">No hub</option>{hubs.map((h) => <option key={h.slug} value={h.slug}>{h.name}</option>)}</select></label>
            <label className="field"><span>Tags</span><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="react, iot" /></label>
            <label className="field wide"><span>Link (optional)</span><input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://github.com/you/project" /></label>
          </div>
          <div className="dialog-actions"><button className="btn btn-primary" disabled={busy || !body.trim()}>{busy ? 'Posting…' : 'Post'}</button></div>
        </div>
      )}
    </form>
  );
}

export default function Community() {
  const { profile } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const hubSlug = params.get('hub') || '';
  const [feed, setFeed] = useState(params.get('feed') || 'all');
  const [kind, setKind] = useState('');
  const [posts, setPosts] = useState(null);
  const [kudoed, setKudoed] = useState(new Set());
  const [hubs, setHubs] = useState([]);
  const [joined, setJoined] = useState(new Set());
  const [fresh, setFresh] = useState(0);

  const loadHubs = useCallback(async () => {
    setHubs(await q(supabase.from('hubs').select('*, hub_members(count)').order('sort_order')));
    const j = await q(supabase.from('hub_members').select('hub_slug').eq('user_id', profile.id));
    setJoined(new Set(j.map((x) => x.hub_slug)));
  }, [profile.id]);

  const load = useCallback(async () => {
    setFresh(0);
    let query = supabase.from('posts').select(POST_SELECT).order('created_at', { ascending: false }).limit(40);
    if (hubSlug) query = query.eq('hub_slug', hubSlug);
    if (kind) query = query.eq('kind', kind);
    if (feed === 'following') {
      const f = await q(supabase.from('follows').select('followee_id').eq('follower_id', profile.id));
      const ids = [profile.id, ...f.map((x) => x.followee_id)];
      query = query.in('author_id', ids);
    }
    try {
      const rows = await q(query);
      setPosts(rows);
      if (rows.length) {
        const k = await q(supabase.from('post_kudos').select('post_id').eq('user_id', profile.id).in('post_id', rows.map((p) => p.id)));
        setKudoed(new Set(k.map((x) => x.post_id)));
      }
    } catch (e) { toast(e.message, 'bad'); setPosts([]); }
  }, [hubSlug, kind, feed, profile.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadHubs().catch(() => {}); }, [loadHubs]);
  useEffect(() => { setPosts(null); load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel('feed').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' },
      (p) => { if (p.new.author_id !== profile.id) setFresh((n) => n + 1); }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile.id]);

  async function toggleHub(slug) {
    try {
      if (joined.has(slug)) await q(supabase.from('hub_members').delete().eq('hub_slug', slug).eq('user_id', profile.id));
      else { await q(supabase.from('hub_members').insert({ hub_slug: slug, user_id: profile.id })); toast('Joined. +5 XP', 'good'); }
      loadHubs();
    } catch (e) { toast(e.message, 'bad'); }
  }

  const hub = hubs.find((h) => h.slug === hubSlug);
  const HubIcon = hub ? iconFor(hub.icon) : MessagesSquare;

  return (
    <div className="community">
      <div className="feed-col">
        <div className="page-head">
          {hub ? (
            <div className="hub-head" style={{ '--hub': hub.color }}>
              <span className="hub-icon"><HubIcon size={26} aria-hidden="true" /></span>
              <div><h1>{hub.name}</h1><p>{hub.description} · {hub.hub_members[0].count} members</p></div>
              <button className={`btn ${joined.has(hub.slug) ? 'btn-quiet' : 'btn-primary'}`} onClick={() => toggleHub(hub.slug)}>{joined.has(hub.slug) ? 'Leave hub' : 'Join hub'}</button>
            </div>
          ) : (<><h1>Community</h1><p>Updates, showcases and questions from builders across colleges.</p></>)}
        </div>

        <Composer hubs={hubs} defaultHub={hubSlug} onPosted={load} />

        <div className="feed-tabs">
          <div className="tabs" role="tablist">
            {[['all', 'Everyone'], ['following', 'Following']].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={feed === id} onClick={() => { setFeed(id); }}>{label}</button>
            ))}
          </div>
          <label className="field field-inline"><span>Show</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">All posts</option>{POST_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </label>
        </div>

        {fresh > 0 && <button className="fresh" onClick={load}>{fresh} new post{fresh > 1 ? 's' : ''}. Show them</button>}

        {posts === null ? <Spinner /> : posts.length === 0 ? (
          <Empty icon={MessagesSquare} title={feed === 'following' ? 'Nothing from people you follow yet' : 'No posts here yet'}>
            {feed === 'following' ? 'Follow builders from their profile to fill this feed.' : 'Write the first one. Your first post unlocks the Hello World badge.'}
          </Empty>
        ) : posts.map((p) => <PostCard key={p.id} post={p} kudoed={kudoed.has(p.id)} onChange={load} />)}
      </div>

      <aside className="hub-col">
        <section className="panel">
          <h2>Hubs</h2>
          <ul className="hub-list">
            <li><button className={!hubSlug ? 'on' : ''} onClick={() => setParams({})}><i style={{ background: 'var(--ink)' }} /><span><b>All hubs</b></span></button></li>
            {hubs.map((h) => {
              const Icon = iconFor(h.icon);
              return (
                <li key={h.slug}>
                  <button className={hubSlug === h.slug ? 'on' : ''} onClick={() => setParams({ hub: h.slug })}>
                    <i style={{ background: h.color }}><Icon size={14} aria-hidden="true" /></i>
                    <span><b>{h.name}</b><small>{h.hub_members[0].count} members{joined.has(h.slug) ? ' · joined' : ''}</small></span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="hint">Join 3 hubs to unlock the Explorer badge.</p>
        </section>
      </aside>
    </div>
  );
}
