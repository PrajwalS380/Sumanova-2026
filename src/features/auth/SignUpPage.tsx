import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AtSign, Check, Loader2, MailCheck, X } from 'lucide-react';
import { OtpField, OTP_LENGTH } from './OtpField';
import { useCooldown } from './useCooldown';
import { useToast } from '@/providers/ToastProvider';
import { AuthLayout } from './AuthLayout';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { firstError, friendlyAuthError, passwordStrength, signUpSchema } from '@/lib/validation';
import { useUsernameAvailability } from './useUsernameAvailability';
import { cn } from '@/lib/cn';

const STEP_FIELDS = [['displayName', 'username', 'dateOfBirth'], ['email', 'password']] as const;

export default function SignUpPage() {
  const [step, setStep] = useState<0 | 1>(0);
  const [form, setForm] = useState({ displayName: '', username: '', dateOfBirth: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const avail = useUsernameAvailability(form.username);
  const strength = passwordStrength(form.password);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = k === 'username' ? e.target.value.toLowerCase().replace(/\s/g, '') : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((er) => ({ ...er, [k]: '' }));
  };

  function validateStep(s: 0 | 1) {
    const all = firstError(signUpSchema.safeParse(form));
    const relevant: Record<string, string> = {};
    for (const f of STEP_FIELDS[s]) if (all[f]) relevant[f] = all[f];
    if (s === 0 && !relevant.username && avail.state === 'taken') relevant.username = avail.message ?? 'Taken';
    setErrors(relevant);
    return Object.keys(relevant).length === 0;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step === 0) {
      if (validateStep(0)) setStep(1);
      return;
    }
    if (!validateStep(1)) return;
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          username: form.username.trim().toLowerCase(),
          display_name: form.displayName.trim(),
          date_of_birth: form.dateOfBirth,
        },
      },
    });
    setBusy(false);
    if (error) {
      setErrors({ form: friendlyAuthError(error.message) });
      if (error.message.toLowerCase().includes('database error')) setStep(0);
      return;
    }
    if (!data.session) setSentTo(form.email.trim());
  }

  if (sentTo) return <VerifyEmailStep email={sentTo} onBack={() => setSentTo(null)} />;

  const max = new Date();
  max.setFullYear(max.getFullYear() - 13);

  return (
    <AuthLayout title={step === 0 ? 'Make it yours' : 'Secure your account'} subtitle={step === 0 ? 'How your friends will find you.' : 'Step 2 of 2'}>
      <div className="mb-5 flex gap-1.5" aria-hidden>
        {[0, 1].map((i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors duration-500', i <= step ? 'bg-ember-gradient text-noir' : 'bg-ink/10')} />
        ))}
      </div>
      <form onSubmit={submit} noValidate>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: step === 0 ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: step === 0 ? 24 : -24 }}
            transition={{ duration: 0.22 }}
            className="space-y-3"
          >
            {step === 0 ? (
              <>
                <Field label="Your name" autoComplete="name" value={form.displayName} onChange={set('displayName')} error={errors.displayName} maxLength={40} />
                <Field
                  label="Username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={form.username}
                  onChange={set('username')}
                  maxLength={20}
                  error={errors.username || (avail.state === 'taken' || avail.state === 'invalid' ? avail.message : undefined)}
                  hint={avail.state === 'available' ? <span className="text-ember-sage">{avail.message}</span> : avail.state === 'error' ? avail.message : 'Letters, numbers, . and _'}
                  trailing={
                    avail.state === 'checking' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-ink-mute" />
                    ) : avail.state === 'available' ? (
                      <Check className="h-4 w-4 text-ember-sage" />
                    ) : avail.state === 'taken' ? (
                      <X className="h-4 w-4 text-ember-rose" />
                    ) : (
                      <AtSign className="h-4 w-4 text-ink-faint" />
                    )
                  }
                />
                <Field label="Birthday" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} error={errors.dateOfBirth} max={max.toISOString().slice(0, 10)} hint="Private — never shown on your profile" />
              </>
            ) : (
              <>
                <Field label="Email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
                <Field label="Password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} />
                {form.password && (
                  <div className="px-1">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={cn(
                            'h-1 flex-1 rounded-full transition-colors duration-300',
                            i < strength.score ? (strength.score <= 1 ? 'bg-ember-rose' : strength.score === 2 ? 'bg-ember-gold' : 'bg-ember-jade') : 'bg-ink/10',
                          )}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-ink-mute">{strength.label}</p>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
        {errors.form && <p role="alert" className="mt-3 rounded-xl bg-ember-rose/10 px-3 py-2 text-sm text-ember-rose">{errors.form}</p>}
        <div className="mt-5 flex gap-2">
          {step === 1 && (
            <Button type="button" variant="glass" size="lg" onClick={() => setStep(0)}>
              Back
            </Button>
          )}
          <Button type="submit" block size="lg" loading={busy} disabled={step === 0 && avail.state === 'checking'}>
            {step === 0 ? 'Continue' : 'Create account'}
          </Button>
        </div>
      </form>
      <p className="mt-6 text-center text-sm text-ink-mute">
        Already have an account?{' '}
        <Link to="/auth/sign-in" className="font-semibold text-ink hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

/** Step 3: enter the 6-digit code from the confirmation email. */
function VerifyEmailStep({ email, onBack }: { email: string; onBack: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown(60);
  const toast = useToast();

  async function verify(token = code) {
    if (token.length !== OTP_LENGTH) return setError(`Enter the ${OTP_LENGTH}-digit code`);
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
    setBusy(false);
    if (err) {
      setError(friendlyAuthError(err.message));
      setCode('');
    }
    // On success the auth listener signs the user in and routes to the camera.
  }

  async function resend() {
    const { error: err } = await supabase.auth.resend({ type: 'signup', email });
    if (err) return toast(friendlyAuthError(err.message), 'error');
    cooldown.start(60);
    toast('New code sent', 'success');
  }

  return (
    <AuthLayout title="Verify your email" subtitle={`We sent a ${OTP_LENGTH}-digit code to ${email}`}>
      <div className="mb-5 flex justify-center">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid h-14 w-14 place-items-center rounded-3xl bg-ember-jade/15 text-ember-sage">
          <MailCheck className="h-7 w-7" />
        </motion.div>
      </div>
      <OtpField value={code} onChange={(v) => { setCode(v); setError(''); }} onComplete={(v) => void verify(v)} error={error} disabled={busy} />
      <Button block size="lg" className="mt-5" loading={busy} onClick={() => void verify()}>
        Verify & continue
      </Button>
      <div className="mt-5 flex items-center justify-between text-sm">
        <button onClick={onBack} className="text-ink-mute hover:text-ink">Change email</button>
        <button onClick={resend} disabled={cooldown.left > 0} className="font-semibold text-ember-amber disabled:text-ink-faint">
          {cooldown.left > 0 ? `Resend in ${cooldown.left}s` : 'Resend code'}
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-ink-faint">Can’t find it? Check Spam or Promotions.</p>
    </AuthLayout>
  );
}
