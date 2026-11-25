import { memo } from 'react';
import { cn } from '@/lib/cn';

/**
 * Bento backdrop: a flat, soft-grey canvas. Content sits on rounded white /
 * black / colour tiles, so the page itself stays calm (and costs nothing to paint).
 */
export const AppBackground = memo(function AppBackground({ className }: { className?: string }) {
  return <div aria-hidden className={cn('pointer-events-none fixed inset-0 -z-10 bg-noir', className)} />;
});
