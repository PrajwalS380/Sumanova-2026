import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { savedAccounts } from '@/lib/savedAccounts';
import { LogoMark, Wordmark } from '@/components/Logo';
import { motion } from 'framer-motion';

/** Signed-out landing (wireframe 16): wordmark, tagline, three starter characters, Create account / Log in. */
export default function WelcomePage() {
  const [params] = useSearchParams();
  // Accounts saved on this phone → "Welcome back" first (like the familiar flow).
  if (!params.get('fresh') && savedAccounts.list().length > 0) return <Navigate to="/accounts" replace />;
  const figs = [
    { src: '/welcome/meera.webp', h: 210 },
    { src: '/welcome/kofi.webp', h: 240 },
    { src: '/welcome/zoe.webp', h: 210 },
  ];
  return (
    <div className="flex min-h-full flex-col items-center bg-noir pt-safe text-ink">
      <LogoMark size={96} className="mt-[64px]" />
      <h1 className="mt-4"><Wordmark className="text-[40px]" /></h1>

      <div className="mt-[48px] flex items-end">
        {figs.map((f, i) => (
          <motion.img
            key={f.src}
            src={f.src}
            alt=""
            draggable={false}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, type: 'spring', stiffness: 220, damping: 22 }}
            style={{ height: f.h, width: 'auto' }}
            className={i === 1 ? 'relative z-10 -mx-2' : ''}
          />
        ))}
      </div>

      <div className="mt-auto flex w-full max-w-sm flex-col gap-3 px-6 pb-[max(2.5rem,var(--safe-bottom))] pt-8">
        <Link to="/auth/sign-up" className="grid h-[54px] place-items-center rounded-2xl bg-ember-flame text-base font-extrabold text-white active:scale-[0.98]">Create account</Link>
        <Link to="/auth/sign-in" className="grid h-[54px] place-items-center rounded-2xl bg-white text-base font-extrabold text-ink active:scale-[0.98]">Log in</Link>
        <p className="mt-1 text-center text-xs text-ink-mute">No email code needed · you'll design your avatar next</p>
      </div>
    </div>
  );
}
