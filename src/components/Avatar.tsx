import { memo } from 'react';
import { AURA, type AuraColor } from '@/lib/types';
import { cn } from '@/lib/cn';

interface AvatarProps {
  name: string;
  url?: string | null;
  aura?: AuraColor;
  size?: number;
  ring?: boolean;
  className?: string;
}

/** Profile photo inside a gradient "aura" ring; falls back to initials. */
export const Avatar = memo(function Avatar({ name, url, aura = 'gold', size = 44, ring = true, className }: AvatarProps) {
  const a = AURA[aura];
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className={cn('relative inline-grid shrink-0 place-items-center rounded-full', className)}
      style={{
        width: size,
        height: size,
        background: ring ? `conic-gradient(from 210deg, ${a.from}, ${a.to}, ${a.from})` : undefined,
        padding: ring ? Math.max(2, size * 0.05) : 0,
      }}
    >
      <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-noir-700 ring-2 ring-noir">
        {url ? (
          <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <span className="font-display font-medium italic" style={{ fontSize: size * 0.38, color: a.to }}>
            {initials || '✦'}
          </span>
        )}
      </span>
    </span>
  );
});
