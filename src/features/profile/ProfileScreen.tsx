import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight, Grid2x2, Settings, Share2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { AvatarFigure } from '@/components/AvatarFigure';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { friendsApi } from '@/lib/chat/api';
import { memoriesApi, streaksApi } from '@/lib/social/api';
import type { Friend } from '@/lib/chat/types';

const circle = 'grid h-10 w-10 place-items-center rounded-full bg-white/80 text-ink active:scale-90';
const card = 'rounded-[20px] bg-white px-4 py-3.5 shadow-[0_1px_0_rgba(30,42,74,0.06),0_8px_22px_-14px_rgba(30,42,74,0.3)]';

/** My profile (wireframe 6): full-body avatar hero, name line, two actions, My stories / Friends / Memories cards. */
export default function ProfileScreen() {
  const { profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [best, setBest] = useState(0);
  const [saved, setSaved] = useState<number | null>(null);
  useEffect(() => {
    void friendsApi.list().then(setFriends).catch(() => setFriends([]));
    void streaksApi.mine().then((l) => setBest(l.reduce((m, s) => Math.max(m, s.best, s.count), 0))).catch(() => undefined);
    void memoriesApi.usage().then((u) => setSaved(u?.items ?? 0)).catch(() => undefined);
  }, []);
  if (!profile) return null;

  async function share() {
    const text = `Add me on SUMANOVA: @${profile!.username}`;
    try {
      if (navigator.share) await navigator.share({ title: 'SUMANOVA', text, url: location.origin });
      else {
        await navigator.clipboard.writeText(text);
        toast('Copied your handle', 'success');
      }
    } catch {
      /* user cancelled */
    }
  }

  const line = [`@${profile.username}`, friends ? `${friends.length} ${friends.length === 1 ? 'friend' : 'friends'}` : null, best > 0 ? `Best streak ${best}` : null].filter(Boolean).join(' · ');
  const shown = (friends ?? []).slice(0, 4);
  const more = (friends?.length ?? 0) - shown.length;

  return (
    <div className="min-h-full bg-[#f4f6fd] pb-10">
      <div className="relative h-[330px] bg-gradient-to-b from-[#dfe6ff] to-[#f4f6fd]">
        <header className="flex items-center gap-2 px-3.5 pt-safe">
          <button onClick={() => navigate(-1)} aria-label="Back" className={circle}>
            <ChevronDown className="h-5 w-5" />
          </button>
          <span className="flex-1" />
          <button onClick={() => void share()} aria-label="Share profile" className={circle}>
            <Share2 className="h-5 w-5" />
          </button>
          <Link to="/settings" aria-label="Settings" className={circle}>
            <Settings className="h-5 w-5" />
          </Link>
        </header>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="absolute inset-x-0 top-[calc(var(--safe-top)+42px)] flex justify-center">
          <Link to="/avatar" aria-label="Edit my avatar" className="active:scale-[0.98]">
            <AvatarFigure name={profile.display_name} bodyUrl={profile.avatar_body_url} faceUrl={profile.avatar_url} aura={profile.aura_color} height={250} />
          </Link>
        </motion.div>
      </div>

      <div className="-mt-1.5 text-center">
        <h1 className="font-display text-[34px] leading-[1.1]">{profile.display_name}</h1>
        <p className="mt-0.5 text-[13px] font-semibold text-ink-mute">{line}</p>
        <div className="mt-3.5 flex justify-center gap-2.5">
          <Link to="/avatar" className="rounded-full bg-ember-flame px-[18px] py-[11px] text-sm font-extrabold text-white active:scale-[0.97]">Edit avatar</Link>
          <Link to="/profile/edit" className="rounded-full bg-white px-[18px] py-[11px] text-sm font-extrabold shadow-[0_1px_0_rgba(30,42,74,0.08)] active:scale-[0.97]">Edit profile</Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-md flex-col gap-2.5 px-4 pt-[18px]">
        <div className={card}>
          <h2 className="text-[15px] font-extrabold">My stories</h2>
          <Link to="/" className="mt-2.5 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-ember-flame/[0.12] text-2xl font-extrabold text-ember-flame">+</span>
            <span className="flex-1">
              <span className="block font-extrabold">Add to my story</span>
              <span className="block text-xs text-ink-mute">Friends can see it for 24 hours</span>
            </span>
          </Link>
        </div>

        <div className={card}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-extrabold">Friends</h2>
            <Link to="/friends" className="text-[13px] font-extrabold text-ember-flame">Add friends</Link>
          </div>
          <div className="mt-2.5 flex gap-2.5">
            {friends === null ? (
              [0, 1, 2, 3].map((i) => <span key={i} className="h-[46px] w-[46px] animate-pulse rounded-full bg-ink/[0.06]" />)
            ) : friends.length === 0 ? (
              <p className="text-sm text-ink-mute">No friends yet — tap Add friends.</p>
            ) : (
              <>
                {shown.map((f) => (
                  <Link key={f.id} to={`/u/${f.username}`} aria-label={f.display_name}>
                    <Avatar name={f.display_name} url={f.avatar_url} aura={f.aura_color} size={46} />
                  </Link>
                ))}
                {more > 0 && <Link to="/friends" className="grid h-[46px] w-[46px] place-items-center rounded-full bg-ink/[0.06] text-[13px] font-extrabold text-ink-mute">+{more}</Link>}
              </>
            )}
          </div>
        </div>

        <Link to="/memories" className={`${card} flex items-center gap-3`}>
          <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#d8f5ea] text-ember-jade">
            <Grid2x2 className="h-[22px] w-[22px]" />
          </span>
          <span className="flex-1">
            <span className="block font-extrabold">Memories</span>
            <span className="block text-xs text-ink-mute">{saved === null ? 'Your saved snaps' : `${saved} saved ${saved === 1 ? 'snap' : 'snaps'}`}</span>
          </span>
          <ChevronRight className="h-[18px] w-[18px] text-ink-faint" />
        </Link>
      </div>
    </div>
  );
}
