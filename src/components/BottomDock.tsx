import { memo } from 'react';
import { useT } from '@/lib/i18n';
import { Link, useLocation } from 'react-router-dom';
import { useInbox } from '@/providers/InboxProvider';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { TABS, activeTab } from './nav';

/**
 * Five-tab bottom bar: Map · Chat · Camera · Stories · Spotlight.
 * Bento style: a floating black rounded panel; the camera is a white rounded square.
 */
export const BottomDock = memo(function BottomDock() {
  const { pathname } = useLocation();
  const active = activeTab(pathname);
  const unread = useInbox().unreadTotal;
  const tr = useT();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-3.5 pb-safe">
      <nav aria-label="Main" className="pointer-events-auto grid h-16 grid-cols-5 items-center rounded-[24px] bg-[#111111] shadow-glass">
        {TABS.map((t) => {
          const on = t.id === active;
          if (t.id === 'camera') {
            return (
              <Link key={t.id} to={t.to} replace onClick={() => haptic(8)} aria-current={on ? 'page' : undefined} aria-label={tr(t.label)} className="grid place-items-center">
                <span className="grid h-[46px] w-[46px] place-items-center rounded-2xl bg-white">
                  <span className={cn('h-[18px] w-[18px] rounded-full border-[3px] border-[#111111]', on ? 'bg-ember-rose' : 'bg-white')} />
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={t.id}
              to={t.to}
              replace
              onClick={() => haptic(8)}
              aria-current={on ? 'page' : undefined}
              className={cn('relative flex h-full flex-col items-center justify-center gap-[3px] text-[10.5px] font-bold', on ? 'text-white' : 'text-white/55')}
            >
              <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={t.d} />
              </svg>
              {tr(t.label)}
              {on && <span aria-hidden className="absolute bottom-[5px] h-1 w-1 rounded-full bg-white" />}
              {t.id === 'chat' && unread > 0 && (
                <span className="absolute left-1/2 top-2 ml-1 grid h-4 min-w-4 place-items-center rounded-full bg-ember-rose px-1 text-[10px] font-extrabold text-white">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
});
