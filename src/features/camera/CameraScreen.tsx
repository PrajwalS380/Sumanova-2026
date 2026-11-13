import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CameraOff, Download, Images, RefreshCw, Settings2, SwitchCamera, Timer, X, Zap, ZapOff } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { captureFrame, useCamera } from './useCamera';

const TIMER_STEPS = [0, 3, 10] as const;

export default function CameraScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cam = useCamera(videoRef);
  const { profile } = useAuth();
  const toast = useToast();
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [flashFx, setFlashFx] = useState(false);
  const [timer, setTimer] = useState<(typeof TIMER_STEPS)[number]>(0);
  const [countdown, setCountdown] = useState(0);
  const mirror = cam.facing === 'user';

  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.url);
  }, [shot]);

  async function take() {
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
    const blob = await captureFrame(video, mirror);
    if (!blob) return toast('Couldn’t capture — try again', 'error');
    setShot({ blob, url: URL.createObjectURL(blob) });
  }

  function save() {
    if (!shot) return;
    const a = document.createElement('a');
    a.href = shot.url;
    a.download = `sumanova-${Date.now()}.jpg`;
    a.click();
    toast('Saved to your device', 'success');
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Live preview */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-500', cam.status === 'live' ? 'opacity-100' : 'opacity-0', mirror && '-scale-x-100')}
      />

      {cam.status !== 'live' && <CameraState status={cam.status} onRetry={cam.retry} />}

      {/* Shutter flash */}
      <AnimatePresence>{flashFx && <motion.div initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 bg-white" />}</AnimatePresence>

      {/* Countdown */}
      <AnimatePresence>
        {countdown > 0 && (
          <motion.div key={countdown} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="absolute inset-0 z-20 grid place-items-center">
            <span className="font-display text-8xl font-bold text-white drop-shadow-[0_0_30px_rgba(139,92,246,0.9)]">{countdown}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between bg-gradient-to-b from-black/50 to-transparent px-4 pb-10 pt-safe">
        <Link to="/profile" aria-label="Your profile" className="active:scale-95">
          <Avatar name={profile?.display_name ?? '?'} url={profile?.avatar_url} aura={profile?.aura_color} size={44} />
        </Link>
        <div className="flex flex-col gap-2 rounded-full bg-black/25 p-1.5 ring-1 ring-white/10 backdrop-blur-md">
          {cam.hasMultiple && (
            <CamButton label="Switch camera" onClick={cam.flip}>
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
              {timer > 0 && <span className="absolute -right-2 -top-2 rounded-full bg-aurora-violet px-1 text-[9px] font-bold">{timer}</span>}
            </span>
          </CamButton>
          <Link to="/settings" aria-label="Settings" className="grid h-10 w-10 place-items-center rounded-full text-white active:scale-90">
            <Settings2 className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Zoom */}
      {cam.caps.zoom && cam.status === 'live' && (
        <div className="absolute inset-x-0 bottom-44 z-10 flex justify-center">
          <input
            type="range"
            aria-label="Zoom"
            min={cam.caps.zoom.min}
            max={Math.min(cam.caps.zoom.max, 8)}
            step={cam.caps.zoom.step || 0.1}
            value={cam.zoom}
            onChange={(e) => cam.setZoom(Number(e.target.value))}
            className="w-48 accent-aurora-iris"
          />
        </div>
      )}

      {/* Capture row */}
      <div className="absolute inset-x-0 bottom-28 z-10 flex items-center justify-center gap-10">
        <Link to="/memories" aria-label="Memories" className="grid h-12 w-12 place-items-center rounded-2xl bg-black/30 text-white ring-1 ring-white/15 backdrop-blur-md active:scale-90">
          <Images className="h-5 w-5" />
        </Link>
        <button
          onClick={take}
          disabled={cam.status !== 'live' || countdown > 0}
          aria-label="Take photo"
          className="group relative grid h-20 w-20 place-items-center rounded-full disabled:opacity-40"
        >
          <span className="absolute inset-0 rounded-full ring-aurora opacity-90" />
          <span className="absolute inset-[4px] rounded-full bg-black/40 backdrop-blur-sm" />
          <span className="absolute inset-[9px] rounded-full bg-white transition-transform duration-150 group-active:scale-90" />
        </button>
        <span className="h-12 w-12" aria-hidden />
      </div>

      {/* Captured preview */}
      <AnimatePresence>
        {shot && (
          <motion.div initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.22 }} className="absolute inset-0 z-50 bg-black">
            <img src={shot.url} alt="Captured" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 top-0 flex justify-between px-4 pt-safe">
              <button onClick={() => setShot(null)} aria-label="Discard" className="grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur-md">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent px-5 pb-safe pt-16">
              <button onClick={save} className="flex h-12 items-center gap-2 rounded-2xl bg-white/15 px-4 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-md">
                <Download className="h-5 w-5" /> Save
              </button>
              <p className="text-right text-xs text-white/70">Sending snaps to friends arrives with chat.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CamButton({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={() => {
        haptic(6);
        onClick();
      }}
      aria-label={label}
      aria-pressed={active}
      className={cn('grid h-10 w-10 place-items-center rounded-full text-white transition-colors active:scale-90', active && 'bg-white/20')}
    >
      {children}
    </button>
  );
}

function CameraState({ status, onRetry }: { status: string; onRetry: () => void }) {
  const copy: Record<string, { title: string; body: string }> = {
    idle: { title: 'Starting camera…', body: '' },
    starting: { title: 'Starting camera…', body: '' },
    denied: { title: 'Camera access is off', body: 'Allow camera access in your browser’s site settings (tap the lock icon in the address bar), then retry.' },
    unavailable: { title: 'No camera found', body: 'This device or browser doesn’t expose a camera. Gallery uploads will still work.' },
    error: { title: 'Camera is busy', body: 'Another app may be using it. Close it and retry.' },
  };
  const c = copy[status] ?? copy.error;
  const busy = status === 'idle' || status === 'starting';
  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_top,#1d2145,#070814)] px-8 text-center">
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
