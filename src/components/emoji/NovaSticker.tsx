import { memo } from 'react';
import { cn } from '@/lib/cn';
import { NovaEmoji } from './NovaEmoji';
import type { NovaSticker as Sticker } from './novaEmoji';

/** A Nova sticker, optionally animated (our own "GIF" pack) and captioned. */
export const NovaSticker = memo(function NovaSticker({ s, size = 104, className }: { s: Sticker; size?: number; className?: string }) {
  return (
    <span className={cn('relative inline-flex flex-col items-center', className)} role="img" aria-label={s.caption ? `Sticker: ${s.caption}` : 'Sticker'}>
      <span className={s.motion ? `nv-${s.motion}` : undefined} style={{ display: 'inline-block' }}>
        <NovaEmoji id={s.id} size={size} />
      </span>
      {s.caption && <span className="nv-caption -mt-3" style={{ fontSize: Math.max(10, size * 0.15) }}>{s.caption}</span>}
    </span>
  );
});
