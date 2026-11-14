import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X, CameraOff, Images, ImagePlus, Loader2, RefreshCw, ScanFace, Settings2, SwitchCamera, Timer, Zap, ZapOff } from 'lucide-react';
import { LENSES } from './lenses';
import { useLens } from './useLens';
import { useNotificationsOptional } from '@/providers/NotificationsProvider';
import { useToast } from '@/providers/ToastProvider';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { FILTERS, paintTint } from '@/lib/snaps/filters';
import { MAX_VIDEO_BYTES } from '@/lib/chat/media';
import { captureFrame, useCamera } from './useCamera';
import { MAX_RECORD_SECONDS, useRecorder } from './useRecorder';

const MediaEditor = lazy(() => import('@/features/editor/MediaEditor'));
const TIMER_STEPS = [0, 3, 10] as const;
const HOLD_MS = 280;

export interface Captured {
  blob: Blob;
  kind: 'image' | 'video';
  filter: string;
  duration?: number;
}

export default function CameraScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const cam = useCamera(videoRef);
  const [lensId, setLensId] = useState<string | null>(null);
  const [lensTray, setLensTray] = useState(false);
  const lens = useLens(videoRef, overlayRef, lensId, cam.facing === 'user');
  const recorder = useRecorder(() => {
    const raw = cam.stream();
    if (!lensId || lens.state !== 'ready' || !raw) return raw;
    // Record the lens composite; keep the original audio-less video track out.
    return lens.recordingStream();
  });
  const unreadActivity = useNotificationsOptional()?.unread ?? 0;
  const toast = useToast();
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [flashFx, setFlashFx] = useState(false);
  const [timer, setTimer] = useState<(typeof TIMER_STEPS)[number]>(0);
  const [countdown, setCountdown] = useState(0);
  const [filterIdx, setFilterIdx] = useState(0);
  const [showFilterName, setShowFilterName] = useState(false);
  const [recProgress, setRecProgress] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout>>();
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const mirror = cam.facing === 'user';
  const filter = FILTERS[filterIdx];

  useEffect(() => {
    if (!showFilterName) return;
    const t = setTimeout(() => setShowFilterName(false), 900);
    return () => clearTimeout(t);
  }, [showFilterName, filterIdx]);

  // Recording progress ring + auto-stop at the limit.
  useEffect(() => {
    if (!recorder.recording) return setRecProgress(0);
    const t = setInterval(() => {
      const e = recorder.elapsed();
      setRecProgress(Math.min(1, e / MAX_RECORD_SECONDS));
      if (e >= MAX_RECORD_SECONDS) void finishRecording();
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.recording]);

  function changeFilter(dir: 1 | -1) {
    haptic(5);
    setFilterIdx((i) => (i + dir + FILTERS.length) % FILTERS.length);
    setShowFilterName(true);
  }

  async function takePhoto() {
    const video = videoRef.current;
    if (!video || cam.status !== 'live') return;
    if (timer && !countdown) {
      for (let s = timer; s > 0; s--) {
        setCountdown(s);
        haptic(5);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setCountdown(0);
    }
    haptic([12, 30, 8]);
    setFlashFx(true);
    setTimeout(() => setFlashFx(false), 180);
    const blob = await captureFrame(video, mirror, filter.css, (ctx, w, h) => paintTint(ctx, filter, w, h), lensId ? overlayRef.current : null);
    if (!blob) return toast('Couldn’t capture — try again', 'error');
    setCaptured({ blob, kind: 'image', filter: 'none' });
  }

  async function finishRecording() {
    const out = await recorder.stop();
    if (!out) return;
    haptic(10);
    setCaptured({ blob: out.blob, kind: 'video', filter: filter.id, duration: out.duration });
  }

  function onShutterDown() {
    if (cam.status !== 'live' || countdown) return;
    holdTimer.current = setTimeout(async () => {
      haptic(14);
      const ok = await recorder.start();
      if (!ok) toast('Recording isn’t supported here', 'error');
    }, HOLD_MS);
  }
  function onShutterUp() {
    clearTimeout(holdTimer.current);
    if (recorder.recording) void finishRecording();
    else void takePhoto();
  }

  function onPick(file: File | undefined) {
    if (!file) return;
    if (file.type.startsWith('video/')) {
      if (file.size > MAX_VIDEO_BYTES) return toast('Videos must be under 25 MB', 'error');
      setCaptured({ blob: file, kind: 'video', filter: 'none' });
    } else if (file.type.startsWith('image/')) {
      setCaptured({ blob: file, kind: 'image', filter: 'none' });
    } else toast('Pick a photo or video', 'error');
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-black"
      onPointerDown={(e) => (swipe.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const s = swipe.current;
        swipe.current = null;
        if (!s || recorder.recording) return;
        const dx = e.clientX - s.x;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) changeFilter(dx < 0 ? 1 : -1);
      }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-500', cam.status === 'live' ? 'opacity-100' : 'opacity-0', mirror && '-scale-x-100')}
        style={{ filter: filter.css }}
      />
      <canvas ref={overlayRef} className={cn('pointer-events-none absolute inset-0 h-full w-full object-cover', mirror && '-scale-x-100', !lensId && 'hidden')} />
      {filter.tint && <div className="pointer-events-none absolute inset-0" style={{ background: filter.tint }} />}
      {lensId && lens.state === 'loading' && <div className="absolute inset-x-0 top-1/3 z-20 flex justify-center"><span className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm text-white backdrop-blur-md"><Loader2 className="h-4 w-4 animate-spin" /> Loading face tracking…</span></div>}
      {lensId && lens.state === 'error' && <div className="absolute inset-x-0 top-1/3 z-20 flex justify-center"><span className="rounded-full bg-black/60 px-4 py-2 text-sm text-white">Lenses need an internet connection the first time</span></div>}
      {lensId && lens.state === 'ready' && lens.faces === 0 && <div className="pointer-events-none absolute inset-x-0 top-1/3 z-20 flex justify-center"><span className="rounded-full bg-black/40 px-4 py-2 text-sm text-white/90 backdrop-blur-md">Point the camera at a face</span></div>}

      {cam.status !== 'live' && <CameraState status={cam.status} onRetry={cam.retry} />}

      <AnimatePresence>{flashFx && <motion.div initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 bg-white" />}</AnimatePresence>

      <AnimatePresence>
        {showFilterName && (
          <motion.div key={filter.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-1/3 z-20 text-center">
            <span className="font-display text-3xl font-medium text-white drop-shadow-[0_2px_20px_rgba(0,0,0,.6)]">{filter.name}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {countdown > 0 && (
          <motion.div key={countdown} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="absolute inset-0 z-20 grid place-items-center">
            <span className="font-display text-8xl font-bold text-white drop-shadow-[0_0_30px_rgba(255,122,61,0.9)]">{countdown}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between bg-gradient-to-b from-black/50 to-transparent px-4 pb-10 pt-safe">
        <div className="flex items-center gap-2">
          <Link to="/" aria-label="Close camera" className="grid h-11 w-11 place-items-center rounded-full bg-black/25 text-white ring-1 ring-white/10 backdrop-blur-md active:scale-90">
            <X className="h-5 w-5" />
          </Link>
          <Link to="/notifications" aria-label={`Activity${unreadActivity ? `, ${unreadActivity} new` : ''}`} className="relative grid h-11 w-11 place-items-center rounded-full bg-black/25 text-white ring-1 ring-white/10 backdrop-blur-md active:scale-90">
            <Bell className="h-5 w-5" />
            {unreadActivity > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-ember-rose px-1 text-[10px] font-bold">{unreadActivity > 9 ? '9+' : unreadActivity}</span>}
          </Link>
        </div>
        <div className="flex flex-col gap-2 rounded-full bg-black/25 p-1.5 ring-1 ring-white/10 backdrop-blur-md">
          {cam.hasMultiple && (
            <CamButton label="Switch camera" onClick={cam.flip} disabled={recorder.recording}>
              <SwitchCamera className="h-5 w-5" />
            </CamButton>
          )}
          {cam.caps.torch && (
            <CamButton label={cam.torch ? 'Flash off' : 'Flash on'} onClick={() => cam.setTorch(!cam.torch)} active={cam.torch}>
              {cam.torch ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
            </CamButton>
          )}
          <CamButton label={`Timer ${timer ? `${timer}s` : 'off'}`} onClick={() => setTimer((t) => TIMER_STEPS[(TIMER_STEPS.indexOf(t) + 1) % TIMER_STEPS.length])} active={timer > 0}>
            <span className="relative">
              <Timer className="h-5 w-5" />
              {timer > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-ember-flame px-1 text-[9px] font-bold">{timer}</span>}
            </span>
          </CamButton>
          <Link to="/settings" aria-label="Settings" className="grid h-10 w-10 place-items-center rounded-full text-white active:scale-90">
            <Settings2 className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Zoom */}
      {cam.caps.zoom && cam.status === 'live' && (
        <div className="absolute inset-x-0 bottom-36 z-10 flex justify-center">
          <input type="range" aria-label="Zoom" min={cam.caps.zoom.min} max={Math.min(cam.caps.zoom.max, 8)} step={cam.caps.zoom.step || 0.1} value={cam.zoom} onChange={(e) => cam.setZoom(Number(e.target.value))} className="w-48 accent-ember-amber" />
        </div>
      )}

      {/* Lens tray */}
      <AnimatePresence>
        {lensTray && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="no-scrollbar absolute inset-x-0 bottom-[10.25rem] z-10 flex gap-2 overflow-x-auto px-4" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
            <button onClick={() => setLensId(null)} className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ring-2 backdrop-blur-md', !lensId ? 'bg-white/30 ring-white' : 'bg-black/30 ring-white/20')}>Off</button>
            {LENSES.map((l) => (
              <button key={l.id} onClick={() => { haptic(6); setLensId(l.id); }} aria-label={l.name} className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-full text-2xl ring-2 backdrop-blur-md transition-transform', lensId === l.id ? 'scale-110 bg-white/30 ring-white' : 'bg-black/30 ring-white/20')}>{l.emoji}</button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter dots */}
      <div className="absolute inset-x-0 bottom-[8.25rem] z-10 flex justify-center gap-1.5" aria-hidden>
        {FILTERS.map((f, i) => (
          <span key={f.id} className={cn('h-1.5 rounded-full transition-all duration-300', i === filterIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/40')} />
        ))}
      </div>

      {/* Capture row */}
      <div className="absolute inset-x-0 bottom-[max(2.5rem,calc(var(--safe-bottom)+1.5rem))] z-10 flex items-center justify-center gap-10">
        <div className="flex flex-col gap-2">
          <Link to="/memories" aria-label="Memories" className="grid h-12 w-12 place-items-center rounded-2xl bg-black/30 text-white ring-1 ring-white/15 backdrop-blur-md active:scale-90">
            <Images className="h-5 w-5" />
          </Link>
        </div>
        <button
          onPointerDown={(e) => { e.stopPropagation(); onShutterDown(); }}
          onPointerUp={(e) => { e.stopPropagation(); onShutterUp(); }}
          onPointerLeave={() => recorder.recording && void finishRecording()}
          onContextMenu={(e) => e.preventDefault()}
          disabled={cam.status !== 'live' || countdown > 0}
          aria-label="Tap for photo, hold for video"
          className="group relative grid h-20 w-20 touch-none select-none place-items-center rounded-full disabled:opacity-40"
        >
          <motion.span animate={{ scale: recorder.recording ? 1.25 : 1 }} className={cn('absolute inset-0 rounded-full', recorder.recording ? '' : 'ring-ember opacity-90')} />
          {recorder.recording && (
            <svg className="absolute inset-[-10px] h-[calc(100%+20px)] w-[calc(100%+20px)] -rotate-90" viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="5" />
              <circle cx="50" cy="50" r="46" fill="none" stroke="#fb7185" strokeWidth="5" strokeLinecap="round" strokeDasharray={289} strokeDashoffset={289 * (1 - recProgress)} />
            </svg>
          )}
          <span className="absolute inset-[4px] rounded-full bg-black/40 backdrop-blur-sm" />
          <motion.span animate={{ scale: recorder.recording ? 0.55 : 1, borderRadius: recorder.recording ? '30%' : '50%' }} className={cn('absolute inset-[9px]', recorder.recording ? 'bg-ember-rose' : 'bg-white')} />
        </button>
        <div className="flex gap-2">
          <button onClick={() => setLensTray((v) => !v)} aria-label="Face lenses" aria-pressed={lensTray} className={cn('grid h-12 w-12 place-items-center rounded-2xl ring-1 backdrop-blur-md active:scale-90', lensTray || lensId ? 'bg-ember-gradient text-noir ring-transparent' : 'bg-black/30 ring-white/15')}>
            <ScanFace className="h-5 w-5" />
          </button>
          <button onClick={() => gallery.current?.click()} aria-label="Upload from gallery" className="grid h-12 w-12 place-items-center rounded-2xl bg-black/30 text-white ring-1 ring-white/15 backdrop-blur-md active:scale-90">
            <ImagePlus className="h-5 w-5" />
          </button>
        </div>
        <input ref={gallery} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <AnimatePresence>
        {captured && (
          <Suspense fallback={<div className="absolute inset-0 z-50 bg-black" />}>
            <MediaEditor captured={captured} onClose={() => setCaptured(null)} />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}

function CamButton({ children, label, onClick, active, disabled }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button onClick={() => { haptic(6); onClick(); }} disabled={disabled} aria-label={label} aria-pressed={active} className={cn('grid h-10 w-10 place-items-center rounded-full text-white transition-colors active:scale-90 disabled:opacity-40', active && 'bg-white/20')}>
      {children}
    </button>
  );
}

function CameraState({ status, onRetry }: { status: string; onRetry: () => void }) {
  const copy: Record<string, { title: string; body: string }> = {
    idle: { title: 'Starting camera…', body: '' },
    starting: { title: 'Starting camera…', body: '' },
    denied: { title: 'Camera access is off', body: 'Allow camera access in your browser’s site settings (or the app’s permissions), then retry. You can still upload from your gallery.' },
    unavailable: { title: 'No camera found', body: 'This device doesn’t expose a camera. Use the gallery button to upload a photo or video.' },
    error: { title: 'Camera is busy', body: 'Another app may be using it. Close it and retry.' },
  };
  const c = copy[status] ?? copy.error;
  const busy = status === 'idle' || status === 'starting';
  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_top,#2a1d16,#0c0a09)] px-8 text-center">
      <div>
        <div className={cn('mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white/5 ring-1 ring-white/10', busy && 'animate-pulse')}>
          <CameraOff className="h-7 w-7 text-ink-soft" />
        </div>
        <p className="mt-4 font-display text-lg">{c.title}</p>
        {c.body && <p className="mx-auto mt-2 max-w-xs text-sm text-ink-mute">{c.body}</p>}
        {!busy && (
          <button onClick={onRetry} className="mx-auto mt-5 flex h-11 items-center gap-2 rounded-2xl bg-white/10 px-4 text-sm font-semibold ring-1 ring-white/15">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        )}
      </div>
    </div>
  );
}
