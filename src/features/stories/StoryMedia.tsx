import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { privateUrl } from '@/lib/storageUrl';
import { filterById } from '@/lib/snaps/filters';
import type { Story } from '@/lib/social/api';
import { bg } from './backgrounds';

/** Renders one story (text / photo / video). Reports when ready and, for videos, its duration. */
export function StoryMedia({ story, paused, onReady, onDuration, onEnded }: { story: Story; paused: boolean; onReady: () => void; onDuration?: (s: number) => void; onEnded?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setUrl(null);
    setOverlay(null);
    setFailed(false);
    if (story.kind === 'text') {
      onReady();
      return;
    }
    let alive = true;
    Promise.all([privateUrl('stories', story.media_path!), story.overlay_path ? privateUrl('stories', story.overlay_path) : Promise.resolve(null)])
      .then(([u, o]) => {
        if (!alive) return;
        setUrl(u);
        setOverlay(o);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (paused) v.pause();
    else void v.play().catch(() => undefined);
  }, [paused, url]);

  if (story.kind === 'text') {
    return (
      <div className="grid h-full w-full place-items-center px-8" style={{ background: bg(story.background) }}>
        <p className="whitespace-pre-wrap text-center font-display text-[clamp(1.6rem,7vw,2.6rem)] font-medium leading-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,.35)]">{story.text_body}</p>
      </div>
    );
  }
  if (failed) return <div className="grid h-full place-items-center text-sm text-white/70">This story isn’t available anymore.</div>;
  if (!url) return <div className="grid h-full place-items-center"><Loader2 className="h-7 w-7 animate-spin text-white/60" /></div>;
  const f = filterById(story.media_meta?.filter);
  return (
    <div className="relative h-full w-full bg-black">
      {story.kind === 'image' ? (
        <img src={url} alt="" draggable={false} onLoad={onReady} className="h-full w-full object-contain" />
      ) : (
        <video
          ref={video}
          src={url}
          playsInline
          autoPlay
          onLoadedMetadata={(e) => onDuration?.(e.currentTarget.duration)}
          onPlaying={onReady}
          onEnded={onEnded}
          className="h-full w-full object-contain"
          style={{ filter: f.css }}
        />
      )}
      {story.kind === 'video' && f.tint && <div className="pointer-events-none absolute inset-0" style={{ background: f.tint }} />}
      {overlay && <img src={overlay} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-contain" />}
    </div>
  );
}
