import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Camera, ChevronLeft, ChevronRight, Flame, Loader2, MessageCircle, MoreHorizontal, Phone, Play, Sparkles, UserPlus, Video } from 'lucide-react';
import { AvatarFigure } from '@/components/AvatarFigure';
import { Sheet, SheetItem } from '@/components/ui/Sheet';
import { useCalls } from '@/providers/CallProvider';
import { supabase } from '@/lib/supabase';
import type { SceneId } from '@/lib/types';
import { Scene } from '@/components/Scene';
import { Ghost, GHOST_HOST } from '@/components/ui/Ghost';
import { friendBirthdays, type FriendBirthday } from '@/lib/birthdays';
import { formatDayMonth, matchScore, monthDay, signFor } from '@/lib/zodiac';
import { cn } from '@/lib/cn';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { chatApi, friendsApi } from '@/lib/chat/api';
import { spotlightApi, storiesApi, streaksApi, type Creator, type FriendshipProfile, type StoryRing } from '@/lib/social/api';
import { publicUrl } from '@/lib/storageUrl';
import { StoryViewer } from '@/features/stories/StoryViewer';
import type { Story } from '@/lib/social/api';

export default function PersonScreen() {
  const { username = '' } = useParams();
  const { session } = useAuth();
  const me = session!.user.id;
  const toast = useToast();
  const navigate = useNavigate();
  const [c, setC] = useState<Creator | null | undefined>(undefined);
  const [fp, setFp] = useState<FriendshipProfile | null>(null);
  const [videos, setVideos] = useState<Awaited<ReturnType<typeof spotlightApi.byUser>>>([]);
  const [highlights, setHighlights] = useState<{ id: string; title: string; highlight_items: { story_id: string }[] }[]>([]);
  const [viewing, setViewing] = useState<Story[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [body, setBody] = useState<string | null>(null);
  const [scene, setScene] = useState<SceneId>('dusk');
  const [bday, setBday] = useState<FriendBirthday | null>(null);
  const [theirStories, setTheirStories] = useState<Story[]>([]);
  const { settings } = useAuth();
  const calls = useCalls();

  async function load() {
    try {
      const cr = await spotlightApi.creator(username);
      setC(cr);
      if (!cr) return;
      void spotlightApi.byUser(cr.id).then(setVideos).catch(() => undefined);
      void storiesApi.highlights(cr.id).then(setHighlights).catch(() => undefined);
      if (cr.is_friend) void streaksApi.friendship(cr.id).then(setFp).catch(() => undefined);
      void supabase.from('profiles').select('avatar_body_url,profile_scene').eq('id', cr.id).maybeSingle().then(({ data }) => {
        const row = data as { avatar_body_url: string | null; profile_scene: SceneId | null } | null;
        setBody(row?.avatar_body_url ?? null);
        setScene(row?.profile_scene ?? 'dusk');
      });
      if (cr.is_friend) void friendBirthdays().then((l) => setBday(l.find((b) => b.user_id === cr.id) ?? null)).catch(() => undefined);
      void storiesApi.ofUser(cr.id).then(setTheirStories).catch(() => undefined);
    } catch (e) {
      toast((e as Error).message, 'error');
      setC(null);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  if (c === undefined) return <div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-mute" /></div>;
  if (c === null) return (<div className="pb-16"><ScreenHeader title="" back /><p className="px-6 pt-16 text-center text-ink-mute">This profile isn’t available.</p></div>);
  if (c.is_me) navigate('/profile', { replace: true });

  const ring: StoryRing = { user_id: c.id, username: c.username, display_name: c.display_name, avatar_url: c.avatar_url, aura_color: c.aura_color, story_count: 0, unseen: false, latest_at: '', is_me: false, is_friend: c.is_friend };

  async function run(fn: () => Promise<unknown>, msg?: string) {
    setBusy(true);
    try {
      await fn();
      if (msg) toast(msg, 'success');
      await load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const first = c.display_name.split(' ')[0];
  const openChat = async () => navigate(`/chat/${await chatApi.getOrCreateDirect(c.id)}`);
  const call = async (kind: 'voice' | 'video') => {
    try {
      await calls.startCall(await chatApi.getOrCreateDirect(c.id), kind);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="min-h-full bg-noir pb-16">
      {/* Hero (wireframe 7): their full-body avatar in their scene */}
      <div className="relative h-[340px]">
        <Scene id={scene} className="absolute inset-0" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(17,17,17,.5) 100%)' }} />
        <header className="relative z-10 flex items-center gap-2 px-3.5 pt-safe">
          <button onClick={() => navigate(-1)} aria-label="Back" className={CIRCLE}><ChevronLeft className="h-5 w-5" /></button>
          <span className="flex-1" />
          <button onClick={() => setMenu(true)} aria-label="More options" className={CIRCLE}><MoreHorizontal className="h-5 w-5" /></button>
        </header>
        <div className="absolute bottom-0 right-5">
          <AvatarFigure name={c.display_name} bodyUrl={body} faceUrl={c.avatar_url} aura={c.aura_color} height={270} />
        </div>
        <div className="absolute bottom-[18px] left-[18px] text-white">
          <span className="inline-block rounded-full border-4 border-white"><Avatar name={c.display_name} url={c.avatar_url} aura={c.aura_color} size={80} /></span>
          <h1 className="mt-2 font-display text-[32px] leading-none" style={{ textShadow: '0 2px 10px rgba(17,17,17,.35)' }}>{c.display_name}</h1>
          <p className="text-[13px] font-bold opacity-90">@{c.username}{c.is_friend ? ` · ${fp?.is_best_friend ? 'Best friends' : 'Friends'}` : ''}</p>
        </div>
      </div>

      <div className="mx-auto max-w-md px-3.5">
        {(fp?.streak || bday || c.bio) && (
          <div className="no-scrollbar -mx-3.5 flex gap-2 overflow-x-auto px-3.5 pt-3">
            {fp && fp.streak > 0 && <span className={cn(CHIP, 'bg-ember-gold text-ink')}><Flame className="h-[14px] w-[14px] fill-current" />{fp.streak} days{fp.streak_expiring ? ' · ends soon' : ''}</span>}
            {bday && <button onClick={() => navigate('/birthdays')} className={cn(CHIP, bday.inDays === 0 ? 'bg-ember-rose text-white' : 'bg-white text-ink')}>🎂 {bday.inDays === 0 ? 'Today!' : formatDayMonth(bday.month, bday.day)}</button>}
            {bday && <button onClick={() => navigate('/birthdays?tab=zodiac')} className={cn(CHIP, 'bg-[#111111] text-white')}>{bday.sign.glyph} {bday.sign.name}</button>}
          </div>
        )}
        {c.bio && <p className="mt-2 px-1 text-sm text-ink-soft">{c.bio}</p>}

        {c.is_friend ? (
          <div className="flex gap-2 py-4">
            <button onClick={() => void openChat()} className={ACT}><MessageCircle className="h-[22px] w-[22px]" />Chat</button>
            <button onClick={() => navigate('/')} className={ACT}><Camera className="h-[22px] w-[22px]" />Snap</button>
            <button onClick={() => void call('voice')} className={ACT}><Phone className="h-[22px] w-[22px]" />Call</button>
            <button onClick={() => void call('video')} className={ACT}><Video className="h-[22px] w-[22px]" />Video</button>
          </div>
        ) : (
          <div className="flex gap-2 py-4">
            <button disabled={busy} onClick={() => void run(() => friendsApi.send(c.id), 'Friend request sent')} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#111111] font-extrabold text-white disabled:opacity-60"><UserPlus className="h-5 w-5" /> Add friend</button>
            <button disabled={busy} onClick={() => void run(() => (c.is_following ? spotlightApi.unfollow(me, c.id) : spotlightApi.follow(me, c.id)))} className="h-12 flex-1 rounded-2xl bg-white font-extrabold">{c.is_following ? 'Following' : 'Follow'}</button>
          </div>
        )}

        {bday && bday.inDays === 0 && (
          <button onClick={() => navigate('/')} className={cn('mb-2.5 flex w-full items-center gap-3 rounded-tile bg-ember-rose p-4 text-left text-white', GHOST_HOST)}>
            <Ghost size={120} opacity={0.25} className="-right-2 -top-6"><span className="text-[96px] leading-none">🎂</span></Ghost>
            <span className="flex-1"><span className="eyebrow text-white/85">Birthday today</span><span className="block text-base font-extrabold">Send {first} a birthday snap</span></span>
            <span className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-ink">Wish</span>
          </button>
        )}
        {bday && settings?.date_of_birth && (() => {
          const md = monthDay(settings.date_of_birth);
          if (!md) return null;
          const m = matchScore(signFor(md.month, md.day), bday.sign);
          return (
            <button onClick={() => navigate('/birthdays?tab=zodiac')} className={cn('mb-2.5 block w-full rounded-tile bg-[#111111] p-4 text-left text-white', GHOST_HOST)}>
              <Ghost size={170} opacity={0.14} className="-right-4 -top-8"><span className="text-[150px] font-black leading-none">{bday.sign.glyph}</span></Ghost>
              <span className="eyebrow text-white/70">Zodiac match</span>
              <span className="mt-1 block font-display text-[22px] leading-tight">{bday.sign.name} × {signFor(md.month, md.day).name}</span>
              <span className="mt-3 block h-2 overflow-hidden rounded-full bg-white/20"><span className="block h-full rounded-full bg-ember-rose" style={{ width: `${m.score}%` }} /></span>
              <span className="mt-1.5 block text-[13px] font-extrabold">{m.score}% · {m.line}</span>
            </button>
          );
        })()}
        {fp && (
          <div className={cn('rounded-tile bg-white px-4 py-3.5', GHOST_HOST)}>
            <Ghost url={c.avatar_url} />
            <div className="flex justify-between py-1.5 text-sm"><span className="text-ink-mute">Friends since</span><span className="font-extrabold">{new Date(fp.friends_since).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span></div>
            <div className="flex justify-between py-1.5 text-sm"><span className="text-ink-mute">Snaps shared</span><span className="font-extrabold">{fp.snaps_exchanged.toLocaleString()}</span></div>
            <div className="flex justify-between py-1.5 text-sm"><span className="text-ink-mute">Best streak</span><span className="font-extrabold">{fp.best_streak}</span></div>
            {fp.anniversary_today && <p className="pt-1 text-sm font-bold text-ember-rose">Happy friendiversary!</p>}
            <RestoreStreak friendId={c.id} onDone={load} />
          </div>
        )}

        {theirStories.length > 0 && (
          <button onClick={() => setViewing(theirStories)} className={cn('mt-2.5 flex w-full items-center gap-3 rounded-tile bg-white px-4 py-3.5 text-left', GHOST_HOST)}>
            <Ghost url={c.avatar_url} />
            <Avatar name={c.display_name} url={c.avatar_url} aura={c.aura_color} size={46} ring />
            <span className="flex-1"><span className="block font-extrabold">{first}'s story</span><span className="text-xs text-ink-mute">{theirStories.length} {theirStories.length === 1 ? 'snap' : 'snaps'}</span></span>
            <ChevronRight className="h-[18px] w-[18px] text-ink-faint" />
          </button>
        )}

        {highlights.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-ink-mute">Highlights</h2>
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
              {highlights.map((h) => (
                <button key={h.id} onClick={async () => setViewing(await storiesApi.byIds(h.highlight_items.map((x) => x.story_id)))} className="flex w-20 shrink-0 flex-col items-center gap-1.5">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-ember-flame/60 to-ember-jade/50 ring-2 ring-ink/20"><Sparkles className="h-6 w-6" /></span>
                  <span className="w-full truncate text-center text-xs">{h.title}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-ink-mute">Spotlight</h2>
          {videos.length === 0 ? (
            <p className="glass rounded-3xl p-6 text-center text-sm text-ink-mute">No Spotlight videos yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {videos.map((v) => (
                <a key={v.id} href={publicUrl('spotlight', v.media_path)} target="_blank" rel="noreferrer" className="relative aspect-[9/16] overflow-hidden rounded-xl bg-ink/5">
                  {v.poster_path ? <img src={publicUrl('spotlight', v.poster_path)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center"><Play className="h-6 w-6" /></span>}
                  <span className="absolute bottom-1 left-1.5 flex items-center gap-1 text-[11px] font-semibold text-white drop-shadow"><Play className="h-3 w-3" /> {v.view_count}</span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
      <Sheet open={menu} onClose={() => setMenu(false)}>
        <div className="pb-3">
          <SheetItem icon={<UserPlus className="h-4 w-4" />} label={c.is_following ? 'Unfollow on Spotlight' : 'Follow on Spotlight'} onClick={() => { setMenu(false); void run(() => (c.is_following ? spotlightApi.unfollow(me, c.id) : spotlightApi.follow(me, c.id))); }} />
          {c.is_friend && <SheetItem icon={<MessageCircle className="h-4 w-4" />} label="Chat settings" onClick={async () => { setMenu(false); navigate(`/chat/${await chatApi.getOrCreateDirect(c.id)}/info`); }} />}
        </div>
      </Sheet>
      <AnimatePresence>{viewing && <StoryViewer rings={[ring]} startIndex={0} preloaded={viewing} onClose={() => setViewing(null)} />}</AnimatePresence>
    </div>
  );
}

const CIRCLE = 'grid h-10 w-10 place-items-center rounded-2xl bg-white/90 text-ink active:scale-90';
const ACT = 'flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-white py-3 text-xs font-extrabold text-ink active:scale-95';
const CHIP = 'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-extrabold';


function RestoreStreak({ friendId, onDone }: { friendId: string; onDone: () => void }) {
  const toast = useToast();
  const [restorable, setRestorable] = useState(false);
  useEffect(() => {
    void streaksApi.mine().then((s) => setRestorable(!!s.find((x) => x.friend_id === friendId)?.restorable)).catch(() => undefined);
  }, [friendId]);
  if (!restorable) return null;
  return (
    <button onClick={async () => { try { const n = await streaksApi.restore(friendId); toast(`Streak of ${n} restored 🔥`, 'success'); onDone(); } catch (e) { toast((e as Error).message, 'error'); } }} className="mt-4 w-full rounded-2xl bg-ink/10 py-2.5 text-sm font-semibold">
      🔥 Restore your streak (once every 30 days)
    </button>
  );
}
