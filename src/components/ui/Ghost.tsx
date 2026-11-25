import { memo, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface GhostProps {
  /** the row's avatar picture — drawn big and faint */
  url?: string | null;
  /** or an icon / glyph when the row has no avatar (cake, pin, flame …) */
  children?: ReactNode;
  size?: number;
  /** 0–1; default 0.1 for pictures, 0.06 for icons */
  opacity?: number;
  className?: string;
}

/**
 * Bento "ghost" layer (from style option 10): a large, faint copy of a row's
 * avatar or icon sitting behind its content. The host needs
 * `relative isolate overflow-hidden` (see `GHOST_HOST`) so the ghost stays
 * behind the text and is clipped to the row. Decorative only.
 */
export const Ghost = memo(function Ghost({ url, children, size = 110, opacity, className }: GhostProps) {
  if (!url && !children) return null;
  return (
    <span
      aria-hidden
      className={cn('pointer-events-none absolute -top-7 right-8 -z-10 grid select-none place-items-center', className)}
      style={{ width: size, height: size, opacity: opacity ?? (url ? 0.1 : 0.06) }}
    >
      {url ? <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full rounded-full object-cover" /> : children}
    </span>
  );
});

/** Classes a ghost's host element needs. */
export const GHOST_HOST = 'relative isolate overflow-hidden';
