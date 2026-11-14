import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { EmberBackground } from '@/components/EmberBackground';
import { LogoMark, Wordmark } from '@/components/Logo';

/** Editorial sign-in layout: serif headline over warm ember light, matte card below. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-col px-5 pb-10 pt-safe">
      <EmberBackground />
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="mx-auto flex w-full max-w-sm items-center gap-2.5 pt-4"
      >
        <LogoMark size={34} />
        <Wordmark className="text-[22px]" />
      </motion.header>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease: [0.2, 0.8, 0.2, 1] }}
          className="font-display text-[44px] font-light leading-[1.02] tracking-tight text-ink"
        >
          Every moment,
          <br />
          <span className="italic text-ember">glowing.</span>
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 30, delay: 0.12 }}
          className="glass mt-8 rounded-[28px] p-6"
        >
          <h1 className="font-display text-[24px] font-medium">{title}</h1>
          {subtitle && <p className="mt-1 text-sm leading-relaxed text-ink-mute">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </motion.div>
      </div>
    </div>
  );
}
