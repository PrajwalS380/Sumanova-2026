import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';
import { NAV_ITEMS } from './nav';
import { useInboxOptional } from '@/providers/InboxProvider';

/**
 * Floating glass "pill" dock. The camera lives in a raised aurora orb in the
 * centre; the active tab gets a soft gliding highlight.
 */
export function NovaDock({ overCamera = false }: { overCamera?: boolean }) {
  const { pathname } = useLocation();
  const unread = useInboxOptional()?.unreadTotal ?? 0;
  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-safe"
    >
      <div
        className={cn(
          'pointer-events-auto relative flex items-center gap-1 rounded-full p-1.5',
          overCamera ? 'bg-black/25 ring-1 ring-white/10 backdrop-blur-md' : 'glass-strong',
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
                className="relative mx-1 -my-4 grid h-16 w-16 place-items-center rounded-full"
              >
                <span className={cn('absolute inset-0 rounded-full ring-aurora', active ? 'animate-spin-slow' : '')} />
                <span className="absolute inset-[3px] rounded-full bg-night" />
                <span
                  className={cn(
                    'absolute inset-[7px] rounded-full transition-all duration-300',
                    active ? 'bg-white/95 shadow-[0_0_30px_rgba(167,139,250,0.7)]' : 'bg-white/10',
                  )}
                />
                <Icon className={cn('relative h-6 w-6 transition-colors', active ? 'text-night' : 'text-white')} />
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
              className="relative grid h-12 w-12 place-items-center rounded-full"
            >
              {active && (
                <motion.span
                  layoutId="dock-active"
                  className="absolute inset-0 rounded-full bg-white/12 ring-1 ring-white/15"
                  style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                />
              )}
              <Icon
                className={cn('relative h-[22px] w-[22px] transition-colors duration-200', active ? 'text-white' : 'text-ink-mute')}
                strokeWidth={active ? 2.4 : 2}
              />
              {item.to === '/chat' && unread > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-aurora-coral px-1 text-[10px] font-bold text-white ring-2 ring-night" aria-label={`${unread} unread`}>
                  {unread > 99 ? '99+' : unread}
                </motion.span>
              )}
              {active && (
                <motion.span
                  layoutId="dock-dot"
                  className="absolute bottom-1 h-1 w-1 rounded-full bg-aurora-mint"
                  transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
