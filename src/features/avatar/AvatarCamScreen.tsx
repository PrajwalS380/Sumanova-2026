import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { avatarApi } from './api';
import { Figure } from './render/Figure';
import type { Expression, Look } from './look/config';
import type { Captured } from '@/features/camera/CameraScreen';
import { NovaEmoji } from '@/components/emoji/NovaEmoji';
import { haptic } from '@/lib/haptics';

const MediaEditor = lazy(() => import('@/features/editor/MediaEditor'));
const BG = ['#FF4F9A', '#3D7BFF', '#18C48C', '#8C6BFF', '#111111'];

/** Live head pose + expression from the camera (shared with the 3D scene without re-rendering React). */
interface Pose { yaw: number; pitch: number; roll: number }

/** Map MediaPipe face blendshapes to one of the avatar's expressions. */
export function expressionFrom(b: Record<string, number>): Expression {
  const g = (k: string) => b[k] ?? 0;
  const smile = (g('mouthSmileLeft') + g('mouthSmileRight')) / 2;
  const blinkL = g('eyeBlinkLeft'), blinkR = g('eyeBlinkRight');
  if (blinkL > 0.6 && blinkR > 0.6) return 'sleeping';
  if (Math.abs(blinkL - blinkR) > 0.45 && Math.max(blinkL, blinkR) > 0.6) return 'winking';
  if (g('tongueOut') > 0.4) return 'tongue';
  if (g('jawOpen') > 0.45 && smile > 0.35) return 'laughing';
  if (g('jawOpen') > 0.4) return 'surprised';
  if (smile > 0.45) return 'happy';
  if ((g('browDownLeft') + g('browDownRight')) / 2 > 0.45) return 'angry';
  if ((g('mouthFrownLeft') + g('mouthFrownRight')) / 2 > 0.35) return 'sad';
  return 'neutral';
}

function Head({ look, expression, pose }: { look: Look; expression: Expression; pose: React.MutableRefObject<Pose> }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 2.0, 1.75);
    camera.lookAt(0, 1.97, 0);
  }, [camera]);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = pose.current;
    g.rotation.y += (p.yaw - g.rotation.y) * 0.35;
    g.rotation.x += (p.pitch - g.rotation.x) * 0.35;
    g.rotation.z += (p.roll - g.rotation.z) * 0.35;
  });
  return (
    <group position={[0, 1.95, 0]}>
      <group ref={group}>
        <group position={[0, -1.95, 0]}>
          <Figure look={{ ...look, expression }} only="head" animate={false} />
        </group>
      </group>
    </group>
  );
}

