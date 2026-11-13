import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AuroraBackground } from '@/components/AuroraBackground';
import { LogoMark, Wordmark } from '@/components/Logo';
import { brand } from '@/config/brand';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center px-5 pb-10 pt-safe">
      <AuroraBackground intense />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.05 }}
            className="drop-shadow-[0_10px_40px_rgba(139,92,246,0.55)]"
          >
            <LogoMark size={64} />
          </motion.div>
          <Wordmark className="mt-4" />
          <p className="mt-1 text-xs tracking-wide text-ink-mute">{brand.tagline}</p>
        </div>
        <div className="glass rounded-5xl p-6">
          <h1 className="font-display text-[22px] font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-mute">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </motion.div>
    </div>
  );
}
