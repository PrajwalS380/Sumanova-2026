import { useCallback, useRef, useState } from 'react';

export const MAX_RECORD_SECONDS = 30;

function pickVideoMime() {
  const opts = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return opts.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)) ?? '';
}

/** Records the live camera stream plus microphone. Mic is requested only when recording starts. */
export function useRecorder(getStream: () => MediaStream | null) {
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const mic = useRef<MediaStream | null>(null);
  const started = useRef(0);
  const pausedAt = useRef(0);
  const pausedTotal = useRef(0);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [clips, setClips] = useState(0);

  const start = useCallback(async () => {
    const cam = getStream();
    if (!cam || rec.current) return false;
    try {
      mic.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      mic.current = null; // record silently if mic is denied
    }
    const stream = new MediaStream([...cam.getVideoTracks(), ...(mic.current?.getAudioTracks() ?? [])]);
    const mime = pickVideoMime();
    const r = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 96_000 });
    chunks.current = [];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.start(250);
    rec.current = r;
    started.current = performance.now();
    pausedTotal.current = 0;
    setClips(1);
    setPaused(false);
    setRecording(true);
    return true;
  }, [getStream]);

  const stop = useCallback(
    () =>
      new Promise<{ blob: Blob; duration: number } | null>((resolve) => {
        const r = rec.current;
        if (!r) return resolve(null);
        if (r.state === 'paused') pausedTotal.current += performance.now() - pausedAt.current;
        const duration = (performance.now() - started.current - pausedTotal.current) / 1000;
        r.onstop = () => {
          mic.current?.getTracks().forEach((t) => t.stop());
          mic.current = null;
          rec.current = null;
          setRecording(false);
          setPaused(false);
          setClips(0);
          if (duration < 0.5) return resolve(null);
          resolve({ blob: new Blob(chunks.current, { type: (r.mimeType || 'video/webm').split(';')[0] }), duration });
        };
        r.stop();
      }),
    [],
  );

  /** Multi-clip: pause between holds, resume on the next hold (one video, several clips). */
  const pause = useCallback(() => {
    const r = rec.current;
    if (!r || r.state !== 'recording' || typeof r.pause !== 'function') return false;
    r.pause();
    pausedAt.current = performance.now();
    setPaused(true);
    return true;
  }, []);
  const resume = useCallback(() => {
    const r = rec.current;
    if (!r || r.state !== 'paused') return false;
    pausedTotal.current += performance.now() - pausedAt.current;
    r.resume();
    setPaused(false);
    setClips((n) => n + 1);
    return true;
  }, []);

  return {
    recording,
    paused,
    clips,
    start,
    stop,
    pause,
    resume,
    elapsed: () => (rec.current ? (((rec.current.state === 'paused' ? pausedAt.current : performance.now()) - started.current - pausedTotal.current) / 1000) : 0),
  };
}
