import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ImagePlus, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { loadLandmarker } from '@/features/camera/lenses';
import { useThumb } from '../editor/thumbs';
import type { Look } from '../look/config';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { analyzeFace, frameHint, type FaceTraits, type FrameHint, type Pt, type RGB, type Sampler } from './analyze';
import { looksFromTraits } from './generate';

export const SELFIE_LOOK_KEY = 'snv-selfie-look';

const HINT: Record<FrameHint, string> = {
  ok: 'Perfect — hold still',
  'no-face': 'Put your face in the oval',
  many: 'Just you in the frame, please',
  closer: 'Move a little closer',
  farther: 'Move back a little',
  center: 'Centre your face in the oval',
  straight: 'Look straight at the camera',
  light: 'Find a bit more light',
};

/** Pixel sampler over an ImageData; radius is in units of image height. */
function samplerFor(img: ImageData): Sampler {
  const { width: w, height: h, data } = img;
  return (x, y, r) => {
    const cx = Math.round(x * w), cy = Math.round(y * h), rad = Math.max(1, Math.round(r * h));
    let R = 0, G = 0, B = 0, n = 0;
    for (let yy = cy - rad; yy <= cy + rad; yy += Math.max(1, rad >> 2)) {
      if (yy < 0 || yy >= h) continue;
      for (let xx = cx - rad; xx <= cx + rad; xx += Math.max(1, rad >> 2)) {
        if (xx < 0 || xx >= w) continue;
        const i = (yy * w + xx) * 4;
        R += data[i]; G += data[i + 1]; B += data[i + 2]; n++;
      }
    }
    return n ? [R / n, G / n, B / n] : [0, 0, 0];
  };
}

function frame(video: HTMLVideoElement | HTMLImageElement, maxW: number): { canvas: HTMLCanvasElement; img: ImageData } {
  const vw = 'videoWidth' in video ? video.videoWidth : video.naturalWidth;
  const vh = 'videoHeight' in video ? video.videoHeight : video.naturalHeight;
  const s = Math.min(1, maxW / vw);
  const c = document.createElement('canvas');
  c.width = Math.round(vw * s);
  c.height = Math.round(vh * s);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(video, 0, 0, c.width, c.height);
  return { canvas: c, img: g.getImageData(0, 0, c.width, c.height) };
}

type Phase = 'starting' | 'live' | 'working' | 'results' | 'error';

/**
 * Selfie → avatar (like the familiar sign-up flow, all original): the camera finds
 * your face live, reads your colours and features in real time on the phone, and
 * turns them into six editable 3D avatars. Nothing leaves the device; no paid APIs.
 */
