import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { deviceApproval, type DeviceStatus } from '@/lib/deviceApproval';
import { LogoMark } from '@/components/Logo';

/**
 * When the account has new-device approval on and this sign-in isn't trusted yet, the app waits
 * here (the database already refuses chats, snaps, memories and locations to this session).
 */
export function DeviceGate() {
  const { session, signOut, mfaPending } = useAuth();
  const [status, setStatus] = useState<DeviceStatus>('approved');

  useEffect(() => {
    if (!session || mfaPending) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      const s = await deviceApproval.check().catch(() => 'approved' as const);
      if (!alive) return;
      setStatus(s);
      if (s === 'denied') void signOut(false);
      else if (s === 'pending') timer = setTimeout(() => void run(), 6000);
    };
    void run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, mfaPending]);

  if (!session || status === 'approved') return null;
  return (
    <div className="fixed inset-0 z-[190] flex flex-col items-center justify-center bg-noir px-8 text-center" role="dialog" aria-modal="true" aria-label="Waiting for approval">
      <LogoMark size={56} />
      <span className="mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-white"><ShieldCheck className="h-7 w-7" /></span>
      <p className="mt-4 font-display text-2xl">Approve this sign-in</p>
      <p className="mt-2 max-w-xs text-sm text-ink-mute">
        Your account asks for approval on new devices. Open SUMANOVA on a phone you already use and tap <b>Approve</b> in Settings → Security.
        If you can’t, it unlocks by itself after 24 hours unless you tap “Not me” there.
      </p>
      <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-ink-mute"><span className="h-2 w-2 animate-pulse rounded-full bg-ember-flame" /> Waiting…</p>
      <button type="button" onClick={() => void signOut(false)} className="mt-8 h-12 w-56 rounded-2xl bg-white text-[15px] font-extrabold">Sign out</button>
    </div>
  );
}
