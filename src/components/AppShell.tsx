import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { NovaDock } from './NovaDock';
import { AuroraBackground } from './AuroraBackground';
import { InstallPrompt } from './InstallPrompt';
import { navIndex } from './nav';
import { useRef } from 'react';
import { ScreenLoader } from './ScreenLoader';

/** Signed-in layout: aurora backdrop, animated page transitions, floating dock. */
export function AppShell() {
  const location = useLocation();
  const idx = navIndex(location.pathname);
  const prev = useRef(idx);
  const direction = idx === -1 || prev.current === -1 ? 0 : Math.sign(idx - prev.current);
  prev.current = idx;
  const onCamera = location.pathname === '/';
  const showDock = idx !== -1;

  return (
    <div className="relative h-full overflow-hidden">
      {!onCamera && <AuroraBackground />}
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.main
          key={location.pathname}
          custom={direction}
          initial={{ opacity: 0, x: direction * 28, scale: direction === 0 ? 0.985 : 1 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: direction * -28 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.8 }}
          className="absolute inset-0 overflow-y-auto overscroll-contain will-change-transform"
        >
          <Suspense fallback={<ScreenLoader />}>
            <Outlet />
          </Suspense>
        </motion.main>
      </AnimatePresence>
      {showDock && <NovaDock overCamera={onCamera} />}
      <InstallPrompt />
    </div>
  );
}
