import { useSearchParams } from 'react-router-dom';
import { useT } from '@/lib/i18n';
import { DailyQuestionCard } from '@/features/social/DailyQuestionCard';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, Plus, Type } from 'lucide-react';
import { TopBar, BarButton } from '@/components/TopBar';
import { Avatar } from '@/components/Avatar';
import { Ghost } from '@/components/ui/Ghost';
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

  // Deep link from a mention notification: /stories?u=<user id> opens their story.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const u = params.get('u');
    if (!u || !rings) return;
    const i = rings.findIndex((r) => r.user_id === u);
    if (i >= 0) setOpen({ list: rings, index: i });
    params.delete('u');
    setParams(params, { replace: true });
  }, [params, rings, setParams]);

  const mine = rings?.find((r) => r.is_me);
  const friends = (rings ?? []).filter((r) => !r.is_me && r.is_friend);
  const discover = (rings ?? []).filter((r) => !r.is_me && !r.is_friend);
  const tr = useT();

  return (
    <div className="min-h-full bg-noir pb-28">
      <TopBar
        title={tr('Stories')}
        right={
          <BarButton label="Story archive" to="/stories/archive">
            <Archive className="h-5 w-5" />
          </BarButton>
        }
      />
      <div className="mx-auto max-w-lg px-3.5">
        <section className="relative isolate mt-1 overflow-hidden rounded-tile bg-white pt-3.5">
          <Ghost url={friends[0]?.avatar_url ?? profile?.avatar_url} size={150} className="-right-8 -top-10" />
          <div className="flex items-center justify-between px-4">
            <h2 className="text-[17px] font-extrabold">{tr('Friends')}</h2>
            <button onClick={() => setComposer(true)} className="flex items-center gap-1 rounded-xl bg-ink/[0.06] px-3 py-1.5 text-[13px] font-bold"><Type className="h-3.5 w-3.5" /> {tr('Text story')}</button>
          </div>
          <div className="no-scrollbar flex gap-3.5 overflow-x-auto px-4 pb-2 pt-3">
            <div className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
              <span className="relative">
                <button onClick={() => (mine ? setOpen({ list: [mine], index: 0 }) : setComposer(true))} aria-label={mine ? 'View my story' : 'Add to my story'} className="block rounded-full">
                  <Avatar name={profile?.display_name ?? 'Me'} url={profile?.avatar_url} aura={profile?.aura_color} size={68} ring={!!mine} />
                </button>
                <Link to="/" aria-label="Add a snap to my story" className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-ember-flame text-white ring-[3px] ring-white"><Plus className="h-4 w-4" /></Link>
              </span>
              <span className="text-xs font-bold">{tr('My story')}</span>
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

        <DailyQuestionCard />

        <section className="pt-5">
          <h2 className="px-1 text-[17px] font-extrabold">{tr('For you')}</h2>
          {rings === null ? (
            <Skeleton />
          ) : discover.length === 0 ? (
            <p className="mt-3 rounded-tile bg-white p-6 text-center text-sm text-ink-mute">Public stories from people you don't follow yet will show up here.</p>
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
      className={cn('relative isolate h-[236px] overflow-hidden rounded-tile text-left', r.unseen && 'ring-[3px] ring-ink ring-offset-2 ring-offset-noir')}
      style={{ background: `linear-gradient(170deg, ${a.to} 0%, ${a.from} 100%)` }}
    >
      <Ghost url={r.avatar_url} size={200} opacity={0.28} className="-bottom-12 -left-10 right-auto top-auto" />
      <span className="absolute inset-x-0 top-[22%] grid place-items-center">
        <Avatar name={r.display_name} url={r.avatar_url} aura={r.aura_color} size={86} />
      </span>
      {r.story_count > 1 && <span className="absolute right-2.5 top-2.5 rounded-lg bg-white px-2 py-0.5 text-[11px] font-extrabold text-ink">{r.story_count} new</span>}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent p-3 pt-8 text-white">
        <span className="block truncate text-[15px] font-extrabold">{r.display_name}</span>
        <span className="block text-xs font-semibold text-white/85">{shortTime(r.latest_at)}</span>
      </span>
    </motion.button>
  );
}

function Skeleton() {
  return <div className="mt-3 grid grid-cols-2 gap-2.5">{[0, 1].map((i) => <div key={i} className="h-[236px] animate-pulse rounded-tile bg-white" />)}</div>;
}
