import { memo } from 'react';
import { cn } from '@/lib/cn';

/**
 * Animated aurora backdrop. Uses only transform animations on pre-blurred
 * radial gradients (no live blur filters) so it stays at 60fps on Android.
 */
export const AuroraBackground = memo(function AuroraBackground({ className, intense = false }: { className?: string; intense?: boolean }) {
  return (
    <div aria-hidden className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-night', className)}>
      <div
        className="absolute -left-1/4 -top-1/4 h-[80vmax] w-[80vmax] animate-aurora-drift will-change-transform"
        style={{ background: 'radial-gradient(closest-side, rgba(139,92,246,0.42), rgba(139,92,246,0) 70%)', opacity: intense ? 1 : 0.8 }}
      />
      <div
        className="absolute -right-1/4 top-1/4 h-[70vmax] w-[70vmax] animate-aurora-drift-slow will-change-transform"
        style={{ background: 'radial-gradient(closest-side, rgba(45,212,191,0.30), rgba(45,212,191,0) 70%)', opacity: intense ? 1 : 0.75 }}
      />
      <div
        className="absolute -bottom-1/3 left-1/4 h-[70vmax] w-[70vmax] animate-aurora-drift will-change-transform"
        style={{ background: 'radial-gradient(closest-side, rgba(251,113,133,0.24), rgba(251,113,133,0) 70%)', animationDelay: '-9s' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(7,8,20,0.75)_100%)]" />
    </div>
  );
});
