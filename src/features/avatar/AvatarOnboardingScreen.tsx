import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Check } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { ScreenLoader } from '@/components/ScreenLoader';
import { useAuth } from '@/providers/AuthProvider';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { PRESETS } from './look/presets';

/** Starter characters that have a pre-rendered picture in public/presets (index into PRESETS). */
export const PICTURED = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11];

const skipKey = (uid: string) => `snv-avatar-skipped-${uid}`;

/** True when this person chose "Skip" on this device (they can still create one from their profile). */
export function avatarSkipped(uid: string): boolean {
  try {
    return localStorage.getItem(skipKey(uid)) === '1';
  } catch {
    return false;
  }
}

/**
 * Right after sign-up / log-in (wireframe flow): pick a starter character, then
 * customise it in the studio — or skip. Accounts that already have an avatar,
 * or skipped before, go straight to the camera.
 */
export default function AvatarOnboardingScreen() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [pick, setPick] = useState<number>(0);
  const [params] = useSearchParams();
  // Opened from the profile ("Create your avatar"): always show the picker.
  const fromProfile = params.get('from') === 'profile';
  if (!session) return <Navigate to="/auth/welcome" replace />;
  if (!profile) return <ScreenLoader />;
  if (!fromProfile && (profile.avatar_body_url || avatarSkipped(profile.id))) {
    try {
      sessionStorage.removeItem('snv-after-auth');
    } catch {
      /* storage blocked */
    }
    return <Navigate to="/" replace />;
  }

  function skip() {
    try {
      localStorage.setItem(skipKey(profile!.id), '1');
      sessionStorage.removeItem('snv-after-auth');
    } catch {
      /* storage blocked */
    }
    navigate(fromProfile ? '/profile' : '/', { replace: true });
  }

  return (
    <div className="flex min-h-full flex-col bg-noir pt-safe text-ink">
      <header className="flex items-center gap-3 px-5 pt-4">
        <LogoMark size={40} />
        <span className="flex-1" />
        <button onClick={skip} className="rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold active:scale-95">Skip</button>
      </header>
      <div className="px-5 pt-6">
        <h1 className="font-display text-[34px] leading-none">Choose your avatar</h1>
        <p className="mt-2 text-sm font-semibold text-ink-mute">Make one from a selfie, or start from a character. You can change everything later from your profile.</p>
        <button onClick={() => navigate('/avatar/selfie')} className="relative isolate mt-4 flex w-full items-center gap-3 overflow-hidden rounded-tile bg-[#111111] p-4 text-left text-white active:scale-[0.98]">
          <span aria-hidden className="pointer-events-none absolute -right-6 -top-8 -z-10 opacity-[0.12]"><Camera className="h-36 w-36" strokeWidth={1.2} /></span>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ember-rose"><Camera className="h-6 w-6" /></span>
          <span className="flex-1">
            <span className="block text-[17px] font-black">Make it from a selfie</span>
            <span className="block text-xs font-semibold text-white/70">We read your skin, hair, eyes and face shape — right on your phone</span>
          </span>
        </button>
        <h2 className="eyebrow mt-5">Or start from a character</h2>
      </div>

      <div className="grid flex-1 grid-cols-3 content-start gap-2.5 px-5 pb-36 pt-2.5" role="radiogroup" aria-label="Starter characters">
        {PICTURED.map((i) => ({ p: PRESETS[i], i })).filter((x) => x.p).map(({ p, i }) => (
          <motion.button
            key={p.name}
            role="radio"
            aria-checked={pick === i}
            aria-label={p.name}
            onClick={() => { haptic(8); setPick(i); }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 11) * 0.03 }}
            className={cn('relative flex aspect-[3/4] flex-col items-center justify-end overflow-hidden rounded-tile bg-white pb-2 transition-shadow', pick === i && 'ring-[3px] ring-ink')}
          >
            <span className="absolute inset-0 grid place-items-center pb-6 font-display text-[44px] text-ink/15" aria-hidden>{p.name[0]}</span>
            <img src={`/presets/${i}.webp`} alt="" loading="lazy" decoding="async" draggable={false} onError={(e) => { e.currentTarget.style.display = 'none'; }} className="absolute inset-x-0 top-1.5 mx-auto h-[86%] w-auto object-contain" />
            <span className="relative rounded-lg bg-white/90 px-2 py-0.5 text-[12px] font-extrabold">{p.name}</span>
            {pick === i && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-lg bg-[#111111] text-white"><Check className="h-4 w-4" /></span>}
          </motion.button>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-noir via-noir to-transparent px-5 pb-safe pt-8">
        <button onClick={() => navigate(`/avatar?preset=${pick}`, { replace: true })} className="h-14 w-full rounded-2xl bg-[#111111] text-base font-extrabold text-white active:scale-[0.98]">
          Customise {PRESETS[pick]?.name ?? 'avatar'}
        </button>
        <button onClick={skip} className="mt-2 h-11 w-full text-sm font-extrabold text-ink-mute">Skip for now</button>
      </div>
    </div>
  );
}
