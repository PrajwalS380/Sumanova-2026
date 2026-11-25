import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AppBackground } from '@/components/AppBackground';
import { LogoMark, Wordmark } from '@/components/Logo';

/** Sign-in / sign-up layout: the SUMANOVA mark and name, then a single white card. No slogans. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-col px-5 pb-10 pt-safe">
      <AppBackground />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex flex-col items-center gap-3"
        >
          <LogoMark size={84} />
          <Wordmark className="text-[26px]" />
        </motion.header>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 240, damping: 30, delay: 0.12 }}
          className="glass mt-7 rounded-tile p-6"
        >
          <h1 className="font-display text-[24px]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm leading-relaxed text-ink-mute">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </motion.div>
      </div>
    </div>
  );
}
