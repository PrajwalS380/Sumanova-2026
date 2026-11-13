import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { snapsApi, type SnapRow } from '@/lib/snaps/api';
import { filterById } from '@/lib/snaps/filters';
import { screenProtection } from '@/lib/privacy';
import { useToast } from '@/providers/ToastProvider';

/**
 * Full-screen snap viewer. Order matters: fetch the signed URL while access is
 * still allowed, THEN mark opened (or replayed) on the server. Screenshots are
 * blocked on Android while open (FLAG_SECURE); Android 14+ reports attempts.
 */
export function SnapViewer({ snapId, mode, onClose }: { snapId: string; mode: 'open' | 'replay' | 'own'; onClose: () => void }) {
  const toast = useToast();
  const [snap, setSnap] = useState<SnapRow | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const closed = useRef(false);

  const close = () => {
    if (closed.current) return;
    closed.current = true;
    onClose();
  };

  useEffect(() => {
    let release: () => void = () => undefined;
    (async () => {
      try {
        release = await screenProtection.enable(() => void snapsApi.screenshot(snapId));
        const s = await snapsApi.get(snapId);
        if (!s) throw new Error('This snap is no longer available');
        const [u, o] = await Promise.all([snapsApi.signed(s.media_path), s.overlay_path ? snapsApi.signed(s.overlay_path) : Promise.resolve(null)]);
        if (mode === 'open') await snapsApi.open(snapId);
        if (mode === 'replay') await snapsApi.replay(snapId);
        setSnap(s);
        setUrl(u);
        setOverlay(o);
      } catch (e) {
        toast((e as Error).message, 'error');
        close();
      }
    })();
    return () => release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapId, mode]);

  // Countdown for timed photo snaps.
  useEffect(() => {
    if (!ready || !snap || snap.kind !== 'image' || !snap.duration_seconds || mode === 'own') return;
    const total = snap.duration_seconds * 1000;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const p = (performance.now() - start) / total;
      setProgress(Math.min(1, p));
      if (p >= 1) close();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, snap, mode]);

  const f = filterById(snap?.media_meta?.filter);

  return createPortal(
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] select-none bg-black" onClick={() => snap?.kind === 'image' && close()} onContextMenu={(e) => e.preventDefault()}>
      {!url && <div className="grid h-full place-items-center"><Loader2 className="h-7 w-7 animate-spin text-white/70" /></div>}
      {url && snap?.kind === 'image' && <img src={url} alt="" draggable={false} onLoad={() => setReady(true)} className="h-full w-full object-contain" />}
      {url && snap?.kind === 'video' && (
        <video
          src={url}
          autoPlay
          playsInline
          controls={false}
          onPlaying={() => setReady(true)}
          onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)}
          onEnded={close}
          className="h-full w-full object-contain"
          style={{ filter: f.css }}
        />
      )}
      {url && f.tint && snap?.kind === 'video' && <div className="pointer-events-none absolute inset-0" style={{ background: f.tint }} />}
      {overlay && <img src={overlay} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />}
      <div className="absolute inset-x-3 top-0 pt-safe">
        <div className="h-1 overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white transition-[width] duration-100" style={{ width: `${(snap?.kind === 'image' && !snap.duration_seconds ? 0 : progress) * 100}%` }} />
        </div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); close(); }} aria-label="Close snap" className="absolute right-3 top-[calc(env(safe-area-inset-top)+1rem)] grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur">
        <X className="h-5 w-5" />
      </button>
    </motion.div>,
    document.body,
  );
}
