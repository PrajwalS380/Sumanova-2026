import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function NetworkBanner() {
  const online = useOnline();
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-0 top-0 z-[90] flex justify-center pt-safe"
          role="alert"
        >
          <div className="flex items-center gap-2 rounded-full bg-aurora-coral/90 px-4 py-1.5 text-xs font-semibold text-white shadow-lg">
            <WifiOff className="h-3.5 w-3.5" /> You’re offline — we’ll reconnect automatically
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
