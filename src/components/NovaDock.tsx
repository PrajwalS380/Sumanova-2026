import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';
import { NAV_ITEMS } from './nav';
import { useInboxOptional } from '@/providers/InboxProvider';

/**
 * Floating matte dock. The active tab opens into a cream capsule with its
 * label; the camera is a glowing ember orb in the centre.
 */
export function NovaDock({ overCamera = false }: { overCamera?: boolean }) {
  const { pathname } = useLocation();
  const unread = useInboxOptional()?.unreadTotal ?? 0;
  return (
    <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-safe">
      <div
        className={cn(
          'pointer-events-auto relative flex items-center gap-0.5 rounded-[26px] p-1.5',
          overCamera ? 'bg-black/35 ring-1 ring-white/10' : 'glass-strong',
        )}
      >
        {NAV_ITEMS.map((item) => {
          const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
          const Icon = item.icon;
          if (item.to === '/') {
            return (
              <NavLink
                key={item.to}
                to="/"
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                onClick={() => haptic(10)}
                className="relative mx-1.5 -my-3 grid h-[62px] w-[62px] place-items-center"
              >
                <span
                  className={cn('absolute inset-0 rounded-full bg-ember-gradient text-noir transition-transform duration-300', active ? 'scale-100' : 'scale-[0.92]')}
                  style={{ boxShadow: active ? '0 0 0 4px rgba(12,10,9,1), 0 0 34px 2px rgba(255,122,61,.55)' : '0 0 0 4px rgba(12,10,9,1), 0 8px 24px -6px rgba(255,122,61,.5)' }}
                />
                <span className="absolute inset-[5px] rounded-full bg-[radial-gradient(circle_at_35%_28%,rgba(255,240,215,.55),transparent_55%)]" />
                <Icon className="relative h-6 w-6 text-noir" strokeWidth={2.3} />
              </NavLink>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.to === '/chat' && unread ? `${item.label}, ${unread} unread` : item.label}
              aria-current={active ? 'page' : undefined}
              onClick={() => haptic(6)}
              className="relative flex h-12 items-center justify-center rounded-[20px] px-3"
            >
              {active && (
                <motion.span
                  layoutId="dock-active"
                  className="absolute inset-0 rounded-[20px] bg-ember-cream"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className={cn('relative h-[21px] w-[21px] transition-colors duration-200', active ? 'text-noir' : 'text-ink-mute')} strokeWidth={active ? 2.4 : 1.9} />
              <AnimatePresence initial={false}>
                {active && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                    className="relative overflow-hidden whitespace-nowrap pl-1.5 text-[13px] font-bold text-noir max-[360px]:hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {item.to === '/chat' && unread > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ember-rose px-1 text-[10px] font-bold text-noir ring-2 ring-noir" aria-label={`${unread} unread`}>
                  {unread > 99 ? '99+' : unread}
                </motion.span>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
