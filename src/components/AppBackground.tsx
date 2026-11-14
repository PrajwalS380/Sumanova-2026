import { memo } from 'react';
import { cn } from '@/lib/cn';

/**
 * Pearl backdrop: three soft pastel glows (blue, pink, mint) that drift with
 * transform-only animation over a milky base. Pre-blurred radial gradients,
 * no live blur filters, so it stays smooth on mid-range phones.
 */
export const AppBackground = memo(function AppBackground({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-noir', className)}>
      <div className="absolute -left-[30%] -top-[30%] h-[85vmax] w-[85vmax] animate-ember-drift will-change-transform" style={{ background: 'radial-gradient(closest-side, rgba(159,184,255,0.55), rgba(159,184,255,0) 72%)' }} />
      <div className="absolute -right-[35%] top-[15%] h-[80vmax] w-[80vmax] animate-ember-drift-slow will-change-transform" style={{ background: 'radial-gradient(closest-side, rgba(255,179,217,0.45), rgba(255,179,217,0) 72%)' }} />
      <div className="absolute -bottom-[40%] left-[5%] h-[80vmax] w-[80vmax] animate-ember-drift will-change-transform" style={{ background: 'radial-gradient(closest-side, rgba(168,240,220,0.45), rgba(168,240,220,0) 72%)', animationDelay: '-11s' }} />
    </div>
  );
});