export default function AvatarCamScreen() {
  const { session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const glCanvas = useRef<HTMLCanvasElement | null>(null);
  const pose = useRef<Pose>({ yaw: 0, pitch: 0, roll: 0 });
  const [look, setLook] = useState<Look | null | undefined>(undefined);
  const [expression, setExpression] = useState<Expression>('neutral');
  const [ready, setReady] = useState(false);
  const [bg, setBg] = useState(0);
  const [recording, setRecording] = useState(false);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const holdT = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (session) void avatarApi.get(session.user.id).then(setLook).catch(() => setLook(null));
  }, [session]);

  // Camera + face tracking with blendshapes and head pose.
  useEffect(() => {
    if (!look) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let alive = true;
    let lm: FaceLandmarker | null = null;
    let lastExpr: Expression = 'neutral';
    let lastTs = 0;
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
        if (!alive) return stream.getTracks().forEach((t) => t.stop());
        video.current!.srcObject = stream;
        await video.current!.play();
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const files = await FilesetResolver.forVisionTasks('/mediapipe');
        const opts = (delegate: 'GPU' | 'CPU') => ({ baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate }, runningMode: 'VIDEO' as const, numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true });
        lm = await FaceLandmarker.createFromOptions(files, opts('GPU')).catch(() => FaceLandmarker.createFromOptions(files, opts('CPU')));
        if (!alive) return;
        setReady(true);
        const m = new THREE.Matrix4();
        const e = new THREE.Euler();
        const loop = () => {
          raf = requestAnimationFrame(loop);
          const v = video.current;
          if (!v || v.readyState < 2) return;
          const ts = Math.max(performance.now(), lastTs + 1);
          lastTs = ts;
          const res = lm!.detectForVideo(v, ts);
          const mat = res.facialTransformationMatrixes?.[0];
          if (mat) {
            m.fromArray(mat.data);
            e.setFromRotationMatrix(m, 'YXZ');
            // Front camera is mirrored, so mirror yaw and roll.
            pose.current = { yaw: -e.y, pitch: e.x, roll: -e.z };
          }
          const cats = res.faceBlendshapes?.[0]?.categories;
          if (cats) {
            const next = expressionFrom(Object.fromEntries(cats.map((c) => [c.categoryName, c.score])));
            if (next !== lastExpr) {
              lastExpr = next;
              setExpression(next);
            }
          }
        };
        loop();
      } catch {
        toast('Allow camera access to use Avatar Cam', 'error');
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      lm?.close();
    };
  }, [look, toast]);

  /** The avatar on the chosen background, as a canvas frame. */
  function composite(out: HTMLCanvasElement) {
    const src = glCanvas.current;
    if (!src) return;
    out.width = src.width;
    out.height = src.height;
    const g = out.getContext('2d')!;
    g.fillStyle = BG[bg];
    g.fillRect(0, 0, out.width, out.height);
    g.drawImage(src, 0, 0);
  }

  async function photo() {
    const c = document.createElement('canvas');
    composite(c);
    haptic([10, 30, 8]);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92));
    if (blob) setCaptured({ blob, kind: 'image', filter: 'none' });
  }
  function startVideo() {
    const c = document.createElement('canvas');
    composite(c);
    const stream = c.captureStream(30);
    const mime = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    let raf = 0;
    const draw = () => {
      composite(c);
      raf = requestAnimationFrame(draw);
    };
    draw();
    const started = performance.now();
    rec.onstop = () => {
      cancelAnimationFrame(raf);
      setRecording(false);
      setCaptured({ blob: new Blob(chunks, { type: (rec.mimeType || 'video/webm').split(';')[0] }), kind: 'video', filter: 'none', duration: (performance.now() - started) / 1000 });
    };
    rec.start(250);
    setRecording(true);
    const auto = setTimeout(() => rec.state !== 'inactive' && rec.stop(), 30_000);
    recRef.current = { stop: () => { clearTimeout(auto); if (rec.state !== 'inactive') rec.stop(); } };
  }

  if (look === null) {
    return (
      <div className="grid h-full place-items-center bg-noir p-8 text-center">
        <div>
          <NovaEmoji id="sparkle" size={56} />
          <p className="mt-3 font-extrabold">Make your avatar to use Avatar Cam</p>
          <Link to="/onboarding/avatar" className="mt-3 inline-block rounded-2xl bg-ink px-4 py-2.5 text-sm font-extrabold text-white">Create my avatar</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="relative h-full overflow-hidden" style={{ background: BG[bg] }}>
      <video ref={video} playsInline muted className="absolute bottom-[calc(84px+var(--safe-bottom)+7rem)] right-3 z-10 h-28 w-20 rounded-2xl object-cover opacity-90 ring-2 ring-white/70" style={{ transform: 'scaleX(-1)' }} />
      {look && (
        <Canvas className="absolute inset-0" dpr={[1, 2]} gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }} camera={{ position: [0, 2, 1.75], fov: 30 }} onCreated={({ gl }) => (glCanvas.current = gl.domElement)}>
          <hemisphereLight args={['#fff6ec', '#6a5446', 1.0]} />
          <directionalLight position={[2.2, 3.6, 3.4]} intensity={2.2} color="#fff0e0" />
          <directionalLight position={[-2.6, 1.9, 3]} intensity={0.9} color="#ffe2d2" />
          <directionalLight position={[-2, 3, -3.5]} intensity={1.4} color="#c4dcff" />
          <Suspense fallback={null}><Head look={look} expression={expression} pose={pose} /></Suspense>
        </Canvas>
      )}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3.5 pt-safe">
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl bg-black/30 text-white"><ChevronLeft className="h-5 w-5" /></button>
        <span className="flex-1 text-center text-sm font-extrabold text-white drop-shadow">Avatar Cam {ready ? `· ${expression}` : ''}</span>
        <button onClick={() => setBg((b) => (b + 1) % BG.length)} aria-label="Change background" className="grid h-11 w-11 place-items-center rounded-2xl bg-white/90"><span className="h-5 w-5 rounded-full ring-2 ring-ink" style={{ background: BG[(bg + 1) % BG.length] }} /></button>
      </header>
      {!ready && look !== undefined && <div className="absolute inset-x-0 top-1/3 z-20 flex justify-center"><span className="flex items-center gap-2 rounded-xl bg-black/50 px-4 py-2 text-sm text-white"><Loader2 className="h-4 w-4 animate-spin" /> Starting face tracking…</span></div>}
      <div className="absolute inset-x-0 bottom-[calc(84px+var(--safe-bottom)+1.5rem)] z-20 flex flex-col items-center gap-2">
        <button
          onPointerDown={() => { holdT.current = setTimeout(() => startVideo(), 280); }}
          onPointerUp={() => { clearTimeout(holdT.current); if (recording) recRef.current?.stop(); else void photo(); }}
          disabled={!ready}
          aria-label="Tap for photo, hold for video"
          className="grid h-[84px] w-[84px] place-items-center rounded-[30px] border-[6px] border-white disabled:opacity-40"
        >
          {recording && <span className="h-9 w-9 rounded-xl bg-ember-rose" />}
        </button>
        <p className="text-xs font-bold text-white/90 drop-shadow">Move your head and make faces · tap for photo · hold for video</p>
      </div>
      <AnimatePresence>
        {captured && (
          <Suspense fallback={<div className="fixed inset-0 z-[90] bg-black" />}>
            <MediaEditor captured={captured} onClose={() => setCaptured(null)} />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
