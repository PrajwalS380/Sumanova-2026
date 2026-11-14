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
import { AURA } from '@/lib/types';
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
        kicker="The last 24 hours"
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
            <span className={cn('block rounded-full p-[3px]', mine ? 'ring-ember' : 'bg-ink/10')}>
              <span className="block rounded-full bg-noir p-[2px]"><Avatar name={profile?.display_name ?? 'Me'} url={profile?.avatar_url} aura={profile?.aura_color} size={56} ring={false} /></span>
            </span>
            {!mine && <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-ember-gradient text-noir ring-2 ring-noir"><Plus className="h-4 w-4" /></span>}
          </button>
          <div className="flex-1">
            <p className="font-semibold">My story</p>
            <p className="text-xs text-ink-mute">{mine ? `${mine.story_count} ${mine.story_count === 1 ? 'story' : 'stories'} · ${shortTime(mine.latest_at)}` : 'Share a moment for 24 hours'}</p>
          </div>
          <button onClick={() => setComposer(true)} className="grid h-10 w-10 place-items-center rounded-full bg-ink/10" aria-label="Text story"><Type className="h-5 w-5" /></button>
          <Link to="/" className="grid h-10 w-10 place-items-center rounded-full bg-ink/10" aria-label="Camera story"><Camera className="h-5 w-5" /></Link>
        </div>

        <Section title="Friends">
          {rings === null ? (
            <Skeleton />
          ) : friends.length === 0 ? (
            <p className="glass rounded-3xl p-6 text-center text-sm text-ink-mute">No new stories from friends right now.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 px-1 pt-1">
              {friends.map((r, i) => (
                <RingTile key={r.user_id} r={r} delay={i} onClick={() => setOpen({ list: friends, index: i })} />
              ))}
            </div>
          )}
        </Section>

        {discover.length > 0 && (
          <Section title="Discover">
            <div className="grid grid-cols-2 gap-x-4 gap-y-5 px-1 pt-1">
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
      <h2 className="eyebrow mb-3 px-1">{title}</h2>
      {children}
    </section>
  );
}

/** A story as a tilted "print": cream-bordered card lit by the friend's aura. */
function RingTile({ r, onClick, delay }: { r: StoryRing; onClick: () => void; delay: number }) {
  const a = AURA[r.aura_color] ?? AURA.gold;
  const tilt = [-2.2, 1.6, -1.2, 2.4][delay % 4];
  return (
    <motion.button
      initial={{ opacity: 0, y: 14, rotate: 0 }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      whileTap={{ scale: 0.96, rotate: 0 }}
      transition={{ delay: Math.min(delay, 9) * 0.04, type: 'spring', stiffness: 260, damping: 24 }}
      onClick={onClick}
      className="relative rounded-[18px] bg-ember-cream p-2 pb-3 text-left shadow-[0_18px_40px_-18px_rgba(0,0,0,.9)]"
    >
      <span className="relative block aspect-[4/5] overflow-hidden rounded-[12px]" style={{ background: `radial-gradient(120% 90% at 30% 15%, ${a.to}, ${a.from} 55%, #1e1916 100%)` }}>
        <span className="absolute inset-0 grid place-items-center">
          <Avatar name={r.display_name} url={r.avatar_url} aura={r.aura_color} size={84} ring={false} />
        </span>
        {r.unseen && <span className="absolute left-2 top-2 rounded-full bg-noir/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ember-amber">New</span>}
        {r.story_count > 1 && <span className="absolute right-2 top-2 rounded-full bg-noir/70 px-1.5 py-0.5 text-[10px] font-bold text-ink">{r.story_count}</span>}
      </span>
      <span className="mt-2 block truncate px-0.5 font-display text-[17px] italic leading-tight text-noir">{r.display_name.split(' ')[0]}</span>
      <span className="block px-0.5 text-[11px] font-medium text-noir/55">{shortTime(r.latest_at)}</span>
    </motion.button>
  );
}

function Skeleton() {
  return <div className="grid grid-cols-2 gap-4">{[0, 1].map((i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-[18px] bg-ink/[0.04]" />)}</div>;
}
