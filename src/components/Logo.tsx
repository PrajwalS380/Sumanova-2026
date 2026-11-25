import { cn } from '@/lib/cn';

/**
 * SUMANOVA mark: "Nova", an original four-point star mascot (white, bold black
 * outline, friendly face) on a hot-pink tile. One flat colour, readable at 16px.
 * `bare` draws just the mascot (for coloured backgrounds).
 */
export function LogoMark({ size = 40, bare = false, className }: { size?: number; bare?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      {!bare && <rect x="2" y="2" width="60" height="60" rx="18" fill="#FF4F9A" />}
      <g transform="rotate(-8 32 32)">
        <path d="M32 7C37.8 20 44 26.2 57 32 44 37.8 37.8 44 32 57 26.2 44 20 37.8 7 32 20 26.2 26.2 20 32 7Z" fill="#FFFFFF" stroke="#111111" strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx="27.3" cy="30.4" rx="2.4" ry="3.4" fill="#111111" />
        <ellipse cx="36.7" cy="30.4" rx="2.4" ry="3.4" fill="#111111" />
        <path d="M28.4 36.6Q32 40.2 35.6 36.6" fill="none" stroke="#111111" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Wordmark: SUMANOVA in heavy, wide-tracked Inter. */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn('font-display text-2xl uppercase tracking-[0.08em] text-ink', className)}>SUMANOVA</span>;
}
