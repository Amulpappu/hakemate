import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { configured } from '../lib/supabase';
import { takeNext } from '../lib/next';
import { DnaStrand, Avatar } from '../components/bits';

const DEMO = { s_skill: 30, s_meaning: 22, s_avail: 15, s_mode: 15, s_exp: 10 };

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

export default function Landing() {
  const { session, account, loading, signInWithGoogle } = useAuth();
  if (!loading && session && account) return <Navigate to={account.onboarded ? takeNext() : '/welcome'} replace />;

  return (
    <div className="landing">
      <header className="landing-nav">
        <span className="brand brand-dark"><img src="/favicon.svg" alt="" width="34" height="34" /><span>Hakemate<small>3.0</small></span></span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>Find the teammate your hackathon team is missing.</h1>
          <p className="lede">
            Hakemate looks at your team's skills, then ranks builders across colleges who fill the gap,
            share your interests and are free when you are. Every match shows you why.
          </p>
          {configured ? (
            <button className="btn btn-google" onClick={signInWithGoogle} disabled={loading}>
              <GoogleMark /> Continue with Google
            </button>
          ) : (
            <p className="setup-note">Add your Supabase URL and key to <code>web/.env</code> to turn on sign in. See README.md.</p>
          )}
          <p className="fine">Google sign-in only. Your phone and socials stay hidden until both of you accept a team invite.</p>
        </div>

        <figure className="hero-demo" aria-label="Example match">
          <div className="demo-card">
            <div className="match-top">
              <span className="match-who">
                <Avatar name="Priya Raman" size={52} />
                <span><b>Priya Raman</b><small>ML engineer, PSG College of Technology</small></span>
              </span>
              <span className="score score-strong"><b>92</b><small>/100</small></span>
            </div>
            <DnaStrand m={DEMO} showLegend height={14} />
            <p className="demo-why">Covers AI/ML and Backend, which your team still needs. Free on weekends like you.</p>
          </div>
          <figcaption>The Team DNA strand: five reasons, one score.</figcaption>
        </figure>
      </section>

      <section className="how">
        <h2>How it works</h2>
        <ol className="steps">
          <li><b>Sign in with Google</b><span>One tap, no passwords.</span></li>
          <li><b>Build your profile</b><span>Skills, interests and when you're free. A short guided setup.</span></li>
          <li><b>Get ranked matches</b><span>Scored out of 100 with plain reasons, so you know who to message first.</span></li>
          <li><b>Team up and level up</b><span>Invite, join, post in hubs, earn XP and badges as you go.</span></li>
        </ol>
      </section>

      <footer className="landing-foot">
        Built by Team Fast &amp; Furious, Rathinam Technical Campus, for International Hackathon 5.0, Domain 4.
      </footer>
    </div>
  );
}
