import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarHeart, PencilLine, Settings, Share2 } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { AURA } from '@/lib/types';

export default function ProfileScreen() {
  const { profile } = useAuth();
  const toast = useToast();
  if (!profile) return null;
  const aura = AURA[profile.aura_color];
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

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

  return (
    <div className="pb-36">
      <ScreenHeader
        title=""
        back
        right={
          <Link to="/settings" className="glass grid h-10 w-10 place-items-center rounded-full" aria-label="Settings">
            <Settings className="h-5 w-5" />
          </Link>
        }
      />
      <div className="relative px-5">
        <div
          aria-hidden
          className="absolute inset-x-6 -top-6 h-48 rounded-full opacity-50 blur-3xl"
          style={{ background: `radial-gradient(closest-side, ${aura.from}, transparent)` }}
        />
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} className="relative flex flex-col items-center">
          <Avatar name={profile.display_name} url={profile.avatar_url} aura={profile.aura_color} size={120} />
          <h2 className="mt-4 font-display text-2xl font-semibold">{profile.display_name}</h2>
          <p className="text-sm text-ink-mute">@{profile.username}</p>
          {profile.bio && <p className="mt-3 max-w-xs text-center text-[15px] text-ink-soft">{profile.bio}</p>}
          <div className="mt-6 flex w-full max-w-sm gap-2">
            <Link to="/profile/edit" className="glass flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold active:scale-[0.97]">
              <PencilLine className="h-4 w-4" /> Edit profile
            </Link>
            <button onClick={share} className="glass flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-semibold active:scale-[0.97]">
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </motion.div>

        <div className="mx-auto mt-6 max-w-sm space-y-3">
          <div className="glass flex items-center gap-3 rounded-3xl p-4">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5">
              <CalendarHeart className="h-5 w-5 text-aurora-peach" />
            </span>
            <div>
              <p className="text-sm font-medium">Joined {joined}</p>
              <p className="text-xs text-ink-mute">Friends, streaks and avatar arrive in upcoming releases.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
