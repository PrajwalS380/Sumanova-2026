import { memo, useEffect, useRef, useState } from 'react';
import { ImageOff, Pause, Play } from 'lucide-react';
import { signedUrl } from '@/lib/chat/media';
import { formatDuration } from '@/lib/chat/time';
import type { MediaMeta } from '@/lib/chat/types';
import { cn } from '@/lib/cn';

/** Resolve a private media path to a short-lived URL (or use the local blob while uploading). */
export function useMediaUrl(path: string | null, localUrl?: string) {
  const [url, setUrl] = useState<string | null>(localUrl ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (localUrl) return setUrl(localUrl);
    if (!path) return;
    let alive = true;
    signedUrl(path)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [path, localUrl]);
  return { url, failed };
}

function aspect(meta: MediaMeta) {
  if (!meta.width || !meta.height) return 4 / 5;
  return Math.min(1.6, Math.max(0.56, meta.width / meta.height));
}

export const ImageView = memo(function ImageView({ path, localUrl, meta, onOpen }: { path: string | null; localUrl?: string; meta: MediaMeta; onOpen?: (url: string) => void }) {
  const { url, failed } = useMediaUrl(path, localUrl);
  const [loaded, setLoaded] = useState(false);
  return (
    <button type="button" onClick={() => url && onOpen?.(url)} className="relative block w-[min(64vw,260px)] overflow-hidden rounded-[1.25rem] bg-white/5" style={{ aspectRatio: aspect(meta) }}>
      {failed ? (
        <span className="absolute inset-0 grid place-items-center text-ink-mute"><ImageOff className="h-6 w-6" /></span>
      ) : (
        <>
          {!loaded && <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)] bg-[length:200%_100%]" />}
          {url && <img src={url} alt="Photo" loading="lazy" decoding="async" onLoad={() => setLoaded(true)} className={cn('h-full w-full object-cover transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')} />}
        </>
      )}
    </button>
  );
});

export const VideoView = memo(function VideoView({ path, localUrl, meta }: { path: string | null; localUrl?: string; meta: MediaMeta }) {
  const { url, failed } = useMediaUrl(path, localUrl);
  return (
    <div className="relative w-[min(64vw,260px)] overflow-hidden rounded-[1.25rem] bg-black" style={{ aspectRatio: aspect(meta) }}>
      {failed ? (
        <span className="absolute inset-0 grid place-items-center text-ink-mute"><ImageOff className="h-6 w-6" /></span>
      ) : url ? (
        <video src={url} controls playsInline preload="metadata" className="h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 animate-pulse bg-white/5" />
      )}
    </div>
  );
});

/** Voice note with waveform scrubbing. Only one plays at a time. */
let current: HTMLAudioElement | null = null;
export const VoiceView = memo(function VoiceView({ path, localUrl, meta, mine }: { path: string | null; localUrl?: string; meta: MediaMeta; mine: boolean }) {
  const { url } = useMediaUrl(path, localUrl);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const bars = meta.waveform?.length ? meta.waveform : Array(32).fill(0.3);
  const duration = meta.duration ?? 0;

  useEffect(() => () => audio.current?.pause(), []);

  function toggle() {
    if (!url) return;
    if (!audio.current) {
      const a = new Audio(url);
      a.ontimeupdate = () => setProgress(a.duration ? a.currentTime / a.duration : 0);
      a.onended = () => {
        setPlaying(false);
        setProgress(0);
      };
      a.onpause = () => setPlaying(false);
      a.onplay = () => setPlaying(true);
      audio.current = a;
    }
    if (playing) audio.current.pause();
    else {
      if (current && current !== audio.current) current.pause();
      current = audio.current;
      void audio.current.play();
    }
  }

  return (
    <div className="flex w-[min(64vw,240px)] items-center gap-2.5 py-1">
      <button onClick={toggle} disabled={!url} aria-label={playing ? 'Pause' : 'Play voice note'} className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full', mine ? 'bg-white/25' : 'bg-white/10')}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="flex h-8 flex-1 items-center gap-[2px]" aria-hidden>
        {bars.map((v, i) => (
          <span key={i} className={cn('w-[3px] rounded-full transition-colors', i / bars.length <= progress ? 'bg-white' : mine ? 'bg-white/45' : 'bg-white/25')} style={{ height: `${Math.max(12, v * 100)}%` }} />
        ))}
      </div>
      <span className="w-9 text-right text-[11px] tabular-nums opacity-80">{formatDuration(playing || progress ? duration * progress : duration)}</span>
    </div>
  );
});
