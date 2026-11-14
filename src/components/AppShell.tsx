import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AppBackground } from './AppBackground';
import { InstallPrompt } from './InstallPrompt';
import { ScreenLoader } from './ScreenLoader';
import { DrawerProvider } from './Drawer';

/** Signed-in layout: pearl backdrop, soft page transitions, side drawer. No tab bar. */
export function AppShell() {
  const location = useLocation();
  const onCamera = location.pathname === '/camera';
  return (
    <DrawerProvider>
      <div className="relative h-full overflow-hidden">
        {!onCamera && <AppBackground />}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.main
            key={location.pathname}
            initial={onCamera ? { opacity: 0, y: 40 } : { opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.8 }}
            className="absolute inset-0 overflow-y-auto overscroll-contain will-change-transform"
          >
            <Suspense fallback={<ScreenLoader />}>
              <Outlet />
            </Suspense>
          </motion.main>
        </AnimatePresence>
        <InstallPrompt />
      </div>
    </DrawerProvider>
  );
}
