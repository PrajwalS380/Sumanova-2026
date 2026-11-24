import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useInbox } from '@/providers/InboxProvider';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { DARK_TABS, TABS, activeTab } from './nav';

/** Five-tab bottom bar: Map · Chat · Camera · Stories · Spotlight. */
export const BottomDock = memo(function BottomDock() {
  const { pathname } = useLocation();
  const active = activeTab(pathname);
  const dark = DARK_TABS.includes(pathname);
  const unread = useInbox().unreadTotal;
  if (!active) return null;
  return (
    <nav
      aria-label="Main"
      className={cn(
        'absolute inset-x-0 bottom-0 z-40 flex px-1.5 pb-safe',
        dark ? 'bg-black/45 text-white' : 'border-t border-ink/[0.07] bg-white/95 text-ink-mute',
      )}
    >
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <Link
            key={t.id}
            to={t.to}
            replace
            onClick={() => haptic(8)}
            aria-current={on ? 'page' : undefined}
            className={cn('flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] font-bold', on ? (dark ? 'text-white' : 'text-ember-flame') : dark ? 'text-white/70' : 'text-ink-mute')}
          >
            <span className={cn('relative grid h-[30px] w-12 place-items-center rounded-full transition-colors', on && (dark ? 'bg-white/20' : 'bg-ember-flame/12'))}>
              <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={t.d} />
              </svg>
              {t.id === 'chat' && unread > 0 && (
                <span className="absolute -right-0.5 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ember-flame px-1 text-[10px] font-extrabold text-white ring-2 ring-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
});
