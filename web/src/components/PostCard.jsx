import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Trash2, ExternalLink } from 'lucide-react';
import { supabase, q } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { POST_KINDS, timeAgo } from '../lib/constants';
import { Avatar } from './bits';
import { useToast } from './Toast';

export const POST_SELECT = '*, author:profiles!posts_author_id_fkey(id,handle,display_name,avatar_url,level), hub:hubs(slug,name,color)';

export default function PostCard({ post, kudoed, onChange }) {
  const { profile, account } = useAuth();
  const toast = useToast();
  const [liked, setLiked] = useState(kudoed);
  const [count, setCount] = useState(post.kudos_count);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState(null);
  const [reply, setReply] = useState('');
  const kind = POST_KINDS.find((k) => k.id === post.kind);

  async function toggleKudos() {
    try {
      if (liked) {
        await q(supabase.from('post_kudos').delete().eq('post_id', post.id).eq('user_id', profile.id));
        setLiked(false); setCount((c) => c - 1);
      } else {
        await q(supabase.from('post_kudos').insert({ post_id: post.id, user_id: profile.id }));
        setLiked(true); setCount((c) => c + 1);
      }
    } catch (e) { toast(e.message, 'bad'); }
  }

  async function loadComments() {
    setOpen(!open);
    if (comments) return;
    const rows = await q(supabase.from('post_comments')
      .select('*, author:profiles!post_comments_author_id_fkey(handle,display_name,avatar_url)')
      .eq('post_id', post.id).order('created_at'));
    setComments(rows);
  }

  async function sendReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    try {
      const row = await q(supabase.from('post_comments')
        .insert({ post_id: post.id, author_id: profile.id, body: reply.trim() })
        .select('*, author:profiles!post_comments_author_id_fkey(handle,display_name,avatar_url)').single());
      setComments((c) => [...(c || []), row]);
      setReply('');
    } catch (err) { toast(err.message, 'bad'); }
  }

  async function remove() {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try { await q(supabase.from('posts').delete().eq('id', post.id)); onChange?.(); toast('Post deleted'); }
    catch (e) { toast(e.message, 'bad'); }
  }

  const canDelete = post.author_id === profile?.id || ['admin', 'moderator'].includes(account?.role);

  return (
    <article className={`post post-${post.kind}`} id={post.id}>
      <header className="post-head">
        <Link to={`/u/${post.author.handle}`}><Avatar src={post.author.avatar_url} name={post.author.display_name} size={40} /></Link>
        <div>
          <Link to={`/u/${post.author.handle}`} className="post-author">{post.author.display_name}</Link>
          <span className="post-meta">
            Level {post.author.level} · {timeAgo(post.created_at)}
            {post.hub && <> · in <Link to={`/community?hub=${post.hub.slug}`}>{post.hub.name}</Link></>}
          </span>
        </div>
        {post.kind !== 'update' && <span className={`kind kind-${post.kind}`}>{kind?.label}</span>}
      </header>
      <p className="post-body">{post.body}</p>
      {post.link_url && <a className="post-link" href={post.link_url} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true" />{new URL(post.link_url).hostname}</a>}
      {post.tags?.length > 0 && <div className="tags">{post.tags.map((t) => <span key={t}>#{t}</span>)}</div>}
      <footer className="post-actions">
        <button className={`act ${liked ? 'act-on' : ''}`} onClick={toggleKudos} aria-pressed={liked}>
          <Heart size={17} aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />{count} kudos
        </button>
        <button className="act" onClick={loadComments} aria-expanded={open}>
          <MessageCircle size={17} aria-hidden="true" />{post.comment_count + (comments ? comments.length - Math.min(comments.length, post.comment_count) : 0)} replies
        </button>
        {canDelete && <button className="act act-danger" onClick={remove} aria-label="Delete post"><Trash2 size={16} aria-hidden="true" /></button>}
      </footer>
      {open && (
        <div className="comments">
          {comments === null && <p className="muted">Loading replies…</p>}
          {comments?.map((c) => (
            <div key={c.id} className="comment">
              <Avatar src={c.author.avatar_url} name={c.author.display_name} size={28} />
              <div><Link to={`/u/${c.author.handle}`}>{c.author.display_name}</Link><p>{c.body}</p></div>
            </div>
          ))}
          <form onSubmit={sendReply} className="reply">
            <label className="sr-only" htmlFor={`r-${post.id}`}>Write a reply</label>
            <input id={`r-${post.id}`} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply" maxLength={800} />
            <button className="btn btn-primary btn-sm" disabled={!reply.trim()}>Reply</button>
          </form>
        </div>
      )}
    </article>
  );
}
