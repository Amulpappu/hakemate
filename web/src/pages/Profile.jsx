import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Github, Linkedin, Globe, MapPin, GraduationCap, Pencil, UserPlus, UserCheck, Plus, ExternalLink } from 'lucide-react';
import { supabase, q, rpc } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { LevelAvatar, BadgeMedal, Chip, Spinner, Empty } from '../components/bits';
import Heatmap from '../components/Heatmap';
import PostCard, { POST_SELECT } from '../components/PostCard';
import InviteDialog from '../components/InviteDialog';
import { AVAILABILITY, levelProgress } from '../lib/constants';

const EXP = { first_timer: 'First hackathon coming up', some: 'A few hackathons done', veteran: 'Hackathon veteran' };
const LV = ['', 'Learning', 'Comfortable', 'Strong'];

function ProjectForm({ onSaved, onCancel }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ name: '', description: '', tech: '', repo_url: '', demo_url: '' });
  async function save(e) {
    e.preventDefault();
    try {
      await q(supabase.from('projects').insert({
        profile_id: profile.id, name: f.name.trim(), description: f.description.trim() || null,
        tech: f.tech.split(',').map((t) => t.trim()).filter(Boolean), repo_url: f.repo_url.trim() || null, demo_url: f.demo_url.trim() || null,
      }));
      toast('Project added. +10 XP', 'good');
      onSaved();
    } catch (err) { toast(err.message.includes('_url') ? 'Links must start with https://' : err.message, 'bad'); }
  }
  return (
    <form className="panel" onSubmit={save}>
      <div className="form-grid">
        <label className="field"><span>Project name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={80} /></label>
        <label className="field"><span>Built with</span><input value={f.tech} onChange={(e) => setF({ ...f, tech: e.target.value })} placeholder="React, Supabase" /></label>
        <label className="field wide"><span>What it does</span><textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={300} /></label>
        <label className="field"><span>Code link</span><input value={f.repo_url} onChange={(e) => setF({ ...f, repo_url: e.target.value })} placeholder="https://github.com/…" /></label>
        <label className="field"><span>Live demo</span><input value={f.demo_url} onChange={(e) => setF({ ...f, demo_url: e.target.value })} placeholder="https://…" /></label>
      </div>
      <div className="dialog-actions"><button type="button" className="btn btn-quiet" onClick={onCancel}>Cancel</button><button className="btn btn-primary">Add project</button></div>
    </form>
  );
}

