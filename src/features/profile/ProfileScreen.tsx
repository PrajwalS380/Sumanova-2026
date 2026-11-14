import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarHeart, ChevronRight, PencilLine, Settings, Share2, Sparkles, Users } from 'lucide-react';
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
          className="absolute inset-x-0 -top-10 h-64 opacity-60"
          style={{ background: `radial-gradient(closest-side, ${aura.from}, transparent 75%)` }}
        />
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} className="relative flex flex-col items-center">
          <Avatar name={profile.display_name} url={profile.avatar_url} aura={profile.aura_color} size={120} />
          <h2 className="mt-4 font-display text-[30px] font-medium leading-tight">{profile.display_name}</h2>
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
          <Link to="/avatar" className="relative flex items-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-br from-ember-flame/40 via-ember-jade/20 to-ember-rose/30 p-4 ring-1 ring-white/10 active:scale-[0.99]">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">Avatar studio</span>
              <span className="block text-xs text-ink-soft">Design your 3D look, outfits & duo stickers</span>
            </span>
            <ChevronRight className="h-4 w-4 text-ink-soft" />
          </Link>
          <Link to="/friends" className="glass flex items-center gap-3 rounded-3xl p-4 active:scale-[0.99]">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5">
              <Users className="h-5 w-5 text-ember-amber" />
            </span>
            <span className="flex-1 text-sm font-medium">Friends & requests</span>
            <ChevronRight className="h-4 w-4 text-ink-mute" />
          </Link>
          <div className="glass flex items-center gap-3 rounded-3xl p-4">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/5">
              <CalendarHeart className="h-5 w-5 text-ember-peach" />
            </span>
            <div>
              <p className="text-sm font-medium">Joined {joined}</p>
              <p className="text-xs text-ink-mute">Your SUMANOVA journey started here ✦</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
