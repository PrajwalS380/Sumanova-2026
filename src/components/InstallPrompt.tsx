import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { LogoMark } from './Logo';
import { brand } from '@/config/brand';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'sumanova:install-dismissed';

/** Android/Chrome "Add to home screen" card, shown once until dismissed. */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      /* storage blocked */
    }
    if (dismissed) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setEvt(null);
  };

  return (
    <AnimatePresence>
      {evt && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed inset-x-0 bottom-28 z-50 flex justify-center px-4"
        >
          <div className="glass-strong flex w-full max-w-sm items-center gap-3 rounded-3xl p-3 pl-4">
            <LogoMark size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Install {brand.name}</p>
              <p className="text-xs text-ink-mute">Full screen, faster, right on your home screen.</p>
            </div>
            <button
              className="flex h-10 items-center gap-1.5 rounded-2xl bg-aurora-gradient px-3 text-sm font-semibold"
              onClick={async () => {
                await evt.prompt();
                await evt.userChoice;
                setEvt(null);
              }}
            >
              <Download className="h-4 w-4" /> Install
            </button>
            <button className="p-1.5 text-ink-mute" onClick={dismiss} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