export default function SelfieAvatarScreen() {
  const navigate = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<FrameHint>('no-face');
  const [live, setLive] = useState<FaceTraits | null>(null);
  const [looks, setLooks] = useState<{ name: string; look: Look }[]>([]);
  const [pick, setPick] = useState(0);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  // Start camera + face model; run the live guide loop.
  useEffect(() => {
    let alive = true;
    let timer = 0;
    let lastAnalyze = 0;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocam');
        const [s, lm] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
          loadLandmarker(),
        ]);
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        const v = video.current!;
        v.srcObject = s;
        await v.play();
        setPhase('live');
        const tick = () => {
          if (!alive) return;
          if (v.readyState >= 2 && v.videoWidth) {
            const res = lm.detectForVideo(v, performance.now());
            const faces = (res.faceLandmarks ?? []) as Pt[][];
            const small = faces.length === 1 ? frame(v, 360) : null;
            const sample = small ? samplerFor(small.img) : null;
            const h = frameHint(faces, sample);
            setHint(h);
            // Live read-out of what we see (throttled).
            const now = performance.now();
            if (small && h === 'ok' && now - lastAnalyze > 700) {
              lastAnalyze = now;
              setLive(analyzeFace(faces[0], samplerFor(small.img), small.canvas.width / small.canvas.height));
            }
          }
          timer = window.setTimeout(tick, 140);
        };
        tick();
      } catch (e) {
        if (!alive) return;
        const msg = (e as Error)?.name === 'NotAllowedError' || (e as Error)?.message === 'nocam'
          ? 'Camera access is off. You can upload a selfie instead.'
          : 'Couldn’t start the camera here. You can upload a selfie instead.';
        setError(msg);
        setPhase('error');
      }
    })();
    const onHide = () => document.hidden && stop();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHide);
      stop();
    };
  }, [stop]);

  /** Analyse a full-quality image (captured frame or uploaded photo). */
  async function finish(source: HTMLVideoElement | HTMLImageElement) {
    setPhase('working');
    try {
      const lm = await loadLandmarker();
      const { canvas, img } = frame(source, 900);
      const res = lm.detectForVideo(canvas, performance.now());
      const faces = (res.faceLandmarks ?? []) as Pt[][];
      if (faces.length === 0) throw new Error('noface');
      // Biggest face if there are several.
      const f = faces.sort((a, b) => Math.abs(b[454].x - b[234].x) - Math.abs(a[454].x - a[234].x))[0];
      const traits = analyzeFace(f, samplerFor(img), canvas.width / canvas.height);
      stop();
      setLooks(looksFromTraits(traits));
      setLive(traits);
      setPick(0);
      setPhase('results');
      haptic(14);
    } catch (e) {
      setError((e as Error).message === 'noface' ? 'We couldn’t find a face in that photo. Try again facing the camera in good light.' : 'Something went wrong reading the photo — please try again.');
      setPhase(stream.current ? 'live' : 'error');
    }
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const im = new Image();
    im.onload = () => void finish(im).finally(() => URL.revokeObjectURL(im.src));
    im.onerror = () => setError('That file isn’t a photo we can read.');
    im.src = URL.createObjectURL(file);
  }

  function useLook() {
    const chosen = looks[pick];
    if (!chosen) return;
    try {
      sessionStorage.setItem(SELFIE_LOOK_KEY, JSON.stringify(chosen.look));
      sessionStorage.removeItem('snv-after-auth');
    } catch {
      /* storage blocked — the studio falls back to its default start */
    }
    navigate('/avatar?from=selfie', { replace: true });
  }

  if (phase === 'results') {
    return (
      <div className="flex min-h-full flex-col bg-noir pt-safe text-ink">
        <header className="flex items-center gap-2 px-4 pt-3">
          <button onClick={() => navigate(-1)} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-2xl bg-white"><X className="h-5 w-5" /></button>
          <span className="flex-1" />
          <button onClick={() => location.reload()} className="flex items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2.5 text-sm font-extrabold"><RefreshCw className="h-4 w-4" />Retake</button>
        </header>
        <div className="px-5 pt-4">
          <h1 className="font-display text-[32px] leading-none">These look like you</h1>
          <p className="mt-2 text-sm font-semibold text-ink-mute">Made from your selfie on this phone — pick one, then fine-tune anything.</p>
          {live && <Readout t={live} />}
        </div>
        <div className="grid grid-cols-2 gap-2.5 px-5 pb-36 pt-4" role="radiogroup" aria-label="Avatars made from your selfie">
          {looks.map((l, i) => (
            <LookCard key={i} index={i} look={l.look} name={l.name} on={pick === i} onPick={() => { haptic(8); setPick(i); }} />
          ))}
        </div>
        <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-noir via-noir to-transparent px-5 pb-safe pt-8">
          <button onClick={useLook} className="h-14 w-full rounded-2xl bg-[#111111] text-base font-extrabold text-white active:scale-[0.98]">Use this avatar</button>
        </div>
      </div>
    );
  }

  const ok = hint === 'ok' && phase === 'live';
  return (
    <div className="fixed inset-0 bg-black text-white">
      <video ref={video} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
      {/* Face guide */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <motion.div animate={{ scale: ok ? 1.02 : 1 }} className={cn('h-[52vh] w-[68vw] max-w-[320px] rounded-[50%] border-[5px] transition-colors', ok ? 'border-ember-sage' : 'border-white/80')} style={{ boxShadow: '0 0 0 100vmax rgba(0,0,0,.45)' }} />
      </div>
      <header className="absolute inset-x-0 top-0 flex items-center gap-2 px-4 pt-safe">
        <button onClick={() => navigate(-1)} aria-label="Close" className="mt-3 grid h-11 w-11 place-items-center rounded-2xl bg-black/50"><X className="h-5 w-5" /></button>
        <span className="flex-1" />
        <span className="mt-3 flex items-center gap-1.5 rounded-2xl bg-black/50 px-3 py-2 text-xs font-extrabold"><Sparkles className="h-4 w-4" />Selfie → avatar</span>
      </header>

      <div className="absolute inset-x-0 top-[calc(var(--safe-top)+72px)] flex justify-center px-6">
        <span className={cn('rounded-2xl px-4 py-2.5 text-center text-sm font-extrabold', ok ? 'bg-ember-sage text-white' : 'bg-black/60')}>
          {phase === 'starting' ? 'Starting camera…' : phase === 'working' ? 'Reading your features…' : phase === 'error' ? error : HINT[hint]}
        </span>
      </div>

      {live && phase !== 'error' && (
        <div className="absolute inset-x-4 bottom-[calc(var(--safe-bottom)+150px)]"><Readout t={live} dark /></div>
      )}
      {error && phase === 'live' && <p className="absolute inset-x-6 bottom-[calc(var(--safe-bottom)+214px)] rounded-2xl bg-black/70 p-3 text-center text-sm font-semibold">{error}</p>}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-6 px-6 pb-[calc(var(--safe-bottom)+28px)]">
        <button onClick={() => fileRef.current?.click()} aria-label="Upload a selfie" className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-black/55"><ImagePlus className="h-6 w-6" /></button>
        <button
          onClick={() => video.current && void finish(video.current)}
          disabled={phase !== 'live' || hint === 'no-face'}
          aria-label="Take selfie"
          className="grid h-[84px] w-[84px] place-items-center rounded-[30px] border-[6px] border-white disabled:opacity-40"
        >
          {phase === 'working' ? <Loader2 className="h-8 w-8 animate-spin" /> : <span className={cn('h-[58px] w-[58px] rounded-[22px]', ok ? 'bg-ember-sage' : 'bg-white/30')} />}
        </button>
        <button onClick={() => navigate('/onboarding/avatar?characters=1', { replace: true })} aria-label="Pick a character instead" className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-black/55 text-[11px] font-extrabold leading-tight">Pick<br />one</button>
      </div>
      {phase === 'error' && (
        <div className="absolute inset-x-6 bottom-[calc(var(--safe-bottom)+150px)] flex flex-col gap-2">
          <button onClick={() => fileRef.current?.click()} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white font-extrabold text-ink"><ImagePlus className="h-5 w-5" />Upload a selfie</button>
          <button onClick={() => navigate('/onboarding/avatar?characters=1', { replace: true })} className="h-12 rounded-2xl bg-white/15 font-extrabold">Pick a character instead</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onUpload} />
    </div>
  );
}

const swatch = (c: RGB) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;

/** Live chips showing what the camera reads. */
function Readout({ t, dark }: { t: FaceTraits; dark?: boolean }) {
  const chip = cn('flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12px] font-extrabold', dark ? 'bg-black/60 text-white' : 'bg-white text-ink');
  const dot = (c: RGB) => <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: swatch(c) }} />;
  return (
    <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
      <span className={chip}>{dot(t.skin)}Skin</span>
      {t.hairLength !== 'none' && <span className={chip}>{dot(t.hair)}{t.hairLength === 'long' ? 'Long hair' : t.hairLength === 'medium' ? 'Medium hair' : 'Short hair'}</span>}
      <span className={chip}>{dot(t.eyes)}Eyes</span>
      <span className={chip}>{t.faceShape} face</span>
      {t.beard !== 'none' && <span className={chip}>{t.beard === 'beard' ? 'Beard' : t.beard === 'stubble' ? 'Stubble' : 'Moustache'}</span>}
    </div>
  );
}

function LookCard({ index, look, name, on, onPick }: { index: number; look: Look; name: string; on: boolean; onPick: () => void }) {
  const key = `selfie-${index}-${JSON.stringify(look).length}-${look.skin}-${look.pick.hair}-${look.pick.top}`;
  const url = useThumb(key, () => look, 'full', true);
  return (
    <button role="radio" aria-checked={on} onClick={onPick} className={cn('relative flex aspect-[3/4] flex-col items-center justify-end overflow-hidden rounded-tile bg-white pb-2 transition-shadow', on && 'ring-[3px] ring-ink')}>
      {url ? <img src={url} alt="" className="absolute inset-x-0 top-1 mx-auto h-[88%] w-auto object-contain" /> : <Loader2 className="absolute top-1/2 h-6 w-6 -translate-y-1/2 animate-spin text-ink-mute" />}
      <span className="relative rounded-lg bg-white/90 px-2 py-0.5 text-[12px] font-extrabold">{name}</span>
      {on && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-lg bg-[#111111] text-white"><Check className="h-4 w-4" /></span>}
    </button>
  );
}

