import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from './AuthLayout';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { friendlyAuthError, passwordSchema } from '@/lib/validation';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';

export default function ResetPasswordPage() {
  const { session, clearRecovering } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(pw);
    if (!parsed.success) return setErrors({ pw: parsed.error.issues[0].message });
    if (pw !== confirm) return setErrors({ confirm: 'Passwords don’t match' });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setErrors({ form: friendlyAuthError(error.message) });
    clearRecovering();
    toast('Password updated', 'success');
    navigate('/', { replace: true });
  }

  if (!session) {
    return (
      <AuthLayout title="Link expired" subtitle="Reset links work once and expire after a while. Request a new one.">
        <Button block size="lg" onClick={() => navigate('/auth/forgot')}>
          Request new link
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Field label="New password" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} error={errors.pw} />
        <Field label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        {errors.form && <p role="alert" className="text-sm text-aurora-coral">{errors.form}</p>}
        <Button type="submit" block size="lg" loading={busy}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
