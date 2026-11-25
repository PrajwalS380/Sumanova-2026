import { memo } from 'react';
import { cn } from '@/lib/cn';
import { novaEmojiUrl, type NovaEmojiId } from './novaEmoji';

/** One of SUMANOVA's own emoji (see novaEmoji.ts). Decorative unless a label is given. */
export const NovaEmoji = memo(function NovaEmoji({ id, size = 20, label, className }: { id: NovaEmojiId; size?: number; label?: string; className?: string }) {
  return (
    <img
      src={novaEmojiUrl(id)}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      title={label}
      draggable={false}
      className={cn('inline-block shrink-0 select-none align-[-0.2em]', className)}
    />
  );
});
