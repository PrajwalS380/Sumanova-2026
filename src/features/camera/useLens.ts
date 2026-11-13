import { useEffect, useRef, useState } from 'react';
import { LENSES, loadLandmarker } from './lenses';

/**
 * Runs face tracking on the live preview and draws the active lens onto an
 * overlay canvas (in video pixel space). Also maintains a composite canvas
 * (video + lens) whose stream is used when recording with a lens.
 */
export function useLens(videoRef: React.RefObject<HTMLVideoElement>, overlayRef: React.RefObject<HTMLCanvasElement>, lensId: string | null, mirror: boolean) {
  const [state, setState] = useState<'off' | 'loading' | 'ready' | 'error'>('off');
  const [faces, setFaces] = useState(0);
  const composite = useRef<HTMLCanvasElement | null>(null);
  const compositeStream = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!lensId) {
      setState('off');
      const c = overlayRef.current;
      c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
      return;
    }
    const lens = LENSES.find((l) => l.id === lensId);
    if (!lens) return;
    let raf = 0;
    let alive = true;
    let lastTs = -1;
    let lastFaces = -1;
    setState('loading');
    loadLandmarker()
      .then((lm) => {
        if (!alive) return;
        setState('ready');
        const loop = () => {
          raf = requestAnimationFrame(loop);
          const v = videoRef.current;
          const c = overlayRef.current;
          if (!v || !c || v.readyState < 2 || !v.videoWidth) return;
          if (c.width !== v.videoWidth) {
            c.width = v.videoWidth;
            c.height = v.videoHeight;
          }
          const ts = performance.now();
          if (ts === lastTs) return;
          lastTs = ts;
          const res = lm.detectForVideo(v, ts);
          const ctx = c.getContext('2d')!;
          ctx.clearRect(0, 0, c.width, c.height);
          const n = res.faceLandmarks?.length ?? 0;
          if (n !== lastFaces) {
            lastFaces = n;
            setFaces(n);
          }
          for (const f of res.faceLandmarks ?? []) {
            ctx.save();
            lens.draw(ctx, f, c.width, c.height, ts / 1000);
            ctx.restore();
          }
          // Keep the recording composite in sync (video + lens, mirrored like the preview).
          const comp = composite.current;
          if (comp) {
            if (comp.width !== c.width) {
              comp.width = c.width;
              comp.height = c.height;
            }
            const cc = comp.getContext('2d')!;
            cc.save();
            if (mirror) {
              cc.translate(comp.width, 0);
              cc.scale(-1, 1);
            }
            cc.drawImage(v, 0, 0, comp.width, comp.height);
            cc.drawImage(c, 0, 0);
            cc.restore();
          }
        };
        loop();
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [lensId, mirror, overlayRef, videoRef]);

  return {
    state,
    faces,
    /** Stream of video+lens for MediaRecorder (created lazily). */
    recordingStream: () => {
      if (!composite.current) composite.current = document.createElement('canvas');
      if (!compositeStream.current) compositeStream.current = composite.current.captureStream(30);
      return compositeStream.current;
    },
  };
}
