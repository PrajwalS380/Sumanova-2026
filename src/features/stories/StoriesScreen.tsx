import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, Plus, Type } from 'lucide-react';
import { TopBar, BarButton } from '@/components/TopBar';
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
    <div className="min-h-full bg-white pb-6">
      <TopBar
        title="Stories"
        right={
          <BarButton label="Story archive" to="/stories/archive">
            <Archive className="h-5 w-5" />
          </BarButton>
        }
      />
      <div className="mx-auto max-w-lg">
        <section className="pt-2">
          <div className="flex items-center justify-between px-4">
            <h2 className="text-[17px] font-extrabold">Friends</h2>
            <button onClick={() => setComposer(true)} className="flex items-center gap-1 rounded-full bg-ink/[0.06] px-3 py-1.5 text-[13px] font-bold"><Type className="h-3.5 w-3.5" /> Text story</button>
          </div>
          <div className="no-scrollbar flex gap-3.5 overflow-x-auto px-4 pb-2 pt-3">
            <div className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
              <span className="relative">
                <button onClick={() => (mine ? setOpen({ list: [mine], index: 0 }) : setComposer(true))} aria-label={mine ? 'View my story' : 'Add to my story'} className="block rounded-full">
                  <Avatar name={profile?.display_name ?? 'Me'} url={profile?.avatar_url} aura={profile?.aura_color} size={68} ring={!!mine} />
                </button>
                <Link to="/" aria-label="Add a snap to my story" className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-ember-flame text-white ring-[3px] ring-white"><Plus className="h-4 w-4" /></Link>
              </span>
              <span className="text-xs font-bold">My story</span>
            </div>
            {rings === null
              ? [0, 1, 2, 3].map((i) => <span key={i} className="h-[68px] w-[68px] shrink-0 animate-pulse rounded-full bg-ink/[0.06]" />)
              : friends.map((r, i) => (
                  <button key={r.user_id} onClick={() => setOpen({ list: friends, index: i })} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
                    <Avatar name={r.display_name} url={r.avatar_url} aura={r.aura_color} size={68} ring={r.unseen} />
                    <span className={cn('w-full truncate text-center text-xs', r.unseen ? 'font-extrabold' : 'font-semibold text-ink-mute')}>{r.display_name.split(' ')[0]}</span>
                  </button>
                ))}
          </div>
          {rings !== null && friends.length === 0 && <p className="px-4 pb-2 text-sm text-ink-mute">No new stories from friends right now.</p>}
        </section>

        <section className="px-4 pt-4">
          <h2 className="text-[17px] font-extrabold">For you</h2>
          {rings === null ? (
            <Skeleton />
          ) : discover.length === 0 ? (
            <p className="mt-3 rounded-3xl bg-ink/[0.04] p-6 text-center text-sm text-ink-mute">Public stories from people you don't follow yet will show up here.</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {discover.map((r, i) => (
                <RingTile key={r.user_id} r={r} delay={i} onClick={() => setOpen({ list: discover, index: i })} />
              ))}
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>{open && <StoryViewer rings={open.list} startIndex={open.index} onClose={() => { setOpen(null); void load(); }} />}</AnimatePresence>
      <AnimatePresence>{composer && <TextStoryComposer onClose={() => setComposer(false)} onPosted={() => { setComposer(false); void load(); }} />}</AnimatePresence>
    </div>
  );
}

/** A public story card: tall tile with the person's face and name. */
function RingTile({ r, onClick, delay }: { r: StoryRing; onClick: () => void; delay: number }) {
  const a = AURA[r.aura_color] ?? AURA.gold;
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.97 }}
      transition={{ delay: Math.min(delay, 9) * 0.035, type: 'spring', stiffness: 300, damping: 28 }}
      onClick={onClick}
      className={cn('relative h-[236px] overflow-hidden rounded-[18px] text-left', r.unseen && 'ring-2 ring-ember-flame ring-offset-2')}
      style={{ background: `linear-gradient(170deg, ${a.to} 0%, ${a.from} 100%)` }}
    >
      <span className="absolute inset-x-0 top-[22%] grid place-items-center">
        <Avatar name={r.display_name} url={r.avatar_url} aura={r.aura_color} size={86} />
      </span>
      {r.story_count > 1 && <span className="absolute right-2.5 top-2.5 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-bold text-white">{r.story_count}</span>}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent p-3 pt-8 text-white">
        <span className="block truncate text-[15px] font-extrabold">{r.display_name}</span>
        <span className="block text-xs font-semibold text-white/85">{shortTime(r.latest_at)}</span>
      </span>
    </motion.button>
  );
}

function Skeleton() {
  return <div className="mt-3 grid grid-cols-2 gap-2.5">{[0, 1].map((i) => <div key={i} className="h-[236px] animate-pulse rounded-[18px] bg-ink/[0.05]" />)}</div>;
}
