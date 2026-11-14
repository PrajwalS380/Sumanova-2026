import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bookmark, Flag, Heart, Loader2, MessageCircle, MoreHorizontal, Plus, Search, Send, Share2, SlidersHorizontal, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Sheet, SheetItem } from '@/components/ui/Sheet';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { CATEGORIES, spotlightApi, type Category, type SpotlightVideo, type VideoComment } from '@/lib/social/api';
import { publicUrl } from '@/lib/storageUrl';
import { chatApi } from '@/lib/chat/api';
import type { PublicProfile } from '@/lib/chat/types';
import { filterById } from '@/lib/snaps/filters';
import { shortTime } from '@/lib/chat/time';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { UploadSheet } from './UploadSheet';

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`);

export default function SpotlightScreen() {
  const { session, settings, setSettings } = useAuth();
  const me = session!.user.id;
  const toast = useToast();
  const [category, setCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [videos, setVideos] = useState<SpotlightVideo[] | null>(null);
  const [more, setMore] = useState(true);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [comments, setComments] = useState<SpotlightVideo | null>(null);
  const [menu, setMenu] = useState<SpotlightVideo | null>(null);
  const [upload, setUpload] = useState(false);
  const [interests, setInterests] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const loadingMore = useRef(false);

  const load = useCallback(async () => {
    setVideos(null);
    setActive(0);
    scroller.current?.scrollTo({ top: 0 });
    try {
      const v = await spotlightApi.feed({ category, query: query.trim() || null });
      setVideos(v);
      setMore(v.length === 8);
    } catch (e) {
      toast((e as Error).message, 'error');
      setVideos([]);
    }
  }, [category, query, toast]);

  useEffect(() => {
    const t = setTimeout(() => void load(), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  // Track which card is on screen; prefetch the next page near the end.
  function onScroll() {
    const el = scroller.current;
    if (!el || !videos) return;
    const i = Math.round(el.scrollTop / el.clientHeight);
    if (i !== active) setActive(i);
    if (more && !loadingMore.current && i >= videos.length - 3) {
      loadingMore.current = true;
      void spotlightApi.feed({ category, query: query.trim() || null, offset: videos.length }).then((n) => {
        setVideos((v) => [...(v ?? []), ...n.filter((x) => !(v ?? []).some((y) => y.id === x.id))]);
        setMore(n.length === 8);
      }).finally(() => (loadingMore.current = false));
    }
  }

  const patch = (id: string, p: Partial<SpotlightVideo>) => setVideos((v) => v?.map((x) => (x.id === id ? { ...x, ...p } : x)) ?? null);

  async function toggleLike(v: SpotlightVideo, force?: boolean) {
    const like = force ?? !v.liked;
    if (like === v.liked) return;
    haptic(8);
    patch(v.id, { liked: like, like_count: v.like_count + (like ? 1 : -1) });
    try {
      if (like) await spotlightApi.like(v.id, me);
      else await spotlightApi.unlike(v.id, me);
    } catch (e) {
      patch(v.id, { liked: v.liked, like_count: v.like_count });
      toast((e as Error).message, 'error');
    }
  }
  async function toggleSave(v: SpotlightVideo) {
    haptic(6);
    patch(v.id, { saved: !v.saved, save_count: v.save_count + (v.saved ? -1 : 1) });
    try {
      if (v.saved) await spotlightApi.unsave(v.id, me);
      else await spotlightApi.save(v.id, me);
    } catch (e) {
      patch(v.id, { saved: v.saved, save_count: v.save_count });
      toast((e as Error).message, 'error');
    }
  }
  async function toggleFollow(v: SpotlightVideo) {
    const f = !v.following;
    setVideos((list) => list?.map((x) => (x.user_id === v.user_id ? { ...x, following: f } : x)) ?? null);
    try {
      if (f) await spotlightApi.follow(me, v.user_id);
      else await spotlightApi.unfollow(me, v.user_id);
      haptic(8);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function share(v: SpotlightVideo) {
    const text = `${v.caption ?? 'Check this out'} — @${v.username} on SUMANOVA`;
    try {
      if (navigator.share) await navigator.share({ title: 'SUMANOVA Spotlight', text, url: publicUrl('spotlight', v.media_path) });
      else {
        await navigator.clipboard.writeText(publicUrl('spotlight', v.media_path));
        toast('Link copied', 'success');
      }
    } catch {
      /* cancelled */
    }
  }

  return (
    <div className="fixed inset-0 bg-black">
      <div ref={scroller} onScroll={onScroll} className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain">
        {videos === null ? (
          <div className="grid h-full place-items-center"><Loader2 className="h-7 w-7 animate-spin text-white/60" /></div>
        ) : videos.length === 0 ? (
          <div className="grid h-full place-items-center px-8 text-center">
            <div>
              <p className="font-display text-xl">{query ? 'No results' : 'Spotlight is warming up'}</p>
              <p className="mt-2 text-sm text-ink-mute">{query ? 'Try another word or creator.' : 'Be the first to post a short video for everyone on SUMANOVA.'}</p>
              <button onClick={() => setUpload(true)} className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-ember-gradient text-noir px-5 text-sm font-semibold"><Plus className="h-4 w-4" /> Post a video</button>
            </div>
          </div>
        ) : (
          videos.map((v, i) => (
            <Card key={v.id} v={v} me={me} active={i === active} near={Math.abs(i - active) <= 1} muted={muted} onMute={() => setMuted((m) => !m)} onLike={(f) => void toggleLike(v, f)} onSave={() => void toggleSave(v)} onFollow={() => void toggleFollow(v)} onComments={() => setComments(v)} onShare={() => void share(v)} onMenu={() => setMenu(v)} />
          ))
        )}
      </div>

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent pb-8 pt-safe">
        <div className="pointer-events-auto flex items-center gap-2 px-3">
          {searching ? (
            <label className="flex h-10 flex-1 items-center gap-2 rounded-full bg-white/15 px-4 backdrop-blur-md">
              <Search className="h-4 w-4 text-white/70" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Spotlight" className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/60" />
              <button onClick={() => { setQuery(''); setSearching(false); }} aria-label="Close search"><X className="h-4 w-4 text-white/70" /></button>
            </label>
          ) : (
            <>
              <h1 className="flex-1 font-display text-[26px] font-medium italic text-white drop-shadow">Spotlight</h1>
              <TopBtn label="Interests" onClick={() => setInterests(true)}><SlidersHorizontal className="h-5 w-5" /></TopBtn>
              <TopBtn label="Search" onClick={() => setSearching(true)}><Search className="h-5 w-5" /></TopBtn>
              <TopBtn label="Post a video" onClick={() => setUpload(true)}><Plus className="h-5 w-5" /></TopBtn>
            </>
          )}
        </div>
        <div className="no-scrollbar pointer-events-auto mt-2 flex gap-1.5 overflow-x-auto px-3">
          {[null, ...CATEGORIES].map((c) => (
            <button key={c ?? 'all'} onClick={() => setCategory(c)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold capitalize backdrop-blur-md', category === c ? 'bg-ember-cream text-noir' : 'bg-white/15 text-white')}>{c ?? 'For you'}</button>
          ))}
        </div>
      </div>

      <CommentsSheet video={comments} me={me} onClose={() => setComments(null)} onCount={(id, d) => setVideos((v) => v?.map((x) => (x.id === id ? { ...x, comment_count: x.comment_count + d } : x)) ?? null)} />
      <Sheet open={!!menu} onClose={() => setMenu(null)}>
        {menu && (
          <div className="pb-3">
            {menu.user_id === me ? (
              <SheetItem danger icon={<Trash2 className="h-4 w-4" />} label="Remove my video" onClick={async () => { const v = menu; setMenu(null); try { await spotlightApi.remove(v.id, [v.media_path, v.poster_path]); setVideos((l) => l?.filter((x) => x.id !== v.id) ?? null); toast('Removed', 'success'); } catch (e) { toast((e as Error).message, 'error'); } }} />
            ) : (
              ['spam', 'inappropriate', 'harassment', 'other'].map((r) => (
                <SheetItem key={r} danger icon={<Flag className="h-4 w-4" />} label={`Report: ${r}`} onClick={async () => { const v = menu; setMenu(null); try { await spotlightApi.report(v.id, r); setVideos((l) => l?.filter((x) => x.id !== v.id) ?? null); toast('Thanks — we’ll review it', 'success'); } catch (e) { toast((e as Error).message, 'error'); } }} />
              ))
            )}
          </div>
        )}
      </Sheet>
      <Sheet open={interests} onClose={() => setInterests(false)} title="Your interests">
        <div className="flex flex-wrap gap-2 px-5 pb-6">
          {CATEGORIES.map((c) => {
            const on = settings?.interests?.includes(c);
            return (
              <button key={c} onClick={async () => {
                const next = on ? (settings?.interests ?? []).filter((x) => x !== c) : [...(settings?.interests ?? []), c];
                if (settings) setSettings({ ...settings, interests: next });
                await spotlightApi.setInterests(me, next).catch((e) => toast((e as Error).message, 'error'));
              }} className={cn('rounded-full px-4 py-2 text-sm capitalize', on ? 'bg-ember-gradient text-noir font-semibold' : 'bg-white/5 ring-1 ring-white/10')}>{c}</button>
            );
          })}
          <p className="mt-2 w-full text-xs text-ink-mute">“For you” ranks videos by likes, comments, saves and views, how recent they are, creators you follow and these interests. It’s a simple, transparent formula — not an AI model.</p>
        </div>
      </Sheet>
      <AnimatePresence>{upload && <UploadSheet onClose={() => setUpload(false)} onPosted={() => { setUpload(false); void load(); }} />}</AnimatePresence>
    </div>
  );
}

function TopBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} aria-label={label} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur-md active:scale-90">{children}</button>;
}

const Card = memo(function Card({ v, me, active, near, muted, onMute, onLike, onSave, onFollow, onComments, onShare, onMenu }: {
  v: SpotlightVideo; me: string; active: boolean; near: boolean; muted: boolean; onMute: () => void; onLike: (force?: boolean) => void; onSave: () => void; onFollow: () => void; onComments: () => void; onShare: () => void; onMenu: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [heart, setHeart] = useState(0);
  const watched = useRef(0);
  const lastTap = useRef(0);
  const f = filterById(v.media_meta?.filter);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active && !paused) void el.play().catch(() => undefined);
    else el.pause();
    if (!active && watched.current > 0) {
      void spotlightApi.view(v.id, watched.current * 1000);
      watched.current = 0;
    }
  }, [active, paused, v.id]);

  return (
    <section className="relative h-full w-full snap-start snap-always overflow-hidden" aria-label={`Video by ${v.display_name}`}>
      {near ? (
        <video
          ref={ref}
          src={publicUrl('spotlight', v.media_path)}
          poster={v.poster_path ? publicUrl('spotlight', v.poster_path) : undefined}
          loop
          playsInline
          muted={muted}
          preload={active ? 'auto' : 'metadata'}
          onTimeUpdate={(e) => (watched.current = Math.max(watched.current, e.currentTarget.currentTime))}
          className="h-full w-full object-cover"
          style={{ filter: f.css }}
        />
      ) : v.poster_path ? (
        <img src={publicUrl('spotlight', v.poster_path)} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="h-full w-full bg-noir-800" />
      )}
      <button
        className="absolute inset-0"
        aria-label={paused ? 'Play' : 'Pause'}
        onClick={() => {
          const now = Date.now();
          if (now - lastTap.current < 280) {
            onLike(true);
            setHeart((h) => h + 1);
          } else setTimeout(() => Date.now() - lastTap.current >= 280 && setPaused((p) => !p), 290);
          lastTap.current = now;
        }}
      />
      <AnimatePresence>
        {heart > 0 && (
          <motion.div key={heart} initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1.3, opacity: 1 }} exit={{ opacity: 0, y: -60 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }} onAnimationComplete={() => setTimeout(() => setHeart(0), 300)} className="pointer-events-none absolute inset-0 grid place-items-center">
            <Heart className="h-28 w-28 fill-ember-rose text-ember-rose drop-shadow-[0_0_30px_rgba(255,107,107,.8)]" />
          </motion.div>
        )}
      </AnimatePresence>
      {paused && <div className="pointer-events-none absolute inset-0 grid place-items-center"><span className="rounded-full bg-black/40 p-5 text-white">❚❚</span></div>}

      {/* Side rail */}
      <div className="absolute bottom-32 right-3 flex flex-col items-center gap-5 text-white">
        <Rail label={fmt(v.like_count)} active={v.liked} onClick={() => onLike()}><Heart className={cn('h-7 w-7', v.liked && 'fill-ember-rose text-ember-rose')} /></Rail>
        <Rail label={fmt(v.comment_count)} onClick={onComments}><MessageCircle className="h-7 w-7" /></Rail>
        <Rail label={fmt(v.save_count)} active={v.saved} onClick={onSave}><Bookmark className={cn('h-7 w-7', v.saved && 'fill-ember-gold text-ember-gold')} /></Rail>
        <Rail label="Share" onClick={onShare}><Share2 className="h-7 w-7" /></Rail>
        <Rail label="" onClick={onMenu}><MoreHorizontal className="h-7 w-7" /></Rail>
        <button onClick={onMute} aria-label={muted ? 'Unmute' : 'Mute'} className="grid h-10 w-10 place-items-center rounded-full bg-black/30">{muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
      </div>

      {/* Creator + caption */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pb-28 pt-16 text-white">
        <div className="flex items-center gap-2.5 pr-16">
          <Link to={`/u/${v.username}`} className="flex items-center gap-2.5">
            <Avatar name={v.display_name} url={v.avatar_url} aura={v.aura_color} size={38} />
            <span>
              <span className="block text-sm font-semibold">{v.display_name}</span>
              <span className="block text-[11px] text-white/70">@{v.username} · {shortTime(v.created_at)}</span>
            </span>
          </Link>
          {v.user_id !== me && (
            <button onClick={onFollow} className={cn('ml-1 rounded-full px-3 py-1 text-xs font-semibold', v.following ? 'bg-white/20' : 'bg-ember-cream text-noir')}>{v.following ? 'Following' : 'Follow'}</button>
          )}
        </div>
        {v.caption && <p className="mt-2 line-clamp-3 pr-16 text-sm">{v.caption}</p>}
        <span className="mt-2 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] capitalize">{v.category}</span>
      </div>
    </section>
  );
});

function Rail({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <motion.button whileTap={{ scale: 0.8 }} onClick={onClick} aria-pressed={active} className="flex flex-col items-center gap-1 drop-shadow-[0_2px_8px_rgba(0,0,0,.5)]">
      {children}
      {label && <span className="text-xs font-semibold">{label}</span>}
    </motion.button>
  );
}

function CommentsSheet({ video, me, onClose, onCount }: { video: SpotlightVideo | null; me: string; onClose: () => void; onCount: (id: string, d: number) => void }) {
  const toast = useToast();
  const [list, setList] = useState<VideoComment[] | null>(null);
  const [people, setPeople] = useState<Record<string, PublicProfile>>({});
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!video) return;
    setList(null);
    void spotlightApi.comments(video.id).then(async (c) => {
      setList(c);
      const profs = await chatApi.profiles([...new Set(c.map((x) => x.user_id))]);
      setPeople(Object.fromEntries(profs.map((p) => [p.id, p])));
    }).catch(() => setList([]));
  }, [video]);

  async function post() {
    if (!video || !text.trim()) return;
    setBusy(true);
    try {
      const id = await spotlightApi.comment(video.id, text.trim());
      setList((l) => [{ id, video_id: video.id, user_id: me, body: text.trim(), created_at: new Date().toISOString() }, ...(l ?? [])]);
      onCount(video.id, 1);
      setText('');
      if (!people[me]) setPeople({ ...people, ...Object.fromEntries((await chatApi.profiles([me])).map((p) => [p.id, p])) });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!video} onClose={onClose} title={video ? `${video.comment_count} comments` : ''}>
      <div className="flex max-h-[70vh] flex-col">
        <ul className="min-h-[30vh] flex-1 space-y-3 overflow-y-auto px-5 pb-3">
          {list === null && <li className="grid h-20 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-ink-mute" /></li>}
          {list?.length === 0 && <li className="py-8 text-center text-sm text-ink-mute">Be the first to comment.</li>}
          {list?.map((c) => {
            const p = people[c.user_id];
            return (
              <li key={c.id} className="flex gap-3">
                <Avatar name={p?.display_name ?? '?'} url={p?.avatar_url} aura={p?.aura_color} size={34} ring={false} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-mute"><span className="font-semibold text-ink">{p?.display_name ?? '…'}</span> · {shortTime(c.created_at)}</p>
                  <p className="break-words text-sm">{c.body}</p>
                </div>
                {(c.user_id === me || video?.user_id === me) && (
                  <button onClick={async () => { await spotlightApi.removeComment(c.id).catch(() => undefined); setList((l) => l?.filter((x) => x.id !== c.id) ?? null); if (video) onCount(video.id, -1); }} aria-label="Delete comment" className="text-ink-faint hover:text-ember-rose"><Trash2 className="h-4 w-4" /></button>
                )}
              </li>
            );
          })}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); void post(); }} className="flex gap-2 border-t border-white/5 px-4 py-3">
          <input value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} placeholder="Add a comment…" className="h-11 flex-1 rounded-full bg-white/5 px-4 text-[15px] outline-none ring-1 ring-white/10 focus:ring-ember-amber/60" />
          <button type="submit" disabled={!text.trim() || busy} aria-label="Post comment" className="grid h-11 w-11 place-items-center rounded-full bg-ember-gradient text-noir disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
        </form>
      </div>
    </Sheet>
  );
}
