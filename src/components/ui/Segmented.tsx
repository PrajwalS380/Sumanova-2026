import { motion } from 'framer-motion';
import { useId } from 'react';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}

export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
  const id = useId();
  return (
    <div className="px-4 py-3">
      <p className="eyebrow mb-2">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex rounded-2xl bg-ink/[0.05] p-1">
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            onClick={() => {
              haptic(5);
              onChange(o.value);
            }}
            className={cn(
              'relative flex-1 rounded-xl py-2 text-sm font-medium transition-colors',
              value === o.value ? 'text-noir' : 'text-ink-mute hover:text-ink',
            )}
          >
            {value === o.value && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-xl bg-ember-cream"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
