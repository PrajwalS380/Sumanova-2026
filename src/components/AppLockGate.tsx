import { useCallback, useEffect, useRef, useState } from 'react';
import { Delete, Fingerprint } from 'lucide-react';
import { checkPin, lockConfig, lockEnabled, lockoutRemaining, unlockWithBiometric } from '@/lib/appLock';
import { useAuth } from '@/providers/AuthProvider';
import { LogoMark as Logo } from '@/components/Logo';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';

/** Number pad used by the lock screen and the PIN set-up / hidden-chats sheets. */
export function PinPad({ title, sub, error, onDone, onBio, length = 0 }: { title: string; sub?: string; error?: string; onDone: (pin: string) => void; onBio?: () => void; length?: number }) {
  const [pin, setPin] = useState('');
  useEffect(() => {
    if (error) setPin('');
  }, [error]);
  const press = (d: string) => {
    haptic(5);
    const next = (pin + d).slice(0, 6);
    setPin(next);
    if (length && next.length === length) {
      onDone(next);
      setTimeout(() => setPin(''), 150);
    }
  };
  return (
    <div className="flex flex-col items-center">
      <p className="font-display text-xl">{title}</p>
      {sub && <p className="mt-1 max-w-[17rem] text-center text-sm text-ink-mute">{sub}</p>}
      <div className={cn('mt-5 flex h-4 gap-3', error && 'pin-shake')} aria-label={`${pin.length} digits entered`}>
        {Array.from({ length: Math.max(4, length || pin.length) }).map((_, i) => (
          <span key={i} className={cn('h-3.5 w-3.5 rounded-full border-2 border-ink', i < pin.length && 'bg-ink')} />
        ))}
      </div>
      <p className="mt-3 h-5 text-sm font-semibold text-ember-rose" role="alert">{error}</p>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="h-16 w-16 rounded-full bg-white text-2xl font-bold active:scale-95">{d}</button>
        ))}
        {onBio ? (
          <button type="button" onClick={onBio} aria-label="Use fingerprint" className="grid h-16 w-16 place-items-center rounded-full active:scale-95"><Fingerprint className="h-7 w-7" /></button>
        ) : <span />}
        <button type="button" onClick={() => press('0')} className="h-16 w-16 rounded-full bg-white text-2xl font-bold active:scale-95">0</button>
        <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete digit" className="grid h-16 w-16 place-items-center rounded-full active:scale-95"><Delete className="h-6 w-6" /></button>
      </div>
      {!length && (
        <button type="button" disabled={pin.length < 4} onClick={() => onDone(pin)} className="mt-5 h-12 w-56 rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:opacity-30">
          Continue
        </button>
      )}
    </div>
  );
}

/**
 * Covers the app until the PIN / fingerprint is given: on start, and after the app was in the
 * background longer than the chosen time. While in the background the content is covered too,
 * so the Recents preview doesn't show chats.
 */
export function AppLockGate() {
  const { session, signOut } = useAuth();
  const [locked, setLocked] = useState(() => lockEnabled());
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState('');
  const awayAt = useRef(0);
  const cfg = lockConfig();

  const tryBio = useCallback(async () => {
    if (await unlockWithBiometric()) setLocked(false);
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (!lockEnabled()) return;
      if (document.hidden) {
        awayAt.current = Date.now();
        setHidden(true);
      } else {
        setHidden(false);
        const after = (lockConfig()?.after ?? 0) * 1000;
        if (awayAt.current && Date.now() - awayAt.current >= after) setLocked(true);
      }
    };
    const onChange = () => !lockEnabled() && setLocked(false);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('snv-lock-changed', onChange);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('snv-lock-changed', onChange);
    };
  }, []);

  // offer the fingerprint straight away
  useEffect(() => {
    if (locked && session && cfg?.bio && !document.hidden) void tryBio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, !!session]);

  if (!session || (!locked && !hidden)) return null;
  if (!locked) return <div className="fixed inset-0 z-[200] grid place-items-center bg-noir"><Logo size={72} /></div>;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-noir px-6" role="dialog" aria-modal="true" aria-label="SUMANOVA is locked">
      <Logo size={56} />
      <div className="mt-6">
        <PinPad
          title="Enter your PIN"
          error={error}
          onBio={cfg?.bio ? () => void tryBio() : undefined}
          onDone={async (pin) => {
            const wait = lockoutRemaining();
            if (wait > 0) return setError(`Too many tries — wait ${Math.ceil(wait / 1000)} s`);
            if (await checkPin(pin)) {
              setError('');
              setLocked(false);
            } else setError(lockoutRemaining() > 0 ? 'Too many tries — wait a moment' : 'Wrong PIN');
          }}
        />
      </div>
      <button
        type="button"
        onClick={async () => {
          if (!window.confirm('Forgot your PIN? You’ll be signed out on this phone and the lock is removed. Sign in again with your password.')) return;
          const { removeLock } = await import('@/lib/appLock');
          removeLock();
          await signOut(false);
        }}
        className="mt-6 text-sm font-semibold text-ink-mute underline"
      >
        Forgot PIN?
      </button>
    </div>
  );
}
