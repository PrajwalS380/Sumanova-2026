import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { AuthLayout } from './AuthLayout';

/** Second step of sign-in for people who turned on two-step login (6-digit code from their authenticator app). */
export default function TwoStepPage() {
  const { session, recheckMfa, signOut } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data: f, error: fe } = await supabase.auth.mfa.listFactors();
      if (fe) throw fe;
      const factor = f.totp.find((x) => x.status === 'verified');
      if (!factor) throw new Error('Two-step login isn’t set up on this account');
      const { error: ve } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (ve) throw new Error('That code didn’t work — check the time on your phone and try the newest code');
      await recheckMfa();
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (!session) return <Navigate to="/auth/welcome" replace />;
  return (
    <AuthLayout title="Two-step login" subtitle="Enter the 6-digit code from your authenticator app.">
      <form onSubmit={verify} className="space-y-3">
        <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-ink-mute"><ShieldCheck className="h-5 w-5 text-ember-sage" /> Signed in as {session.user.email}</div>
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123456" aria-label="6-digit code" className="h-14 w-full rounded-2xl bg-[#F1F1F4] text-center text-2xl font-black tracking-[0.5em] outline-none" />
        {error && <p className="text-sm font-semibold text-ember-rose">{error}</p>}
        <button type="submit" disabled={busy || code.length !== 6} className="flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:opacity-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify'}</button>
        <button type="button" onClick={() => void signOut()} className="w-full py-2 text-sm font-bold text-ink-mute">Use a different account</button>
      </form>
    </AuthLayout>
  );
}
