import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
  trailing?: ReactNode;
}

/** Floating-label input on a glass surface. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(
  ({ label, error, hint, trailing, className, type = 'text', ...props }, ref) => {
    const id = useId();
    const [show, setShow] = useState(false);
    const isPassword = type === 'password';
    return (
      <div className={cn('w-full', className)}>
        <div
          className={cn(
            'group relative rounded-2xl bg-white/[0.04] ring-1 ring-white/10 transition-shadow focus-within:ring-2 focus-within:ring-ember-amber/70',
            error && 'ring-ember-rose/60 focus-within:ring-ember-rose/80',
          )}
        >
          <input
            ref={ref}
            id={id}
            type={isPassword && show ? 'text' : type}
            placeholder=" "
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error || hint ? `${id}-msg` : undefined}
            className="peer block h-14 w-full rounded-2xl bg-transparent px-4 pb-1.5 pt-5 text-[16px] text-ink outline-none placeholder:text-transparent [color-scheme:dark]"
            {...props}
          />
          <label
            htmlFor={id}
            className="pointer-events-none absolute left-4 top-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-mute transition-all peer-placeholder-shown:top-[1.05rem] peer-placeholder-shown:text-[15px] peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-ember-amber"
          >
            {label}
          </label>
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {trailing}
            {isPassword && (
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="rounded-full p-1.5 text-ink-mute hover:text-ink"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
        {(error || hint) && (
          <p id={`${id}-msg`} className={cn('mt-1.5 px-1 text-xs', error ? 'text-ember-rose' : 'text-ink-mute')}>
            {error || hint}
          </p>
        )}
      </div>
    );
  },
);
Field.displayName = 'Field';
