import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Film, Loader2, X } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { CATEGORIES, spotlightApi, type Category } from '@/lib/social/api';
import { cn } from '@/lib/cn';

const MAX = 50 * 1024 * 1024;

/** Pick a video, add caption + category, publish to Spotlight. */
export function UploadSheet({ onClose, onPosted }: { onClose: () => void; onPosted: () => void }) {
  const { session } = useAuth();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState<Category>('everyday');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    input.current?.click();
  }, []);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith('video/')) return toast('Pick a video', 'error');
    if (f.size > MAX) return toast('Spotlight videos must be under 50 MB', 'error');
    setFile(f);
    setUrl(URL.createObjectURL(f));
  }

  async function poster(): Promise<Blob | null> {
    const v = video.current;
    if (!v || !v.videoWidth) return null;
    const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
    return new Promise((r) => c.toBlob(r, 'image/webp', 0.8));
  }

  async function publish() {
    if (!file) return;
    if ((video.current?.duration ?? 0) > 60) return toast('Keep Spotlight videos to 60 seconds or less', 'error');
    setBusy(true);
    try {
      await spotlightApi.publish(session!.user.id, file, await poster(), caption, category, { duration: video.current?.duration, width: video.current?.videoWidth, height: video.current?.videoHeight });
      toast('Posted to Spotlight ✦', 'success');
      onPosted();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex flex-col bg-night">
      <div className="flex items-center justify-between px-3 pt-safe">
        <button onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center"><X className="h-6 w-6" /></button>
        <h2 className="font-display text-lg font-semibold">New Spotlight</h2>
        <span className="w-11" />
      </div>
      <input ref={input} type="file" accept="video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-2">
        {url ? (
          <video ref={video} src={url} controls playsInline className="mx-auto max-h-[45vh] rounded-3xl bg-black" />
        ) : (
          <button onClick={() => input.current?.click()} className="grid h-60 place-items-center rounded-3xl border border-dashed border-white/20 text-ink-mute">
            <span className="flex flex-col items-center gap-2"><Film className="h-8 w-8" /> Choose a video (≤ 60 s, ≤ 50 MB)</span>
          </button>
        )}
        <textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 300))} rows={2} placeholder="Write a caption…" className="w-full resize-none rounded-2xl bg-white/5 p-4 text-[15px] outline-none ring-1 ring-white/10 focus:ring-aurora-iris/60" />
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">Category</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={cn('rounded-full px-3.5 py-2 text-sm capitalize', category === c ? 'bg-white font-semibold text-night' : 'bg-white/5 ring-1 ring-white/10')}>{c}</button>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink-faint">Spotlight is public to everyone on SUMANOVA. Videos reported by several people are hidden until reviewed.</p>
      </div>
      <div className="px-4 pb-safe">
        <button onClick={() => void publish()} disabled={!file || busy} className="mb-3 flex h-14 w-full items-center justify-center gap-2 rounded-[1.25rem] bg-aurora-gradient font-semibold shadow-glow disabled:opacity-50">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Publish'}
        </button>
      </div>
    </motion.div>,
    document.body,
  );
}
