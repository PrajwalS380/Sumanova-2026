import { useEffect, useState } from 'react';
import { Navigation } from 'lucide-react';
import { isLive, liveShare, tileFor } from '@/lib/chat/extras';
import { isNative } from '@/lib/platform';
import { useToast } from '@/providers/ToastProvider';
import type { MediaMeta } from '@/lib/chat/types';

const Z = 16;
const W = 260, H = 150;

function ago(iso?: string) {
  if (!iso) return 'just now';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

/** Location in chat: a small OpenStreetMap view with a pin. Live shares move and show their age. */
export function LocationCard({ messageId, meta, mine, local, name, createdAt }: { messageId: string; meta: MediaMeta; mine: boolean; local: boolean; name: string; createdAt: string }) {
  const toast = useToast();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const lat = meta.lat ?? 0, lng = meta.lng ?? 0;
  const live = isLive(meta);
  const wasLive = !!meta.live_until && !live;
  const { x, y } = tileFor(lat, lng, Z);
  // Tiles around the point, positioned so the point sits in the card's centre.
  const tx = Math.floor(x), ty = Math.floor(y);
  const ox = W / 2 - (x - tx) * 256, oy = H / 2 - (y - ty) * 256;
  const tiles: { dx: number; dy: number }[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) tiles.push({ dx, dy });
  const open = isNative ? `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})` : `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;

  return (
    <div className="w-[260px] max-w-full overflow-hidden rounded-[22px] bg-white text-ink">
      <a href={open} target="_blank" rel="noreferrer" className="relative block overflow-hidden bg-[#E6E6EA]" style={{ height: H }} aria-label={`Open ${name}'s location in maps`}>
        {tiles.map((t) => (
          <img key={`${t.dx},${t.dy}`} src={`https://tile.openstreetmap.org/${Z}/${tx + t.dx}/${ty + t.dy}.png`} alt="" loading="lazy" draggable={false} onError={(e) => (e.currentTarget.style.visibility = 'hidden')} className="absolute h-[256px] w-[256px] max-w-none" style={{ left: ox + t.dx * 256, top: oy + t.dy * 256 }} />
        ))}
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
          {live && <span className="absolute left-1/2 top-[70%] h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-ember-rose/40" />}
          <svg width="34" height="42" viewBox="0 0 34 42" aria-hidden className="relative drop-shadow-md">
            <path d="M17 41 C17 41 3 26 3 16 A14 14 0 0 1 31 16 C31 26 17 41 17 41Z" fill={live ? '#FF4F9A' : '#111'} stroke="#fff" strokeWidth="3" />
            <circle cx="17" cy="16" r="5.5" fill="#fff" />
          </svg>
        </span>
        <span className="absolute bottom-1 right-1.5 rounded bg-white/80 px-1 text-[9px] text-ink-mute">© OpenStreetMap</span>
      </a>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold">{live ? 'Live location' : wasLive ? 'Live location ended' : 'Location'}</span>
          <span className="block text-[11px] font-semibold text-ink-mute">
            {local ? 'Sending…' : live ? `Updated ${ago(meta.updated_at)} · until ${new Date(meta.live_until!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : wasLive ? `Last updated ${ago(meta.updated_at ?? createdAt)}` : `Shared ${ago(createdAt)}`}
          </span>
        </span>
        {mine && live && !local ? (
          <button onClick={() => void liveShare.stop(messageId).catch((e) => toast((e as Error).message, 'error'))} className="rounded-xl bg-ink px-3 py-2 text-xs font-extrabold text-white active:scale-95">Stop</button>
        ) : (
          <a href={open} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-xl bg-[#F1F1F4]" aria-label="Directions"><Navigation className="h-4 w-4" /></a>
        )}
      </div>
    </div>
  );
}
