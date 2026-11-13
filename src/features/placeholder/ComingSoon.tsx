import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { ScreenHeader } from '@/components/ScreenHeader';

/**
 * Honest empty state for sections that ship in later phases. No fake buttons —
 * it only explains what's coming.
 */
export function ComingSoon({ title, icon: Icon, headline, points, phase }: { title: string; icon: LucideIcon; headline: string; points: string[]; phase: string }) {
  return (
    <div className="pb-36">
      <ScreenHeader title={title} />
      <div className="mx-auto flex max-w-sm flex-col items-center px-6 pt-8 text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 18 }}
          className="relative grid h-24 w-24 place-items-center"
        >
          <span className="absolute inset-0 animate-spin-slow rounded-[2rem] ring-aurora opacity-80 [animation-duration:12s]" />
          <span className="absolute inset-[3px] rounded-[1.85rem] bg-night-800" />
          <Icon className="relative h-10 w-10 text-aurora-iris" />
        </motion.div>
        <h2 className="mt-6 font-display text-xl font-semibold">{headline}</h2>
        <span className="mt-2 rounded-full bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-aurora-mint ring-1 ring-white/10">{phase}</span>
        <ul className="glass mt-6 w-full space-y-2.5 rounded-3xl p-5 text-left text-sm text-ink-soft">
          {points.map((p, i) => (
            <motion.li key={p} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }} className="flex gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-aurora-gradient" />
              {p}
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  );
}
