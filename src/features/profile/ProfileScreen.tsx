import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, ChevronDown, ChevronRight, Grid2x2, QrCode, Settings, Shirt } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { AvatarFigure } from '@/components/AvatarFigure';
import { Scene } from '@/components/Scene';
import { Ghost, GHOST_HOST } from '@/components/ui/Ghost';
import { useAuth } from '@/providers/AuthProvider';
import { friendsApi } from '@/lib/chat/api';
import { memoriesApi, streaksApi } from '@/lib/social/api';
import { friendBirthdays, type FriendBirthday } from '@/lib/birthdays';
import { formatDayMonth, monthDay, signFor } from '@/lib/zodiac';
import type { Friend } from '@/lib/chat/types';
import { cn } from '@/lib/cn';
import { supabase } from '@/lib/supabase';
import { NovaEmoji } from '@/components/emoji/NovaEmoji';

const btn = 'grid h-10 w-10 place-items-center rounded-2xl bg-white/90 text-ink active:scale-90';
const tile = cn('block rounded-tile bg-white px-4 py-3.5', GHOST_HOST);
const chip = 'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-extrabold';

/**
 * My profile (Snapchat-familiar layout, Bento look): my full-body avatar stands
 * in my scene at the back — tap it to dress up. Picture bottom-left (avatar face
 * or selfie), birthday / zodiac / streak chips, then tiles.
 */
