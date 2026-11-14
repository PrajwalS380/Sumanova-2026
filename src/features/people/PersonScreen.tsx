import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, Heart, Hourglass, Loader2, MessageCircle, Play, Sparkles, UserPlus } from 'lucide-react';
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

  async function load() {
    try {
      const cr = await spotlightApi.creator(username);
      setC(cr);
      if (!cr) return;
      void spotlightApi.byUser(cr.id).then(setVideos).catch(() => undefined);
      void storiesApi.highlights(cr.id).then(setHighlights).catch(() => undefined);
      if (cr.is_friend) void streaksApi.friendship(cr.id).then(setFp).catch(() => undefined);
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

  return (
    <div className="pb-16">
      <ScreenHeader title="" back />
      <div className="mx-auto max-w-md px-4">
        <div className="flex flex-col items-center text-center">
          <Avatar name={c.display_name} url={c.avatar_url} aura={c.aura_color} size={108} />
          <h1 className="mt-3 font-display text-2xl font-medium">{c.display_name}</h1>
          <p className="text-sm text-ink-mute">@{c.username}</p>
          {c.bio && <p className="mt-2 max-w-xs text-sm text-ink-soft">{c.bio}</p>}
          <div className="mt-4 flex gap-6 text-center">
            <Stat n={c.followers} l="Followers" />
            <Stat n={c.videos} l="Spotlights" />
            <Stat n={c.likes} l="Likes" />
          </div>
          <div className="mt-5 flex w-full gap-2">
            {c.is_friend ? (
              <button onClick={async () => navigate(`/chat/${await chatApi.getOrCreateDirect(c.id)}`)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-ember-gradient text-noir font-semibold shadow-glow"><MessageCircle className="h-5 w-5" /> Chat</button>
            ) : (
              <button disabled={busy} onClick={() => void run(() => friendsApi.send(c.id), 'Friend request sent')} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-ember-gradient text-noir font-semibold shadow-glow disabled:opacity-60"><UserPlus className="h-5 w-5" /> Add friend</button>
            )}
            <button disabled={busy} onClick={() => void run(() => (c.is_following ? spotlightApi.unfollow(me, c.id) : spotlightApi.follow(me, c.id)))} className="glass h-12 flex-1 rounded-2xl font-semibold">{c.is_following ? 'Following' : 'Follow'}</button>
          </div>
        </div>

        {fp && (
          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative mt-6 overflow-hidden rounded-4xl bg-gradient-to-br from-ember-flame/30 via-noir-700 to-ember-rose/20 p-5 ring-1 ring-white/10">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">You & {c.display_name.split(' ')[0]}</p>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="flex items-center justify-center gap-1 font-display text-2xl font-medium">{fp.streak}<Flame className="h-5 w-5 text-ember-peach" />{fp.streak_expiring && <Hourglass className="h-4 w-4 text-ember-gold" />}</p>
                <p className="text-[11px] text-ink-mute">Day streak</p>
              </div>
              <div><p className="font-display text-2xl font-medium">{fp.snaps_exchanged}</p><p className="text-[11px] text-ink-mute">Snaps shared</p></div>
              <div><p className="font-display text-2xl font-medium">{fp.best_streak}</p><p className="text-[11px] text-ink-mute">Best streak</p></div>
            </div>
            <p className="mt-4 text-sm text-ink-soft">Friends since {new Date(fp.friends_since).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}{fp.anniversary_today && ' — happy friendiversary! 🎉'}</p>
            {fp.streak_expiring && <p className="mt-2 text-xs text-ember-gold">⏳ Send each other a snap today to keep your streak alive.</p>}
            {fp.badges.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {fp.badges.map((b) => <span key={b} className="rounded-full bg-white/10 px-2.5 py-1 text-xs">{b}</span>)}
              </div>
            )}
            {fp.is_best_friend && <Heart className="absolute right-4 top-4 h-5 w-5 fill-ember-rose text-ember-rose" />}
            <RestoreStreak friendId={c.id} onDone={load} />
          </motion.section>
        )}

        {highlights.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-ink-mute">Highlights</h2>
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
              {highlights.map((h) => (
                <button key={h.id} onClick={async () => setViewing(await storiesApi.byIds(h.highlight_items.map((x) => x.story_id)))} className="flex w-20 shrink-0 flex-col items-center gap-1.5">
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-ember-flame/60 to-ember-jade/50 ring-2 ring-white/20"><Sparkles className="h-6 w-6" /></span>
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
                <a key={v.id} href={publicUrl('spotlight', v.media_path)} target="_blank" rel="noreferrer" className="relative aspect-[9/16] overflow-hidden rounded-xl bg-white/5">
                  {v.poster_path ? <img src={publicUrl('spotlight', v.poster_path)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center"><Play className="h-6 w-6" /></span>}
                  <span className="absolute bottom-1 left-1.5 flex items-center gap-1 text-[11px] font-semibold text-white drop-shadow"><Play className="h-3 w-3" /> {v.view_count}</span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
      <AnimatePresence>{viewing && <StoryViewer rings={[ring]} startIndex={0} preloaded={viewing} onClose={() => setViewing(null)} />}</AnimatePresence>
    </div>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (<div><p className="font-display text-lg font-medium">{n}</p><p className="text-[11px] text-ink-mute">{l}</p></div>);
}

function RestoreStreak({ friendId, onDone }: { friendId: string; onDone: () => void }) {
  const toast = useToast();
  const [restorable, setRestorable] = useState(false);
  useEffect(() => {
    void streaksApi.mine().then((s) => setRestorable(!!s.find((x) => x.friend_id === friendId)?.restorable)).catch(() => undefined);
  }, [friendId]);
  if (!restorable) return null;
  return (
    <button onClick={async () => { try { const n = await streaksApi.restore(friendId); toast(`Streak of ${n} restored 🔥`, 'success'); onDone(); } catch (e) { toast((e as Error).message, 'error'); } }} className="mt-4 w-full rounded-2xl bg-white/10 py-2.5 text-sm font-semibold">
      🔥 Restore your streak (once every 30 days)
    </button>
  );
}
