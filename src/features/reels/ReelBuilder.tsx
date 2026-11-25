import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ImagePlus, Loader2, Music, X } from 'lucide-react';
import { memoriesApi, type Memory } from '@/lib/social/api';
import { privateUrl } from '@/lib/storageUrl';
import { TRACKS } from '@/lib/music/tracks';
import { makeReel } from '@/lib/media/reel';
import type { NovaEmojiId } from '@/components/emoji/novaEmoji';
import { useToast } from '@/providers/ToastProvider';
import { cn } from '@/lib/cn';
import type { Captured } from '@/features/camera/CameraScreen';

const MediaEditor = lazy(() => import('@/features/editor/MediaEditor'));

export interface ReelSource { key: string; url: string; load: () => Promise<Blob> }

/** Pick photos (given ones, your Memories or your phone), a song, and make a reel to send or post. */
export function ReelBuilder({ title, subtitle, emoji, sources, fromMemories = true, onClose }: { title: string; subtitle?: string; emoji: NovaEmojiId; sources?: ReelSource[]; fromMemories?: boolean; onClose: () => void }) {
  const toast = useToast();
  const [pool, setPool] = useState<ReelSource[]>(sources ?? []);
  const [picked, setPicked] = useState<string[]>(() => (sources ?? []).slice(0, 12).map((s) => s.key));
  const [music, setMusic] = useState<string | null>('sunny');
  const [progress, setProgress] = useState<number | null>(null);
  const [made, setMade] = useState<Captured | null>(null);

  useEffect(() => {
    if (!fromMemories) return;
    void memoriesApi.list({ offset: 0 }).then(async (list) => {
      const imgs = list.filter((m) => m.kind === 'image').slice(0, 40);
      const withUrls = await Promise.all(imgs.map(async (m: Memory) => ({ key: m.id, url: await privateUrl('memories', m.media_path).catch(() => ''), load: async () => (await fetch(await privateUrl('memories', m.media_path))).blob() })));
      setPool((p) => [...p, ...withUrls.filter((x) => x.url)]);
    }).catch(() => undefined);
  }, [fromMemories]);

  function addFiles(files: FileList | null) {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith('image/')).slice(0, 20);
    const next = list.map((f) => ({ key: `file:${f.name}:${f.size}:${Math.random()}`, url: URL.createObjectURL(f), load: async () => f as Blob }));
    setPool((p) => [...next, ...p]);
    setPicked((k) => [...next.map((x) => x.key), ...k].slice(0, 20));
  }

  async function make() {
    const chosen = picked.map((k) => pool.find((p) => p.key === k)).filter(Boolean) as ReelSource[];
    if (!chosen.length) return toast('Pick some photos', 'error');
    setProgress(0);
    try {
      const blobs = await Promise.all(chosen.map((c) => c.load()));
      const blob = await makeReel(blobs, { title, subtitle, emoji, music }, setProgress);
      setMade({ blob, kind: 'video', filter: 'none', duration: 1.8 + blobs.length * 1.8 });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setProgress(null);
    }
  }

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[80] flex flex-col bg-noir text-ink">
      <header className="flex items-center gap-2 px-3.5 pb-3 pt-safe">
        <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-2xl bg-white"><X className="h-5 w-5" /></button>
        <h1 className="min-w-0 flex-1 truncate text-center text-lg font-extrabold">{title}</h1>
        <span className="w-10" />
      </header>
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <p className="px-1 pb-2 text-sm text-ink-mute">Pick up to 20 photos ({picked.length} picked). The reel is made on your phone.</p>
        <div className="grid grid-cols-4 gap-1.5">
          <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-ink/20 text-center text-[11px] font-extrabold">
            <span className="flex flex-col items-center gap-1"><ImagePlus className="h-5 w-5" /> From phone</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </label>
          {pool.map((p) => {
            const i = picked.indexOf(p.key);
            return (
              <button key={p.key} onClick={() => setPicked((k) => (i >= 0 ? k.filter((x) => x !== p.key) : k.length < 20 ? [...k, p.key] : k))} className={cn('relative aspect-square overflow-hidden rounded-xl bg-ink/5', i >= 0 && 'ring-[3px] ring-ink')}>
                <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                {i >= 0 && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-ink text-[10px] font-black text-white">{i + 1}</span>}
              </button>
            );
          })}
        </div>
        <p className="px-1 pb-2 pt-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-mute">Music</p>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
          <button onClick={() => setMusic(null)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-xs font-extrabold', !music ? 'bg-ink text-white' : 'bg-white')}>None</button>
          {TRACKS.map((t) => (
            <button key={t.id} onClick={() => setMusic(t.id)} className={cn('flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold', music === t.id ? 'bg-ink text-white' : 'bg-white')}><Music className="h-3 w-3" />{t.name}</button>
          ))}
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-4 pb-[max(1.5rem,var(--safe-bottom))] pt-3">
        <button onClick={() => void make()} disabled={progress !== null || !picked.length} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-base font-extrabold text-white disabled:opacity-50">
          {progress !== null ? <><Loader2 className="h-5 w-5 animate-spin" /> Making your reel… {Math.round(progress * 100)}%</> : <><Check className="h-5 w-5" /> Make reel</>}
        </button>
      </div>
      <AnimatePresence>
        {made && (
          <Suspense fallback={<div className="fixed inset-0 z-[90] bg-black" />}>
            <MediaEditor captured={made} onClose={() => { setMade(null); onClose(); }} />
          </Suspense>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}