export default function ProfileScreen() {
  const { profile, settings } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [score, setScore] = useState<number | null>(null);
  useEffect(() => {
    if (!profile) return;
    void supabase.rpc('snap_score', { p_user: profile.id }).then(({ data }) => setScore(typeof data === 'number' ? data : null));
  }, [profile]);
  const [best, setBest] = useState(0);
  const [saved, setSaved] = useState<number | null>(null);
  const [bdays, setBdays] = useState<FriendBirthday[] | null>(null);
  useEffect(() => {
    void friendsApi.list().then(setFriends).catch(() => setFriends([]));
    void streaksApi.mine().then((l) => setBest(l.reduce((m, s) => Math.max(m, s.best, s.count), 0))).catch(() => undefined);
    void memoriesApi.usage().then((u) => setSaved(u?.items ?? 0)).catch(() => undefined);
    void friendBirthdays().then(setBdays).catch(() => setBdays([]));
  }, []);
  if (!profile) return null;

  const md = monthDay(settings?.date_of_birth);
  const sign = md ? signFor(md.month, md.day) : null;
  const shown = (friends ?? []).slice(0, 5);
  const more = (friends?.length ?? 0) - shown.length;
  const next = bdays?.[0];

  return (
    <div className="min-h-full bg-noir pb-10">
      <div className="relative h-[368px]">
        <Scene id={profile.profile_scene ?? 'dusk'} className="absolute inset-0" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(17,17,17,.5) 100%)' }} />
        <header className="relative z-10 flex items-center gap-2 px-3.5 pt-safe">
          <button onClick={() => navigate(-1)} aria-label="Back" className={btn}>
            <ChevronDown className="h-5 w-5" />
          </button>
          <span className="flex-1" />
          <Link to="/profile/code" aria-label="My profile code" className={btn}>
            <QrCode className="h-5 w-5" />
          </Link>
          <Link to="/avatar/home" aria-label="My avatar and outfits" className={btn}>
            <Shirt className="h-5 w-5" />
          </Link>
          <Link to="/settings" aria-label="Settings" className={btn}>
            <Settings className="h-5 w-5" />
          </Link>
        </header>
        {profile.avatar_body_url ? (
          <>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="absolute bottom-0 right-4">
              <Link to="/avatar/home" aria-label="Open my avatar" className="block active:scale-[0.98]">
                <AvatarFigure name={profile.display_name} bodyUrl={profile.avatar_body_url} faceUrl={profile.avatar_face_url ?? profile.avatar_url} aura={profile.aura_color} height={290} />
              </Link>
            </motion.div>
            <Link to="/avatar/home" className="absolute right-6 top-[calc(var(--safe-top)+64px)] rounded-xl bg-white/90 px-2.5 py-1.5 text-[11px] font-extrabold text-ink">
              Tap me to dress up
            </Link>
          </>
        ) : (
          <Link to="/onboarding/avatar?from=profile" className="absolute right-4 top-[calc(var(--safe-top)+70px)] w-[168px] overflow-hidden rounded-tile bg-white p-3 text-ink shadow-glass active:scale-[0.98]">
            <img src="/presets/1.webp" alt="" className="mx-auto h-[150px] w-auto object-contain" />
            <span className="mt-1 block text-[15px] font-black leading-tight">Create your avatar</span>
            <span className="block text-xs font-semibold text-ink-mute">Pick a character and make it yours →</span>
          </Link>
        )}
        <div className="absolute bottom-[18px] left-[18px] text-white">
          <Link to="/profile/photo" aria-label="Change profile picture" className="relative inline-block rounded-full border-4 border-white">
            <Avatar name={profile.display_name} url={profile.avatar_url} aura={profile.aura_color} size={84} />
            <span className="absolute -bottom-1 -right-1 grid h-[30px] w-[30px] place-items-center rounded-xl border-[3px] border-white bg-[#111111]">
              <Camera className="h-[15px] w-[15px] text-white" />
            </span>
          </Link>
          <h1 className="mt-2 font-display text-[32px] leading-none" style={{ textShadow: '0 2px 10px rgba(17,17,17,.35)' }} translate="no">{profile.display_name}</h1>
          <p className="text-[13px] font-bold opacity-90">@{profile.username}</p>
        </div>
      </div>

      <div className="mx-auto flex max-w-md flex-col gap-2.5 px-3.5 pt-3">
        <div className="no-scrollbar -mx-3.5 flex gap-2 overflow-x-auto px-3.5">
          {md ? (
            <Link to="/birthdays" className={cn(chip, 'bg-ember-rose text-white')}><NovaEmoji id="cake" size={16} /> {formatDayMonth(md.month, md.day)}</Link>
          ) : (
            <Link to="/settings" className={cn(chip, 'bg-white text-ink')}><NovaEmoji id="cake" size={16} /> Add birthday</Link>
          )}
          {profile?.mood_emoji && profile.mood_until && new Date(profile.mood_until).getTime() > Date.now() && (
            <Link to="/map" className={cn(chip, 'bg-white text-ink')}><NovaEmoji id={profile.mood_emoji as never} size={16} /> {profile.mood_text ?? 'My mood'}</Link>
          )}
          {score !== null && <Link to="/trophies" className={cn(chip, 'bg-[#111111] text-white')}><NovaEmoji id="nova" size={16} /> {score.toLocaleString()} · Trophies</Link>}
          {sign && <Link to="/birthdays?tab=zodiac" className={cn(chip, 'bg-[#111111] text-white')}>{sign.glyph} {sign.name}</Link>}
          {best > 0 && <span className={cn(chip, 'bg-ember-gold text-ink')}><NovaEmoji id="flame" size={16} /> {best} best</span>}
          {friends && <Link to="/friends" className={cn(chip, 'bg-white text-ink')}>{friends.length} {friends.length === 1 ? 'friend' : 'friends'}</Link>}
        </div>

        <Link to="/" className={tile}>
          <Ghost><Camera className="h-full w-full" strokeWidth={1.4} /></Ghost>
          <span className="eyebrow">My story</span>
          <span className="mt-1 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink/[0.06] text-2xl font-extrabold">+</span>
            <span className="flex-1">
              <span className="block font-extrabold">Add to my story</span>
              <span className="block text-xs text-ink-mute">Friends can see it for 24 hours</span>
            </span>
          </span>
        </Link>

        {next && (
          <Link to="/birthdays" className={cn(tile, next.inDays === 0 ? 'bg-ember-rose text-white' : '')}>
            <Ghost url={next.avatar_url} opacity={next.inDays === 0 ? 0.25 : 0.1} />
            <span className={cn('eyebrow', next.inDays === 0 && 'text-white/85')}>{next.inDays === 0 ? 'Birthday today 🎂' : 'Next birthday'}</span>
            <span className="mt-1 flex items-center gap-3">
              <Avatar name={next.display_name} url={next.avatar_url} aura={next.aura_color} size={44} />
              <span className="flex-1">
                <span className="block font-extrabold">{next.display_name}</span>
                <span className={cn('block text-xs', next.inDays === 0 ? 'text-white/85' : 'text-ink-mute')}>
                  {formatDayMonth(next.month, next.day)} · {next.inDays === 0 ? 'today' : next.inDays === 1 ? 'tomorrow' : `in ${next.inDays} days`} · {next.sign.glyph}
                </span>
              </span>
              <ChevronRight className="h-[18px] w-[18px] opacity-60" />
            </span>
          </Link>
        )}

        <div className={tile}>
          <Ghost url={shown[0]?.avatar_url} />
          <div className="flex items-baseline justify-between">
            <span className="eyebrow">Friends</span>
            <Link to="/friends" className="text-[13px] font-extrabold">Add friends</Link>
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

        <Link to="/memories" className={cn(tile, 'flex items-center gap-3')}>
          <Ghost><Grid2x2 className="h-full w-full" strokeWidth={1.4} /></Ghost>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#D8F5EA] text-ember-jade">
            <Grid2x2 className="h-[22px] w-[22px]" />
          </span>
          <span className="flex-1">
            <span className="block font-extrabold">Memories</span>
            <span className="block text-xs text-ink-mute">{saved === null ? 'Your saved snaps' : `${saved} saved ${saved === 1 ? 'snap' : 'snaps'}`}</span>
          </span>
          <ChevronRight className="h-[18px] w-[18px] text-ink-faint" />
        </Link>

        <div className="grid grid-cols-2 gap-2.5">
          <Link to="/recap" className={cn(tile, 'bg-[#FF4F9A] text-white')}>
            <span className="block font-display text-2xl">{new Date().getFullYear()}</span>
            <span className="block text-sm font-extrabold">Your year recap</span>
          </Link>
          <Link to="/quizzes" className={cn(tile, 'bg-[#111111] text-white')}>
            <span className="block font-display text-2xl">?!</span>
            <span className="block text-sm font-extrabold">Friend quizzes</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