export default function Profile() {
  const { handle } = useParams();
  const { profile: me } = useAuth();
  const toast = useToast();
  const [p, setP] = useState(null);
  const [missing, setMissing] = useState(false);
  const [skills, setSkills] = useState([]);
  const [endorse, setEndorse] = useState({});
  const [badges, setBadges] = useState([]);
  const [projects, setProjects] = useState([]);
  const [posts, setPosts] = useState([]);
  const [heat, setHeat] = useState([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0, teams: 0 });
  const [following, setFollowing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [invite, setInvite] = useState(false);

  const isMe = !handle || handle === me?.handle;

  const load = useCallback(async () => {
    try {
      const prof = isMe ? me : (await q(supabase.from('profiles').select('*').eq('handle', handle).maybeSingle()));
      if (!prof) { setMissing(true); return; }
      const fresh = isMe ? await q(supabase.from('profiles').select('*').eq('id', me.id).single()) : prof;
      setP(fresh);
      const id = fresh.id;
      const [sk, en, ub, pr, po, hm, f1, f2, tm, mine] = await Promise.all([
        q(supabase.from('profile_skills').select('level, skill:skills(id,name,category)').eq('profile_id', id)),
        q(supabase.from('endorsements').select('skill_id, endorser_id').eq('profile_id', id)),
        q(supabase.from('user_badges').select('awarded_at, badge:badges(*)').eq('user_id', id).order('awarded_at', { ascending: false })),
        q(supabase.from('projects').select('*').eq('profile_id', id).order('created_at', { ascending: false })),
        q(supabase.from('posts').select(POST_SELECT).eq('author_id', id).order('created_at', { ascending: false }).limit(5)),
        rpc('activity_heatmap', { p_user: id }),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
        supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('user_id', id),
        isMe ? Promise.resolve([]) : q(supabase.from('follows').select('followee_id').eq('follower_id', me.id).eq('followee_id', id)),
      ]);
      setSkills(sk.sort((a, b) => b.level - a.level));
      const e = {}; en.forEach((x) => { (e[x.skill_id] ||= []).push(x.endorser_id); }); setEndorse(e);
      setBadges(ub); setProjects(pr); setPosts(po); setHeat(hm);
      setCounts({ followers: f1.count || 0, following: f2.count || 0, teams: tm.count || 0 });
      setFollowing(mine.length > 0);
    } catch (err) { toast(err.message, 'bad'); }
  }, [handle, isMe, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setP(null); setMissing(false); load(); }, [load]);

  if (missing) return <Empty title="No builder with that username">Check the link, or search from Find teammates.</Empty>;
  if (!p) return <Spinner />;

  async function toggleFollow() {
    try {
      if (following) await q(supabase.from('follows').delete().eq('follower_id', me.id).eq('followee_id', p.id));
      else await q(supabase.from('follows').insert({ follower_id: me.id, followee_id: p.id }));
      setFollowing(!following);
      setCounts((c) => ({ ...c, followers: c.followers + (following ? -1 : 1) }));
    } catch (e) { toast(e.message, 'bad'); }
  }

  async function toggleEndorse(skillId) {
    const mine = endorse[skillId]?.includes(me.id);
    try {
      if (mine) await q(supabase.from('endorsements').delete().eq('endorser_id', me.id).eq('profile_id', p.id).eq('skill_id', skillId));
      else await q(supabase.from('endorsements').insert({ endorser_id: me.id, profile_id: p.id, skill_id: skillId }));
      setEndorse((e) => ({ ...e, [skillId]: mine ? e[skillId].filter((x) => x !== me.id) : [...(e[skillId] || []), me.id] }));
    } catch (err) { toast(err.message, 'bad'); }
  }

  const showcase = p.showcase_badges?.length
    ? p.showcase_badges.map((c) => badges.find((b) => b.badge.code === c)).filter(Boolean)
    : badges.slice(0, 3);
  const { hi } = levelProgress(p.xp, p.level);

  return (
    <div className="profile">
      <section className="profile-hero">
        <LevelAvatar profile={p} size={104} />
        <div className="profile-id">
          <h1>{p.display_name}</h1>
          <p className="handle">@{p.handle}{p.is_sample && <span className="chip chip-sample">Sample profile for testing</span>}</p>
          {p.headline && <p className="headline">{p.headline}</p>}
          <p className="facts">
            {p.college && <span><GraduationCap size={16} aria-hidden="true" />{p.college}{p.year_of_study && `, ${p.year_of_study}`}</span>}
            {p.city && <span><MapPin size={16} aria-hidden="true" />{[p.city, p.state].filter(Boolean).join(', ')}</span>}
          </p>
          <p className="links">
            {p.github_url && <a href={p.github_url} target="_blank" rel="noreferrer"><Github size={16} aria-hidden="true" />GitHub</a>}
            {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noreferrer"><Linkedin size={16} aria-hidden="true" />LinkedIn</a>}
            {p.portfolio_url && <a href={p.portfolio_url} target="_blank" rel="noreferrer"><Globe size={16} aria-hidden="true" />Portfolio</a>}
          </p>
        </div>
        <div className="profile-side">
          <div className="level-box"><b>Level {p.level}</b><small>{p.xp} XP · {hi - p.xp} to next</small></div>
          <dl className="stats">
            <div><dt>Followers</dt><dd>{counts.followers}</dd></div>
            <div><dt>Following</dt><dd>{counts.following}</dd></div>
            <div><dt>Teams</dt><dd>{counts.teams}</dd></div>
            <div><dt>Badges</dt><dd>{badges.length}</dd></div>
          </dl>
          <div className="profile-actions">
            {isMe ? <Link className="btn btn-quiet" to="/settings"><Pencil size={16} aria-hidden="true" />Edit profile</Link> : (
              <>
                <button className={`btn ${following ? 'btn-quiet' : 'btn-primary'}`} onClick={toggleFollow} aria-pressed={following}>
                  {following ? <><UserCheck size={16} aria-hidden="true" />Following</> : <><UserPlus size={16} aria-hidden="true" />Follow</>}
                </button>
                <button className="btn btn-quiet" onClick={() => setInvite(true)}>Invite to team</button>
              </>
            )}
          </div>
        </div>
      </section>

      {showcase.length > 0 && (
        <section className="showcase" id="badges">
          <h2>Badge showcase</h2>
          <ul>{showcase.map(({ badge }) => <li key={badge.code}><BadgeMedal badge={badge} size={64} /><b>{badge.name}</b><small>{badge.description}</small></li>)}</ul>
          {badges.length > 3 && <p className="hint">+{badges.length - showcase.length} more on <Link to={isMe ? '/badges' : '#'}>{isMe ? 'your badges page' : 'this profile'}</Link></p>}
        </section>
      )}

      <div className="profile-grid">
        <div>
          {p.bio && <section className="panel"><h2>About</h2><p className="bio">{p.bio}</p>
            <p className="chips">{EXP[p.experience_level] && <Chip tone="soft">{EXP[p.experience_level]}</Chip>}
              {p.availability.map((a) => <Chip key={a} tone="soft">{AVAILABILITY.find((x) => x.id === a)?.label || a}</Chip>)}
              {p.interests.map((i) => <Chip key={i}>{i}</Chip>)}</p></section>}

          <section className="panel">
            <h2>Skills</h2>
            {skills.length === 0 ? <p className="muted">No skills listed yet.</p> : (
              <ul className="skills">
                {skills.map(({ level, skill }) => {
                  const n = endorse[skill.id]?.length || 0;
                  const mine = endorse[skill.id]?.includes(me.id);
                  return (
                    <li key={skill.id}>
                      <span className={`lv lv${level}`} title={LV[level]} aria-label={LV[level]}><i /><i /><i /></span>
                      <b>{skill.name}</b><small>{skill.category}</small>
                      <span className="endorse-count">{n} endorsement{n === 1 ? '' : 's'}</span>
                      {!isMe && <button className={`btn btn-sm ${mine ? 'btn-quiet' : 'btn-ghost'}`} onClick={() => toggleEndorse(skill.id)} aria-pressed={mine}>{mine ? 'Endorsed' : 'Endorse'}</button>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="section-head"><h2>Projects</h2>{isMe && !adding && <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" />Add project</button>}</div>
            {adding && <ProjectForm onSaved={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />}
            {projects.length === 0 && !adding && <p className="muted">{isMe ? 'Add something you built. It unlocks the Builder badge.' : 'No projects yet.'}</p>}
            <ul className="projects">
              {projects.map((pr) => (
                <li key={pr.id}>
                  <b>{pr.name}</b>
                  {pr.description && <p>{pr.description}</p>}
                  <span className="chips">{pr.tech.map((t) => <Chip key={t} tone="soft">{t}</Chip>)}</span>
                  <span className="links">
                    {pr.repo_url && <a href={pr.repo_url} target="_blank" rel="noreferrer"><Github size={14} aria-hidden="true" />Code</a>}
                    {pr.demo_url && <a href={pr.demo_url} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true" />Live</a>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div>
          <section className="panel"><h2>Activity</h2><Heatmap days={heat} /></section>
          <section>
            <h2>Recent posts</h2>
            {posts.length === 0 ? <p className="muted">No posts yet.</p> : posts.map((post) => <PostCard key={post.id} post={post} kudoed={false} onChange={load} />)}
          </section>
        </div>
      </div>
      {invite && <InviteDialog target={p} onClose={() => setInvite(false)} />}
    </div>
  );
}
