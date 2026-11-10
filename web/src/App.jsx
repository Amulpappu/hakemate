import { Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Spinner } from './components/bits';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Discover from './pages/Discover';
import Teams from './pages/Teams';
import TeamDetail from './pages/TeamDetail';
import Community from './pages/Community';
import Leaderboard from './pages/Leaderboard';
import Badges from './pages/Badges';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Admin from './pages/Admin';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Feedback from './pages/Feedback';
import { rememberNext } from './lib/next';

function Suspended() {
  const { signOut } = useAuth();
  return (
    <div className="center-page">
      <h1>Your account is paused</h1>
      <p>An admin has suspended this account. Contact the Hakemate team if you think this is a mistake.</p>
      <button className="btn btn-quiet" onClick={signOut}>Sign out</button>
    </div>
  );
}

// signed in + onboarded, otherwise redirect
function Gate({ children, onboarding = false }) {
  const { session, account, loading } = useAuth();
  const loc = useLocation();
  if (loading || (session && !account)) return <div className="center-page"><Spinner label="Signing you in" /></div>;
  if (!session) { rememberNext(loc.pathname + loc.search); return <Navigate to="/" replace />; }
  if (account.status === 'suspended') return <Suspended />;
  if (!onboarding && !account.onboarded) return <Navigate to="/welcome" replace />;
  if (onboarding && account.onboarded) return <Navigate to="/home" replace />;
  return children;
}

// Link for ACE event pages: /join?event=<hackathon id>  ->  that hackathon's page
function Join() {
  const [params] = useSearchParams();
  const ev = (params.get('event') || '').replace(/[^a-z0-9-]/g, '');
  return <Navigate to={ev ? `/events/${ev}` : '/events'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/join" element={<Join />} />
      <Route path="/welcome" element={<Gate onboarding><Onboarding /></Gate>} />
      <Route element={<Gate><Layout /></Gate>}>
        <Route path="/home" element={<Home />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/teams/:id" element={<TeamDetail />} />
        <Route path="/community" element={<Community />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/badges" element={<Badges />} />
        <Route path="/me" element={<Profile />} />
        <Route path="/u/:handle" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
