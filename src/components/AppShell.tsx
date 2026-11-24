import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppBackground } from './AppBackground';
import { InstallPrompt } from './InstallPrompt';
import { ScreenLoader } from './ScreenLoader';
import { BottomDock } from './BottomDock';
import { DARK_TABS, TAB_PATHS } from './nav';
import { cn } from '@/lib/cn';

/** Signed-in layout: pearl backdrop, soft page transitions, five-tab bottom bar on the main tabs. */
export function AppShell() {
  const location = useLocation();
  const onTab = TAB_PATHS.includes(location.pathname);
  const fullBleed = DARK_TABS.includes(location.pathname);
  return (
    <div className="relative h-full overflow-hidden">
      {!fullBleed && <AppBackground />}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.8 }}
          className={cn('absolute inset-0 overflow-y-auto overscroll-contain will-change-transform', onTab && !fullBleed && 'pb-[calc(84px+var(--safe-bottom))]')}
        >
          <Suspense fallback={<ScreenLoader />}>
            <Outlet />
          </Suspense>
        </motion.main>
      </AnimatePresence>
      <BottomDock />
      <InstallPrompt />
    </div>
  );
}
