import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { NovaEmoji } from '@/components/emoji/NovaEmoji';
import { LENS_CATEGORIES, searchLenses } from './allLenses';
import type { LensCategory } from './frameLenses';
import { cn } from '@/lib/cn';

/** Full lens browser: search + categories, all lenses are ours and run on the phone. */
export function LensBrowser({ current, onPick, onClose }: { current: string | null; onPick: (id: string | null) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<LensCategory | 'All'>('All');
  const list = useMemo(() => searchLenses(q, cat), [q, cat]);
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 420, damping: 40 }}
      className="absolute inset-x-0 bottom-0 z-40 flex max-h-[72%] flex-col rounded-t-[28px] bg-[#111111] pb-[max(1rem,var(--safe-bottom))] text-white"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-2xl bg-white/10 px-3">
          <Search className="h-4 w-4 text-white/60" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lenses — blur, hair, puppy…" aria-label="Search lenses" className="h-full flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-white/40" />
        </label>
        <button onClick={onClose} aria-label="Close lenses" className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10"><X className="h-5 w-5" /></button>
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 pb-3">
        {(['All', ...LENS_CATEGORIES] as const).map((c) => (
          <button key={c} onClick={() => setCat(c)} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-extrabold', cat === c ? 'bg-white text-ink' : 'bg-white/10')}>{c}</button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2 overflow-y-auto px-4 pb-2">
        <button onClick={() => onPick(null)} className={cn('flex flex-col items-center gap-1 rounded-2xl p-2 text-[11px] font-bold', !current ? 'bg-white/20 ring-2 ring-white' : 'bg-white/[0.06]')}>
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-xs">Off</span>No lens
        </button>
        {list.map((l) => (
          <button key={l.id} onClick={() => onPick(l.id)} className={cn('flex flex-col items-center gap-1 rounded-2xl p-2 text-center text-[11px] font-bold leading-tight', current === l.id ? 'bg-white/20 ring-2 ring-white' : 'bg-white/[0.06]')}>
            <NovaEmoji id={l.icon} size={48} />
            {l.name}
          </button>
        ))}
        {list.length === 0 && <p className="col-span-4 py-8 text-center text-sm text-white/60">No lenses match “{q}”.</p>}
      </div>
    </motion.div>
  );
}
