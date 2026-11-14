import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/providers/AuthProvider';
import { useInboxOptional } from '@/providers/InboxProvider';
import { useNotificationsOptional } from '@/providers/NotificationsProvider';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { Avatar } from './Avatar';
import { LogoMark } from './Logo';
import { SECTIONS, isActive } from './nav';

const Ctx = createContext<{ open: () => void; close: () => void; isOpen: boolean } | null>(null);

export function useDrawer() {
  return useContext(Ctx) ?? { open: () => undefined, close: () => undefined, isOpen: false };
}

/**
 * Side drawer that replaces a tab bar: every section in one list. Opens from
 * the menu button in headers or by swiping in from the left edge.
 */
export function DrawerProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => {
    haptic(6);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  // Edge swipe: a drag that starts within 18px of the left edge opens the drawer.
  useEffect(() => {
    let startX = -1, startY = 0;
    const down = (e: PointerEvent) => {
      startX = e.clientX <= 18 ? e.clientX : -1;
      startY = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (startX < 0) return;
      if (e.clientX - startX > 46 && Math.abs(e.clientY - startY) < 40) {
        startX = -1;
        open();
      }
    };
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
    };
  }, [open]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <DrawerPanel open={isOpen} onClose={close} pathname={pathname} />
    </Ctx.Provider>
  );
}

function DrawerPanel({ open, onClose, pathname }: { open: boolean; onClose: () => void; pathname: string }) {
  const { profile } = useAuth();
  const unread = useInboxOptional()?.unreadTotal ?? 0;
  const requests = useInboxOptional()?.pendingRequests ?? 0;
  const activity = useNotificationsOptional()?.unread ?? 0;
  const badge: Record<string, number> = { '/chat': unread, '/friends': requests, '/notifications': activity };
  const main = SECTIONS.filter((s) => s.main);
  const rest = SECTIONS.filter((s) => !s.main);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70]">
          <motion.button aria-label="Close menu" className="absolute inset-0 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.nav
            aria-label="Sections"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 42 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.5, right: 0 }}
            onDragEnd={(_, i) => (i.offset.x < -80 || i.velocity.x < -500) && onClose()}
            className="glass-strong absolute bottom-0 left-0 top-0 flex w-[78%] max-w-[320px] flex-col overflow-y-auto rounded-r-[28px] pb-safe pt-safe"
          >
            <Link to="/profile" className="mx-4 mt-2 flex items-center gap-3 rounded-3xl p-2 active:bg-ink/[0.04]">
              <Avatar name={profile?.display_name ?? 'Me'} url={profile?.avatar_url} aura={profile?.aura_color} size={52} />
              <span className="min-w-0">
                <span className="block truncate font-display text-[24px] leading-tight">{profile?.display_name}</span>
                <span className="block truncate text-xs text-ink-mute">@{profile?.username}</span>
              </span>
            </Link>
            <ul className="mt-4 space-y-0.5 px-3">
              {main.map((s) => (
                <DrawerLink key={s.to} item={s} active={isActive(s, pathname)} badge={badge[s.to]} />
              ))}
            </ul>
            <p className="eyebrow mx-6 mb-1 mt-5">You</p>
            <ul className="space-y-0.5 px-3">
              {rest.map((s) => (
                <DrawerLink key={s.to} item={s} active={isActive(s, pathname)} badge={badge[s.to]} />
              ))}
            </ul>
            <div className="mt-auto flex items-center gap-2 px-6 pb-4 pt-6 text-xs text-ink-faint">
              <LogoMark size={20} /> SUMANOVA
            </div>
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  );
}

function DrawerLink({ item, active, badge }: { item: (typeof SECTIONS)[number]; active: boolean; badge?: number }) {
  const Icon = item.icon;
  return (
    <li>
      <Link to={item.to} aria-current={active ? 'page' : undefined} className={cn('flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-semibold transition-colors', active ? 'bg-ember-cream text-noir' : 'text-ink-soft active:bg-ink/[0.05]')}>
        <Icon className={cn('h-5 w-5', active ? 'text-noir' : 'text-ember-flame')} />
        <span className="flex-1">{item.label}</span>
        {!!badge && <span className={cn('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold', active ? 'bg-noir text-ink' : 'bg-ember-rose text-white')}>{badge > 99 ? '99+' : badge}</span>}
      </Link>
    </li>
  );
}
