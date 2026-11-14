import { Globe2, Lock, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Audience } from '@/lib/social/api';

const OPTS: { v: Exclude<Audience, 'group' | 'custom'>; label: string; desc: string; icon: typeof Users }[] = [
  { v: 'friends', label: 'Friends', desc: 'Only your friends', icon: Users },
  { v: 'everyone', label: 'Public', desc: 'Anyone on SUMANOVA', icon: Globe2 },
];

export function AudiencePicker({ value, onChange }: { value: Audience; onChange: (a: Audience) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {OPTS.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)} aria-pressed={value === o.v} className={cn('flex items-center gap-2 rounded-2xl p-3 text-left transition-colors', value === o.v ? 'bg-ink/15 ring-2 ring-ink/70' : 'bg-ink/5 ring-1 ring-ink/10')}>
          <o.icon className="h-5 w-5 shrink-0" />
          <span>
            <span className="block text-sm font-semibold">{o.label}</span>
            <span className="block text-[11px] text-ink-mute">{o.desc}</span>
          </span>
        </button>
      ))}
      <p className="col-span-2 flex items-center gap-1.5 px-1 text-[11px] text-ink-faint"><Lock className="h-3 w-3" /> Stories disappear after 24 hours unless you add them to a highlight.</p>
    </div>
  );
}
