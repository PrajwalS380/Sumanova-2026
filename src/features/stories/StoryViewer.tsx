import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, Loader2, MoreHorizontal, Send, Sparkles, Trash2, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Sheet, SheetItem } from '@/components/ui/Sheet';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { storiesApi, type Story, type StoryRing, type StoryViewer as Viewer } from '@/lib/social/api';
import { shortTime } from '@/lib/chat/time';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { StoryMedia } from './StoryMedia';

const PHOTO_MS = 5500;
const REACTIONS = ['😍', '😂', '🔥', '😮', '👏', '💜'];

/** Full-screen story player across users. Tap sides to move, hold to pause, swipe down to close. */
export function StoryViewer({ rings, startIndex, onClose, preloaded }: { rings: StoryRing[]; startIndex: number; onClose: () => void; preloaded?: Story[] }) {
  const { session } = useAuth();
  const me = session!.user.id;
  const toast = useToast();
  const navigate = useNavigate();
  const [userIdx, setUserIdx] = useState(startIndex);
  const [stories, setStories] = useState<Story[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const [ready, setReady] = useState(false);
  const [duration, setDuration] = useState(PHOTO_MS);
  const [reply, setReply] = useState('');
  const [typing, setTyping] = useState(false);
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [menu, setMenu] = useState(false);
  const [burst, setBurst] = useState<string | null>(null);
  const press = useRef<{ t: number; x: number; y: number } | null>(null);
  const ring = rings[userIdx];
  const story = stories?.[idx];
  const mine = ring?.user_id === me;
  const paused = held || typing || !!viewers || menu || !ready;

  // Load the current person's stories.
  useEffect(() => {
    if (!ring) return onClose();
    setStories(null);
    setIdx(0);
    if (preloaded && rings.length === 1) {
      setStories(preloaded);
      return;
    }
    storiesApi.ofUser(ring.user_id).then((s) => {
      if (!s.length) return next();
      setStories(s);
      // Start at the first unseen story? Simple and predictable: start from the beginning.
    }).catch(() => next());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIdx]);

  // Reset per story + mark viewed.
  useEffect(() => {
    if (!story) return;
    setProgress(0);
    setReady(false);
    setDuration(story.kind === 'video' ? 15000 : PHOTO_MS);
    if (!mine) void storiesApi.view(story.id).catch(() => undefined);
  }, [story, mine]);

  const next = useCallback(() => {
    setStories((s) => {
      if (s && idx < s.length - 1) {
        setIdx((i) => i + 1);
        return s;
      }
      if (userIdx < rings.length - 1) setUserIdx((u) => u + 1);
      else onClose();
      return s;
    });
  }, [idx, onClose, rings.length, userIdx]);

  const prev = useCallback(() => {
    if (idx > 0) setIdx((i) => i - 1);
    else if (userIdx > 0) setUserIdx((u) => u - 1);
  }, [idx, userIdx]);

  // Progress timer (rAF so it's smooth and pauses cleanly).
  useEffect(() => {
    if (paused || !story) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      setProgress((p) => {
        const np = p + dt / duration;
        if (np >= 1) {
          queueMicrotask(next);
          return 1;
        }
        return np;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, story, duration, next]);

  async function sendReply(text: string) {
    if (!story || !text.trim()) return;
    try {
      await storiesApi.reply(story.id, text.trim());
      setReply('');
      setTyping(false);
      toast('Reply sent', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  async function react(e: string) {
    if (!story) return;
    haptic(10);
    setBurst(e);
    setTimeout(() => setBurst(null), 900);
    await storiesApi.view(story.id, e).catch(() => undefined);
  }

  async function remove() {
    if (!story) return;
    setMenu(false);
    try {
      await storiesApi.remove(story.id);
      toast('Story deleted', 'success');
      setStories((s) => {
        const n = (s ?? []).filter((x) => x.id !== story.id);
        if (!n.length) onClose();
        else setIdx((i) => Math.min(i, n.length - 1));
        return n;
      });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  async function addHighlight() {
    if (!story) return;
    setMenu(false);
    const title = window.prompt('Highlight name', 'Favourites')?.trim();
    if (!title) return;
    try {
      const existing = (await storiesApi.highlights(me)).find((h) => h.title.toLowerCase() === title.toLowerCase());
      if (existing) await storiesApi.addToHighlight(existing.id, story.id);
      else await storiesApi.createHighlight(title.slice(0, 24), [story.id]);
      toast(`Added to “${title}”`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  if (!ring) return null;

  return createPortal(
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-[100] select-none bg-black">
      <motion.div
        key={ring.user_id}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        className="relative h-full w-full"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_, i) => i.offset.y > 120 && onClose()}
        onPointerDown={(e) => {
          press.current = { t: Date.now(), x: e.clientX, y: e.clientY };
          setTimeout(() => press.current && Date.now() - press.current.t >= 220 && setHeld(true), 230);
        }}
        onPointerUp={(e) => {
          const p = press.current;
          press.current = null;
          if (held) return setHeld(false);
          if (!p || Math.abs(e.clientY - p.y) > 20 || typing) return;
          if (e.clientX < window.innerWidth * 0.3) prev();
          else next();
        }}
      >
        {story ? <StoryMedia story={story} paused={paused} onReady={() => setReady(true)} onDuration={(s) => setDuration(Math.min(60, s) * 1000)} onEnded={next} /> : <div className="grid h-full place-items-center"><Loader2 className="h-7 w-7 animate-spin text-white/60" /></div>}
      </motion.div>

      {/* Top: progress + identity */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent px-3 pb-10 pt-safe">
        <div className="flex gap-1">
          {(stories ?? [null]).map((s, i) => (
            <div key={s?.id ?? i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <div className="h-full rounded-full bg-white" style={{ width: `${i < idx ? 100 : i === idx ? progress * 100 : 0}%` }} />
            </div>
          ))}
        </div>
        <div className="pointer-events-auto mt-3 flex items-center gap-2.5">
          <button onClick={() => { onClose(); if (!ring.is_me) navigate(`/u/${ring.username}`); }} className="flex items-center gap-2.5">
            <Avatar name={ring.display_name} url={ring.avatar_url} aura={ring.aura_color} size={36} ring={false} />
            <span className="text-left">
              <span className="block text-sm font-semibold text-white">{ring.is_me ? 'My story' : ring.display_name}</span>
              <span className="block text-[11px] text-white/70">{story ? shortTime(story.created_at) : ''}{story?.audience === 'everyone' ? ' · Public' : ''}</span>
            </span>
          </button>
          <span className="flex-1" />
          {mine && <button onClick={() => setMenu(true)} aria-label="Story options" className="grid h-10 w-10 place-items-center text-white"><MoreHorizontal className="h-6 w-6" /></button>}
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center text-white"><X className="h-6 w-6" /></button>
        </div>
      </div>

      {/* Reaction burst */}
      <AnimatePresence>
        {burst && (
          <motion.div initial={{ scale: 0.3, opacity: 0, y: 40 }} animate={{ scale: 1.6, opacity: 1, y: 0 }} exit={{ opacity: 0, y: -80 }} className="pointer-events-none absolute inset-0 grid place-items-center text-7xl">{burst}</motion.div>
        )}
      </AnimatePresence>

      {/* Bottom: reply/reactions or owner viewers */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-safe pt-10">
        {mine ? (
          <button onClick={async () => setViewers(await storiesApi.viewers(story!.id).catch(() => []))} disabled={!story} className="mx-auto mb-3 flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md">
            <Eye className="h-4 w-4" /> Viewers
          </button>
        ) : (
          <div className="mb-3 space-y-2">
            {!typing && (
              <div className="flex justify-center gap-2">
                {REACTIONS.map((e) => (
                  <button key={e} onClick={() => void react(e)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl backdrop-blur-md active:scale-90" aria-label={`React ${e}`}>{e}</button>
                ))}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); void sendReply(reply); }} className="flex items-center gap-2">
              <input value={reply} onChange={(e) => setReply(e.target.value)} onFocus={() => setTyping(true)} onBlur={() => !reply && setTyping(false)} placeholder={`Reply to ${ring.display_name.split(' ')[0]}…`} maxLength={1000} className="h-12 flex-1 rounded-full bg-white/12 px-5 text-[15px] text-white outline-none ring-1 ring-white/25 backdrop-blur-md placeholder:text-white/60" style={{ backgroundColor: 'rgba(255,255,255,.12)' }} aria-label="Reply" />
              {reply.trim() && <button type="submit" aria-label="Send reply" className="grid h-12 w-12 place-items-center rounded-full bg-ember-gradient text-noir"><Send className="h-5 w-5" /></button>}
            </form>
          </div>
        )}
      </div>

      <Sheet open={!!viewers} onClose={() => setViewers(null)} title={viewers ? `Seen by ${viewers.length}` : ''}>
        <ul className="px-4 pb-5">
          {viewers?.length === 0 && <p className="py-6 text-center text-sm text-ink-mute">No views yet.</p>}
          {viewers?.map((v) => (
            <li key={v.viewer_id} className="flex items-center gap-3 py-2">
              <Avatar name={v.display_name} url={v.avatar_url} aura={v.aura_color} size={40} />
              <span className="flex-1"><span className="block text-sm font-semibold">{v.display_name}</span><span className="block text-xs text-ink-mute">{shortTime(v.viewed_at)} ago</span></span>
              {v.reaction && <span className="text-xl">{v.reaction}</span>}
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet open={menu} onClose={() => setMenu(false)}>
        <div className="pb-3">
          <SheetItem icon={<Sparkles className="h-4 w-4" />} label="Add to highlight" onClick={() => void addHighlight()} />
          <SheetItem danger icon={<Trash2 className="h-4 w-4" />} label="Delete story" onClick={() => void remove()} />
        </div>
      </Sheet>
      {held && <div className={cn('pointer-events-none absolute inset-0 bg-black/10')} />}
    </motion.div>,
    document.body,
  );
}
