import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { firstError, friendlyAuthError, signInSchema } from '@/lib/validation';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email, password });
    setErrors(firstError(parsed));
    if (!parsed.success) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) setErrors({ form: friendlyAuthError(error.message) });
    // On success the auth listener redirects to the camera.
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to pick up where you left off.">
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Field label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <div className="flex justify-end">
          <Link to="/auth/forgot" className="text-sm text-ember-amber hover:underline">
            Forgot password?
          </Link>
        </div>
        {errors.form && <p role="alert" className="rounded-xl bg-ember-rose/10 px-3 py-2 text-sm text-ember-rose">{errors.form}</p>}
        <Button type="submit" block size="lg" loading={busy}>
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-mute">
        New here?{' '}
        <Link to="/auth/sign-up" className="font-semibold text-ink hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
