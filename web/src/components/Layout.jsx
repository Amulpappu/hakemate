import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { Home, Compass, Users, MessagesSquare, Trophy, Award, Bell, ShieldCheck, LogOut, Menu, X, HelpCircle, CalendarDays, MessageSquareHeart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { LevelAvatar } from './bits';
import Tour from './Tour';

const NAV = [
  { to: '/home', label: 'Home', icon: Home, tour: 'nav-home' },
  { to: '/discover', label: 'Find teammates', icon: Compass, tour: 'nav-discover' },
  { to: '/events', label: 'Hackathons', icon: CalendarDays, tour: 'nav-events' },
  { to: '/teams', label: 'Teams', icon: Users, tour: 'nav-teams' },
  { to: '/community', label: 'Community', icon: MessagesSquare, tour: 'nav-community' },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy, tour: 'nav-leaderboard' },
  { to: '/badges', label: 'Badges', icon: Award, tour: 'nav-badges' },
];

export default function Layout() {
  const { profile, account, signOut } = useAuth();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [touring, setTouring] = useState(false);
  const nav = useNavigate();

  useEffect(() => { if (account && account.onboarded && !account.tour_done) setTouring(true); }, [account]);

  useEffect(() => {
    if (!profile) return;
    const load = async () => {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('read', false);
      setUnread(count || 0);
    };
    load();
    const ch = supabase.channel('notif-' + profile.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.id]);

  return (
    <div className={`shell ${open ? 'nav-open' : ''}`}>
      <a href="#main" className="skip">Skip to content</a>
      <aside className="sidebar">
        <Link to="/home" className="brand" onClick={() => setOpen(false)}>
          <img src="/favicon.svg" alt="" width="34" height="34" />
          <span>Hakemate<small>3.0</small></span>
        </Link>
        <nav aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, tour }) => (
            <NavLink key={to} to={to} data-tour={tour} onClick={() => setOpen(false)}>
              <Icon size={19} aria-hidden="true" />{label}
            </NavLink>
          ))}
          {account?.role === 'admin' && (
            <NavLink to="/admin" onClick={() => setOpen(false)}><ShieldCheck size={19} aria-hidden="true" />Admin</NavLink>
          )}
        </nav>
        <div className="sidebar-foot">
          <NavLink to="/feedback" className="nav-btn" onClick={() => setOpen(false)}><MessageSquareHeart size={19} aria-hidden="true" />Give feedback</NavLink>
          <button className="nav-btn" onClick={() => { setOpen(false); setTouring(true); }}><HelpCircle size={19} aria-hidden="true" />Replay tour</button>
          <button className="nav-btn" onClick={async () => { await signOut(); nav('/'); }}><LogOut size={19} aria-hidden="true" />Sign out</button>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="topbar-spacer" />
          <Link to="/notifications" className="icon-btn bell" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
            <Bell size={21} aria-hidden="true" />
            {unread > 0 && <span className="dot">{unread > 9 ? '9+' : unread}</span>}
          </Link>
          {profile && (
            <Link to="/me" className="me-link" aria-label="Your profile">
              <LevelAvatar profile={profile} size={34} />
              <span className="me-text"><b>{profile.display_name}</b><small>{profile.xp} XP</small></span>
            </Link>
          )}
        </header>
        <main id="main" className="page"><Outlet /></main>
      </div>
      {touring && <Tour onDone={() => setTouring(false)} />}
    </div>
  );
}
