import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';

const button = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[transform,background-color,opacity,box-shadow,filter] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-ember-gradient text-white hover:brightness-110',
        glass: 'bg-white text-ink hover:bg-white/80',
        cream: 'bg-ember-cream text-white hover:brightness-110',
        ghost: 'text-ink-soft hover:bg-ink/5 hover:text-ink',
        danger: 'bg-[#FFE4E1] text-[#B42318] hover:bg-[#FFD6D1]',
      },
      size: {
        sm: 'h-9 rounded-xl px-3 text-sm',
        md: 'h-12 rounded-2xl px-5 text-[15px] font-extrabold',
        lg: 'h-14 rounded-2xl px-6 text-base font-extrabold',
        icon: 'h-11 w-11 rounded-2xl',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, loading, children, onClick, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={(e) => {
        haptic(6);
        onClick?.(e);
      }}
      {...props}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : children}
    </button>
  ),
);
Button.displayName = 'Button';
