import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

export const OTP_LENGTH = 6;

/**
 * One-time-code input: six glowing cells backed by a single real <input> so
 * Android/iOS SMS-and-email autofill ("one-time-code") and paste both work.
 */
export function OtpField({ value, onChange, onComplete, error, disabled }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; error?: string; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div>
      <label className="relative block cursor-text" onClick={() => ref.current?.focus()}>
        <span className="sr-only">Verification code</span>
        <input
          ref={ref}
          value={value}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={OTP_LENGTH}
          aria-invalid={Boolean(error) || undefined}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH);
            onChange(v);
            if (v.length === OTP_LENGTH) onComplete?.(v);
          }}
          className="absolute inset-0 h-full w-full opacity-0"
        />
        <span className="flex justify-between gap-2" aria-hidden>
          {Array.from({ length: OTP_LENGTH }).map((_, i) => {
            const active = i === value.length && !disabled;
            return (
              <span
                key={i}
                className={cn(
                  'grid h-14 flex-1 place-items-center rounded-2xl bg-white/[0.05] font-display text-2xl ring-1 transition-all duration-200',
                  error ? 'ring-ember-rose/60' : active ? 'ring-2 ring-ember-amber shadow-[0_0_20px_rgba(255,181,71,0.35)]' : value[i] ? 'ring-white/25' : 'ring-white/10',
                )}
              >
                {value[i] ?? (active ? <span className="h-6 w-0.5 animate-pulse rounded bg-ember-amber" /> : '')}
              </span>
            );
          })}
        </span>
      </label>
      {error && <p role="alert" className="mt-2 px-1 text-sm text-ember-rose">{error}</p>}
    </div>
  );
}
