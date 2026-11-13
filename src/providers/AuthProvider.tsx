import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { PrivacySettings, Profile, UserSettings } from '@/lib/types';
import { setHapticsEnabled } from '@/lib/haptics';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  settings: UserSettings | null;
  privacy: PrivacySettings | null;
  loading: boolean;
  /** True after a password-recovery link is opened. */
  recovering: boolean;
  refresh: () => Promise<void>;
  setProfile: (p: Profile) => void;
  setSettings: (s: UserSettings) => void;
  setPrivacy: (p: PrivacySettings) => void;
  signOut: (everywhere?: boolean) => Promise<void>;
  clearRecovering: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  const loadUserData = useCallback(async (uid: string) => {
    const [p, s, pr] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.from('user_settings').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('privacy_settings').select('*').eq('user_id', uid).maybeSingle(),
    ]);
    setProfile((p.data as Profile) ?? null);
    setSettings((s.data as UserSettings) ?? null);
    setPrivacy((pr.data as PrivacySettings) ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadUserData(data.session.user.id);
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setSettings(null);
        setPrivacy(null);
      }
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && next) {
        // Defer: calling Supabase inside this callback can deadlock the auth lock.
        setTimeout(() => void loadUserData(next.user.id), 0);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadUserData]);

  useEffect(() => {
    if (!settings) return;
    setHapticsEnabled(settings.haptics);
    document.documentElement.classList.toggle('reduce-motion', settings.reduce_motion);
  }, [settings]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      settings,
      privacy,
      loading,
      recovering,
      refresh: async () => {
        if (session) await loadUserData(session.user.id);
      },
      setProfile,
      setSettings,
      setPrivacy,
      signOut: async (everywhere = false) => {
        await supabase.auth.signOut({ scope: everywhere ? 'global' : 'local' });
      },
      clearRecovering: () => setRecovering(false),
    }),
    [session, profile, settings, privacy, loading, recovering, loadUserData],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
