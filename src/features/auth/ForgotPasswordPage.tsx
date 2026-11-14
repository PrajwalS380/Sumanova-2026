import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthLayout } from './AuthLayout';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { emailSchema, friendlyAuthError, passwordSchema } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { OtpField, OTP_LENGTH } from './OtpField';
import { useCooldown } from './useCooldown';

/**
 * Password reset with an emailed 6-digit code. Works identically on the web,
 * the Android app and the iPhone app (no deep links required).
 */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { clearRecovering } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setErrors({ email: parsed.error.issues[0].message });
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setBusy(false);
    if (error) return setErrors({ email: friendlyAuthError(error.message) });
    setErrors({});
    cooldown.start(60);
    setStep('code');
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    if (code.length !== OTP_LENGTH) return setErrors({ code: `Enter the ${OTP_LENGTH}-digit code` });
    const parsed = passwordSchema.safeParse(pw);
    if (!parsed.success) return setErrors({ pw: parsed.error.issues[0].message });
    setBusy(true);
    const { error: vErr } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'recovery' });
    if (vErr) {
      setBusy(false);
      setCode('');
      return setErrors({ code: friendlyAuthError(vErr.message) });
    }
    const { error: uErr } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    clearRecovering();
    if (uErr) return setErrors({ pw: friendlyAuthError(uErr.message) });
    toast('Password updated — you’re signed in', 'success');
    navigate('/', { replace: true });
  }

  return (
    <AuthLayout title="Reset password" subtitle={step === 'email' ? 'We’ll email you a 6-digit code.' : `Enter the code sent to ${email}`}>
      <AnimatePresence mode="wait" initial={false}>
        {step === 'email' ? (
          <motion.form key="email" onSubmit={sendCode} className="space-y-3" noValidate initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Field label="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
            <Button type="submit" block size="lg" loading={busy}>
              Send code
            </Button>
          </motion.form>
        ) : (
          <motion.form key="code" onSubmit={reset} className="space-y-4" noValidate initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <OtpField value={code} onChange={(v) => { setCode(v); setErrors((er) => ({ ...er, code: '' })); }} error={errors.code} disabled={busy} />
            <Field label="New password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={errors.pw} />
            <Button type="submit" block size="lg" loading={busy}>
              Update password
            </Button>
            <div className="flex justify-between text-sm">
              <button type="button" onClick={() => setStep('email')} className="text-ink-mute hover:text-ink">Change email</button>
              <button type="button" onClick={() => void sendCode()} disabled={cooldown.left > 0} className="font-semibold text-ember-amber disabled:text-ink-faint">
                {cooldown.left > 0 ? `Resend in ${cooldown.left}s` : 'Resend code'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      <p className="mt-6 text-center text-sm">
        <Link to="/auth/sign-in" className="font-semibold text-ember-amber">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
