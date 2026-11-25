import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { publicUrl } from '@/lib/storageUrl';
import type { SpotlightVideo } from '@/lib/social/api';
import { useToast } from '@/providers/ToastProvider';

const W = 720, H = 640, MAX_S = 30;

/**
 * Remix side by side: the original plays on the left while your camera records on the right.
 * Both are drawn into one canvas and recorded with the original's sound + your mic (on the phone).
 */
export function RemixRecorder({ video, onDone, onClose }: { video: SpotlightVideo; onDone: (blob: Blob, duration: number) => void; onClose: () => void }) {
  const toast = useToast();
  const orig = useRef<HTMLVideoElement>(null);
  const cam = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [left, setLeft] = useState(MAX_S);
  const stopRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: { echoCancellation: true } });
        cam.current!.srcObject = stream;
        await cam.current!.play();
        setReady(true);
      } catch {
        toast('Allow camera and microphone to remix', 'error');
        onClose();
      }
    })();
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const g = canvas.current?.getContext('2d');
      if (!g) return;
      g.fillStyle = '#111';
      g.fillRect(0, 0, W, H);
      const cover = (v: HTMLVideoElement | null, x: number, mirror: boolean) => {
        if (!v || !v.videoWidth) return;
        const s = Math.max(W / 2 / v.videoWidth, H / v.videoHeight);
        const dw = v.videoWidth * s, dh = v.videoHeight * s;
        g.save();
        g.beginPath();
        g.rect(x, 0, W / 2, H);
        g.clip();
        if (mirror) {
          g.translate(x + W / 2, 0);
          g.scale(-1, 1);
          g.drawImage(v, (W / 2 - dw) / 2, (H - dh) / 2, dw, dh);
        } else g.drawImage(v, x + (W / 2 - dw) / 2, (H - dh) / 2, dw, dh);
        g.restore();
      };
      cover(orig.current, 0, false);
      cover(cam.current, W / 2, true);
      g.fillStyle = '#fff';
      g.fillRect(W / 2 - 2, 0, 4, H);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      stopRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function record() {
    const c = canvas.current!, o = orig.current!, v = cam.current!;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    const dest = ac.createMediaStreamDestination();
    ac.createMediaElementSource(o).connect(dest);
    const mic = (v.srcObject as MediaStream).getAudioTracks()[0];
    if (mic) ac.createMediaStreamSource(new MediaStream([mic])).connect(dest);
    const out = new MediaStream([...c.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const mime = ['video/mp4;codecs=avc1,mp4a', 'video/webm;codecs=vp9,opus', 'video/webm'].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? '';
    const rec = new MediaRecorder(out, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 2_500_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const started = performance.now();
    const limit = Math.min(MAX_S, Number.isFinite(o.duration) && o.duration > 1 ? o.duration : MAX_S);
    const tick = setInterval(() => setLeft(Math.max(0, Math.ceil(limit - (performance.now() - started) / 1000))), 250);
    const finish = () => {
      clearInterval(tick);
      if (rec.state !== 'inactive') rec.stop();
    };
    stopRef.current = finish;
    rec.onstop = () => {
      o.pause();
      void ac.close();
      onDone(new Blob(chunks, { type: (rec.mimeType || 'video/webm').split(';')[0] }), (performance.now() - started) / 1000);
    };
    o.currentTime = 0;
    o.muted = false;
    await o.play();
    rec.start(250);
    setRecording(true);
    setTimeout(finish, limit * 1000);
    o.onended = finish;
  }

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[90] flex flex-col bg-black text-white">
      <div className="flex items-center gap-2 px-3 pt-safe">
        <button onClick={onClose} disabled={recording} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 disabled:opacity-40"><X className="h-5 w-5" /></button>
        <p className="flex-1 text-center text-sm font-extrabold">Remix with @{video.username}</p>
        <span className="w-11" />
      </div>
      <div className="grid flex-1 place-items-center px-2">
        <canvas ref={canvas} width={W} height={H} className="w-full max-w-[560px] rounded-3xl" />
      </div>
      <video ref={orig} src={publicUrl('spotlight', video.media_path)} crossOrigin="anonymous" playsInline muted preload="auto" className="hidden" />
      <video ref={cam} playsInline muted className="hidden" />
      <div className="flex flex-col items-center gap-2 pb-[max(2rem,var(--safe-bottom))]">
        {recording ? (
          <>
            <button onClick={() => stopRef.current()} aria-label="Stop" className="grid h-[84px] w-[84px] place-items-center rounded-[30px] border-[6px] border-white"><span className="h-8 w-8 rounded-lg bg-ember-rose" /></button>
            <p className="text-xs font-bold text-white/80">{left}s left</p>
          </>
        ) : (
          <>
            <button onClick={() => void record()} disabled={!ready} aria-label="Start remix" className="grid h-[84px] w-[84px] place-items-center rounded-[30px] border-[6px] border-white disabled:opacity-40">{ready ? <span className="h-12 w-12 rounded-2xl bg-ember-rose" /> : <Loader2 className="h-6 w-6 animate-spin" />}</button>
            <p className="text-xs font-bold text-white/80">Tap to record alongside the original</p>
          </>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}
