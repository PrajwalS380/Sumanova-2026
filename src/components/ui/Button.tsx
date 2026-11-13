import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';

const button = cva(
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[transform,background-color,opacity,box-shadow] duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        aurora: 'bg-aurora-gradient bg-[length:200%_100%] bg-left text-white shadow-glow hover:bg-right',
        glass: 'glass text-ink hover:bg-white/10',
        ghost: 'text-ink-soft hover:bg-white/5 hover:text-ink',
        danger: 'bg-aurora-coral/15 text-aurora-coral ring-1 ring-aurora-coral/30 hover:bg-aurora-coral/25',
      },
      size: {
        sm: 'h-9 rounded-xl px-3 text-sm',
        md: 'h-12 rounded-2xl px-5 text-[15px]',
        lg: 'h-14 rounded-[1.25rem] px-6 text-base',
        icon: 'h-11 w-11 rounded-full',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'aurora', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, loading, children, onClick, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size, block }), 'bg-[position:0%_50%] hover:bg-[position:100%_50%]', className)}
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
