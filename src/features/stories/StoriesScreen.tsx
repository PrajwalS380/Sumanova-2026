import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, Camera, Plus, Type } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { supabase } from '@/lib/supabase';
import { storiesApi, type StoryRing } from '@/lib/social/api';
import { shortTime } from '@/lib/chat/time';
import { cn } from '@/lib/cn';
import { StoryViewer } from './StoryViewer';
import { TextStoryComposer } from './TextStoryComposer';

export default function StoriesScreen() {
  const { profile } = useAuth();
  const toast = useToast();
  const [rings, setRings] = useState<StoryRing[] | null>(null);
  const [open, setOpen] = useState<{ list: StoryRing[]; index: number } | null>(null);
  const [composer, setComposer] = useState(false);

  const load = useCallback(async () => {
    try {
      setRings(await storiesApi.feed());
    } catch (e) {
      toast((e as Error).message, 'error');
      setRings([]);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    // New stories from anyone I can see → refresh rings (RLS filters the stream).
    const ch = supabase.channel('stories-feed').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'stories' }, () => void load()).subscribe();
    return () => void supabase.removeChannel(ch);
  }, [load]);

  const mine = rings?.find((r) => r.is_me);
  const friends = (rings ?? []).filter((r) => !r.is_me && r.is_friend);
  const discover = (rings ?? []).filter((r) => !r.is_me && !r.is_friend);

  return (
    <div className="pb-36">
      <ScreenHeader
        title="Stories"
        right={
          <Link to="/stories/archive" className="glass grid h-10 w-10 place-items-center rounded-full" aria-label="Story archive">
            <Archive className="h-5 w-5" />
          </Link>
        }
      />
      <div className="mx-auto max-w-lg px-4">
        {/* My story */}
        <div className="glass flex items-center gap-3 rounded-3xl p-3">
          <button onClick={() => (mine ? setOpen({ list: [mine], index: 0 }) : setComposer(true))} className="relative">
            <span className={cn('block rounded-full p-[3px]', mine ? 'ring-aurora' : 'bg-white/10')}>
              <span className="block rounded-full bg-night p-[2px]"><Avatar name={profile?.display_name ?? 'Me'} url={profile?.avatar_url} aura={profile?.aura_color} size={56} ring={false} /></span>
            </span>
            {!mine && <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-aurora-gradient ring-2 ring-night"><Plus className="h-4 w-4" /></span>}
          </button>
          <div className="flex-1">
            <p className="font-semibold">My story</p>
            <p className="text-xs text-ink-mute">{mine ? `${mine.story_count} ${mine.story_count === 1 ? 'story' : 'stories'} · ${shortTime(mine.latest_at)}` : 'Share a moment for 24 hours'}</p>
          </div>
          <button onClick={() => setComposer(true)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label="Text story"><Type className="h-5 w-5" /></button>
          <Link to="/" className="grid h-10 w-10 place-items-center rounded-full bg-white/10" aria-label="Camera story"><Camera className="h-5 w-5" /></Link>
        </div>

        <Section title="Friends">
          {rings === null ? (
            <Skeleton />
          ) : friends.length === 0 ? (
            <p className="glass rounded-3xl p-6 text-center text-sm text-ink-mute">No new stories from friends right now.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {friends.map((r, i) => (
                <RingTile key={r.user_id} r={r} delay={i} onClick={() => setOpen({ list: friends, index: i })} />
              ))}
            </div>
          )}
        </Section>

        {discover.length > 0 && (
          <Section title="Discover">
            <div className="grid grid-cols-3 gap-3">
              {discover.map((r, i) => (
                <RingTile key={r.user_id} r={r} delay={i} onClick={() => setOpen({ list: discover, index: i })} />
              ))}
            </div>
          </Section>
        )}
      </div>

      <AnimatePresence>{open && <StoryViewer rings={open.list} startIndex={open.index} onClose={() => { setOpen(null); void load(); }} />}</AnimatePresence>
      <AnimatePresence>{composer && <TextStoryComposer onClose={() => setComposer(false)} onPosted={() => { setComposer(false); void load(); }} />}</AnimatePresence>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-ink-mute">{title}</h2>
      {children}
    </section>
  );
}

function RingTile({ r, onClick, delay }: { r: StoryRing; onClick: () => void; delay: number }) {
  return (
    <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(delay, 9) * 0.03 }} onClick={onClick} className="flex flex-col items-center gap-2 rounded-3xl bg-white/[0.04] p-3 ring-1 ring-white/5 active:scale-95">
      <span className={cn('rounded-full p-[3px]', r.unseen ? 'ring-aurora animate-none' : 'bg-white/15')}>
        <span className="block rounded-full bg-night p-[2px]"><Avatar name={r.display_name} url={r.avatar_url} aura={r.aura_color} size={64} ring={false} /></span>
      </span>
      <span className="w-full truncate text-center text-xs font-semibold">{r.display_name.split(' ')[0]}</span>
      <span className="text-[10px] text-ink-faint">{shortTime(r.latest_at)}</span>
    </motion.button>
  );
}

function Skeleton() {
  return <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-3xl bg-white/[0.04]" />)}</div>;
}
