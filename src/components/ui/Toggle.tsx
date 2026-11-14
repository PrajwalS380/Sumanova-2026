import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        haptic(6);
        onChange(!checked);
      }}
      className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left disabled:opacity-50"
    >
      <span>
        <span className="block text-[15px] font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-ink-mute">{description}</span>}
      </span>
      <span
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300',
          checked ? 'bg-ember-gradient text-noir' : 'bg-white/[0.08] ring-1 ring-inset ring-white/10',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 34 }}
          className={cn('absolute top-1 h-5 w-5 rounded-full bg-ember-cream shadow', checked ? 'right-1' : 'left-1')}
        />
      </span>
    </button>
  );
}
