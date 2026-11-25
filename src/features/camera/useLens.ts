import { useEffect, useRef, useState } from 'react';
import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { loadLandmarker, preloadLensArt } from './lenses';
import { lensById } from './allLenses';
import { loadSegmenter, MaskTracker } from './segment';

/**
 * Runs the active lens on the live preview and draws it onto an overlay canvas (in video
 * pixel space). Sticker lenses draw on a transparent overlay; frame lenses (background,
 * hair, makeup, warps) repaint the whole frame. Also keeps a composite canvas (video +
 * lens) whose stream is used when recording with a lens.
 */
export function useLens(videoRef: React.RefObject<HTMLVideoElement>, overlayRef: React.RefObject<HTMLCanvasElement>, lensId: string | null, mirror: boolean) {
  const [state, setState] = useState<'off' | 'loading' | 'ready' | 'error'>('off');
  const [faces, setFaces] = useState(0);
  const composite = useRef<HTMLCanvasElement | null>(null);
  const compositeStream = useRef<MediaStream | null>(null);
  const lens = lensById(lensId);

  useEffect(() => {
    if (!lens) {
      setState('off');
      const c = overlayRef.current;
      c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
      return;
    }
    let raf = 0;
    let alive = true;
    let lastTs = -1;
    let lastFaces = -1;
    setState('loading');
    preloadLensArt();
    const needFace = lens.needs.includes('face');
    Promise.all([
      needFace ? loadLandmarker() : Promise.resolve(null as FaceLandmarker | null),
      lens.needs.includes('selfie') ? loadSegmenter('selfie').then((s) => new MaskTracker(s, 'selfie')) : Promise.resolve(null),
      lens.needs.includes('hair') ? loadSegmenter('hair').then((s) => new MaskTracker(s, 'hair')) : Promise.resolve(null),
    ])
      .then(([lm, person, hair]) => {
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
          const found: NormalizedLandmark[][] = lm ? lm.detectForVideo(v, ts).faceLandmarks ?? [] : [];
          const ctx = c.getContext('2d')!;
          const n = needFace ? found.length : 1;
          if (n !== lastFaces) {
            lastFaces = n;
            setFaces(n);
          }
          if (lens.kind === 'frame') {
            ctx.save();
            lens.frame({ ctx, video: v, w: c.width, h: c.height, t: ts / 1000, faces: found, person: person?.update(v, ts) ?? null, hair: hair?.update(v, ts) ?? null });
            ctx.restore();
          } else {
            ctx.clearRect(0, 0, c.width, c.height);
            for (const f of found) {
              ctx.save();
              lens.draw(ctx, f, c.width, c.height, ts / 1000);
              ctx.restore();
            }
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
            if (lens.kind !== 'frame') cc.drawImage(v, 0, 0, comp.width, comp.height);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lensId, mirror, overlayRef, videoRef]);

  return {
    state,
    faces,
    /** True when the lens repaints the whole frame (overlay is opaque). */
    fullFrame: lens?.kind === 'frame',
    needsFace: !!lens?.needs.includes('face'),
    /** Stream of video+lens for MediaRecorder (created lazily). */
    recordingStream: () => {
      if (!composite.current) composite.current = document.createElement('canvas');
      if (!compositeStream.current) compositeStream.current = composite.current.captureStream(30);
      return compositeStream.current;
    },
  };
}
