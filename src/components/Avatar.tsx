import { memo } from 'react';
import { AURA, type AuraColor } from '@/lib/types';
import { cn } from '@/lib/cn';

interface AvatarProps {
  name: string;
  /** face image (the person's rendered 3D avatar, or an uploaded photo) */
  url?: string | null;
  /** tint behind the face */
  aura?: AuraColor;
  size?: number;
  /** accent ring = there's something new to see (e.g. an unseen story) */
  ring?: boolean;
  className?: string;
}

/** Round avatar face on a soft tint; optional accent ring; initials when there's no picture yet. */
export const Avatar = memo(function Avatar({ name, url, aura = 'gold', size = 44, ring = false, className }: AvatarProps) {
  const a = AURA[aura];
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const pad = ring ? Math.max(2, Math.round(size * 0.055)) : 0;
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center rounded-full', ring && 'bg-ember-flame', className)}
      style={{ width: size, height: size, padding: pad }}
    >
      <span
        className={cn('grid h-full w-full place-items-center overflow-hidden rounded-full', ring && 'ring-2 ring-white')}
        style={{ background: `${a.to}33` }}
      >
        {url ? (
          <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="font-display" style={{ fontSize: size * 0.4, color: a.from }}>
            {initials || '✦'}
          </span>
        )}
      </span>
    </span>
  );
});
