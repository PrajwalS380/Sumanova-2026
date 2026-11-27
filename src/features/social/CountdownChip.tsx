import { useEffect, useState } from 'react';
import { Hourglass } from 'lucide-react';

export interface Countdown { title: string; at: string }

export function countdownLeft(at: string, now = Date.now()) {
  const ms = new Date(at).getTime() - now;
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return 'It’s here! 🎉';
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function isCountdown(v: unknown): v is Countdown {
  const c = v as Countdown | null;
  return !!c && typeof c.title === 'string' && typeof c.at === 'string' && !Number.isNaN(new Date(c.at).getTime());
}

/** Live countdown sticker shown on stories and snaps (stored in media_meta.countdown). */
export function CountdownChip({ c, className }: { c: Countdown; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className={className ?? 'pointer-events-none absolute inset-x-0 top-[22%] z-20 flex justify-center'}>
      <div className="flex -rotate-2 items-center gap-3 rounded-[22px] bg-white px-4 py-3 text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)]">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#FF4F9A] text-white"><Hourglass className="h-5 w-5" /></span>
        <span>
          <span className="block max-w-[14rem] truncate text-sm font-extrabold">{c.title}</span>
          <span className="block font-display text-xl tabular-nums">{countdownLeft(c.at)}</span>
        </span>
      </div>
    </div>
  );
}
