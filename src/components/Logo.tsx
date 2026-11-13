import { brand } from '@/config/brand';
import { cn } from '@/lib/cn';

/** Original SUMANOVA mark: a four-point "nova" star inside an aurora orb. */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="lm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.55" stopColor="#2dd4bf" />
          <stop offset="1" stopColor="#fb7185" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="20" fill="url(#lm-g)" />
      <path
        d="M32 12c1.6 9.6 5.4 16.4 20 20-14.6 3.6-18.4 10.4-20 20-1.6-9.6-5.4-16.4-20-20 14.6-3.6 18.4-10.4 20-20z"
        fill="#fff"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-xl font-semibold tracking-[0.18em] text-ink', className)}>
      {brand.name}
    </span>
  );
}
