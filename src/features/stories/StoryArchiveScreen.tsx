import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Sparkles, Trash2 } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { storiesApi, type Story, type StoryRing } from '@/lib/social/api';
import { privateUrl } from '@/lib/storageUrl';
import { dayLabel } from '@/lib/chat/time';
import { bg } from './backgrounds';
import { StoryViewer } from './StoryViewer';

/** Every story you've posted (including expired ones), plus your highlights. */
export default function StoryArchiveScreen() {
  const { session, profile } = useAuth();
  const me = session!.user.id;
  const toast = useToast();
  const [stories, setStories] = useState<Story[] | null>(null);
  const [highlights, setHighlights] = useState<{ id: string; title: string; highlight_items: { story_id: string }[] }[]>([]);
  const [viewing, setViewing] = useState<Story[] | null>(null);

  const load = () => {
    void storiesApi.archive(me).then(setStories).catch((e) => toast((e as Error).message, 'error'));
    void storiesApi.highlights(me).then(setHighlights).catch(() => undefined);
  };
  useEffect(load, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  const meRing: StoryRing = { user_id: me, username: profile?.username ?? '', display_name: profile?.display_name ?? 'Me', avatar_url: profile?.avatar_url ?? null, aura_color: profile?.aura_color ?? 'violet', story_count: 0, unseen: false, latest_at: '', is_me: true, is_friend: false };

  return (
    <div className="pb-16">
      <ScreenHeader title="Story archive" back />
      <div className="mx-auto max-w-lg px-4">
        {highlights.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-ink-mute">Highlights</h2>
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
              {highlights.map((h) => (
                <div key={h.id} className="flex w-20 shrink-0 flex-col items-center gap-1.5">
                  <button onClick={async () => setViewing(await storiesApi.byIds(h.highlight_items.map((x) => x.story_id)))} className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-aurora-violet/60 to-aurora-teal/50 ring-2 ring-white/20">
                    <Sparkles className="h-6 w-6" />
                  </button>
                  <span className="w-full truncate text-center text-xs">{h.title}</span>
                  <button onClick={async () => { await storiesApi.removeHighlight(h.id); load(); }} className="text-[10px] text-ink-faint hover:text-aurora-coral" aria-label={`Remove highlight ${h.title}`}><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </section>
        )}
        {stories === null ? (
          <div className="grid grid-cols-3 gap-2">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="aspect-[9/16] animate-pulse rounded-2xl bg-white/[0.04]" />)}</div>
        ) : stories.length === 0 ? (
          <p className="glass rounded-3xl p-8 text-center text-sm text-ink-mute">Stories you post will be saved here for you.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {stories.map((s) => (
              <button key={s.id} onClick={() => setViewing([s])} className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-white/5 active:scale-95">
                <Thumb s={s} />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 text-left text-[10px] text-white/90">{dayLabel(s.created_at)}{new Date(s.expires_at) > new Date() ? ' · live' : ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <AnimatePresence>{viewing && <StoryViewer rings={[meRing]} startIndex={0} preloaded={viewing} onClose={() => { setViewing(null); load(); }} />}</AnimatePresence>
    </div>
  );
}

function Thumb({ s }: { s: Story }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (s.kind === 'image' && s.media_path) privateUrl('stories', s.media_path).then(setUrl).catch(() => undefined);
  }, [s]);
  if (s.kind === 'text') return <span className="grid h-full place-items-center p-2 text-center text-[11px] font-semibold" style={{ background: bg(s.background) }}>{s.text_body?.slice(0, 60)}</span>;
  if (s.kind === 'video') return <span className="grid h-full place-items-center bg-night-700 text-2xl">🎬</span>;
  return url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="block h-full animate-pulse bg-white/5" />;
}
