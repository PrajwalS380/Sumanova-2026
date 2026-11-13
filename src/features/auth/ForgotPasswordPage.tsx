import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { AuthLayout } from './AuthLayout';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { emailSchema, friendlyAuthError } from '@/lib/validation';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setBusy(false);
    if (err) return setError(friendlyAuthError(err.message));
    setSent(true);
  }

  return (
    <AuthLayout title="Reset password" subtitle={sent ? undefined : 'We’ll email you a secure reset link.'}>
      {sent ? (
        <div className="flex flex-col items-center text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-aurora-teal/15 text-aurora-mint">
            <MailCheck className="h-8 w-8" />
          </div>
          <p className="mt-4 text-sm text-ink-soft">If an account exists for {email}, a reset link is on its way.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3" noValidate>
          <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <Button type="submit" block size="lg" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/auth/sign-in" className="font-semibold text-aurora-iris">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
