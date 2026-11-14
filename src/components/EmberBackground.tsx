import { memo } from 'react';
import { cn } from '@/lib/cn';

/**
 * Warm "ember light" backdrop: two pre-blurred radial glows that drift with
 * transform-only animation, a vignette and a static film-grain layer.
 * No live blur filters, so it stays smooth on mid-range Android phones.
 */
export const EmberBackground = memo(function EmberBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('grain pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-noir', className)}>
      <div
        className="absolute -left-[30%] -top-[35%] h-[85vmax] w-[85vmax] animate-ember-drift will-change-transform"
        style={{ background: 'radial-gradient(closest-side, rgba(255,150,70,0.30), rgba(255,122,61,0.08) 55%, rgba(255,122,61,0) 75%)' }}
      />
      <div
        className="absolute -bottom-[40%] -right-[30%] h-[80vmax] w-[80vmax] animate-ember-drift-slow will-change-transform"
        style={{ background: 'radial-gradient(closest-side, rgba(229,72,77,0.20), rgba(192,132,180,0.06) 55%, rgba(192,132,180,0) 75%)' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,transparent_35%,rgba(8,7,6,0.85)_100%)]" />
    </div>
  );
});
