import { useCallback, useEffect, useRef, useState } from 'react';

export type Facing = 'user' | 'environment';
export type CameraStatus = 'idle' | 'starting' | 'live' | 'denied' | 'unavailable' | 'error';

interface Capabilities {
  zoom?: { min: number; max: number; step: number };
  torch?: boolean;
}

/**
 * Manages a getUserMedia camera stream. Releases the camera when the tab is
 * hidden or the component unmounts so we never hold the device in background.
 */
export function useCamera(videoRef: React.RefObject<HTMLVideoElement>) {
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>('user');
  const [status, setStatus] = useState<CameraStatus>('idle');
  const [caps, setCaps] = useState<Capabilities>({});
  const [zoom, setZoomState] = useState(1);
  const [torch, setTorchState] = useState(false);
  const [hasMultiple, setHasMultiple] = useState(true);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (mode: Facing) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unavailable');
        return;
      }
      stop();
      setStatus('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        const track = stream.getVideoTracks()[0];
        const c = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { zoom?: { min: number; max: number; step: number }; torch?: boolean };
        setCaps({ zoom: c.zoom && c.zoom.max > c.zoom.min ? c.zoom : undefined, torch: Boolean(c.torch) });
        setZoomState(c.zoom?.min ?? 1);
        setTorchState(false);
        setStatus('live');
        navigator.mediaDevices
          .enumerateDevices()
          .then((d) => setHasMultiple(d.filter((x) => x.kind === 'videoinput').length > 1))
          .catch(() => undefined);
      } catch (err) {
        const name = (err as DOMException)?.name;
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' ? 'unavailable' : 'error');
      }
    },
    [stop, videoRef],
  );

  useEffect(() => {
    void start(facing);
    const onVis = () => {
      if (document.hidden) stop();
      else void start(facing);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
  }, [facing, start, stop]);

  const applyConstraint = useCallback(async (c: Record<string, unknown>) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [c as MediaTrackConstraintSet] });
    } catch {
      /* not supported on this device */
    }
  }, []);

  return {
    stream: () => streamRef.current,
    status,
    facing,
    caps,
    zoom,
    torch,
    hasMultiple,
    flip: () => setFacing((f) => (f === 'user' ? 'environment' : 'user')),
    retry: () => void start(facing),
    setZoom: (z: number) => {
      setZoomState(z);
      void applyConstraint({ zoom: z });
    },
    setTorch: (on: boolean) => {
      setTorchState(on);
      void applyConstraint({ torch: on });
    },
  };
}

/** Draws the current video frame to a JPEG blob (mirrored for the front camera, filter baked in). */
export async function captureFrame(video: HTMLVideoElement, mirror: boolean, filterCss = 'none', tint?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): Promise<Blob | null> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  if (filterCss !== 'none' && 'filter' in ctx) ctx.filter = filterCss;
  ctx.drawImage(video, 0, 0, w, h);
  ctx.filter = 'none';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  tint?.(ctx, w, h);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9));
}
