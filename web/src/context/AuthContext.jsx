import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, configured, rpc, q } from '../lib/supabase';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [account, setAccount] = useState(null); // role, status, onboarded, tour_done
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(configured);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data: { session: s } } = await supabase.auth.getSession();
    setSession(s);
    if (!s) { setAccount(null); setProfile(null); return; }
    try {
      const [acc] = await rpc('my_account');
      const prof = await q(supabase.from('profiles').select('*').eq('id', s.user.id).single());
      setAccount(acc || null);
      setProfile(prof);
      rpc('touch_seen').catch(() => {});
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    refresh().finally(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s) refresh();
      else { setAccount(null); setProfile(null); }
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/home', queryParams: { prompt: 'select_account' } },
    });

  const signOut = () => supabase.auth.signOut();

  return (
    <AuthCtx.Provider value={{ session, user: session?.user, account, profile, loading, refresh, signInWithGoogle, signOut, setProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
