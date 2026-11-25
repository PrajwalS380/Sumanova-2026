import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Search, UserPlus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { MeButton } from './MeButton';

/** Round icon button used in top bars. */
export function BarButton({ label, onClick, to, children, badge, dark }: { label: string; onClick?: () => void; to?: string; children: ReactNode; badge?: number; dark?: boolean }) {
  const cls = cn('relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl active:scale-90', dark ? 'bg-black/45 text-white' : 'bg-white text-ink');
  const dot = badge ? <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-ember-rose px-1 text-[10px] font-extrabold text-white ring-2 ring-white">{badge > 9 ? '9+' : badge}</span> : null;
  return to ? (
    <Link to={to} aria-label={label} className={cls}>
      {children}
      {dot}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={cls}>
      {children}
      {dot}
    </button>
  );
}

/**
 * Main-tab top bar: my avatar face + search on the left, centred title,
 * add-friend + one screen action on the right.
 */
export function TopBar({ title, onSearch, right, friendBadge, dark, className }: { title: ReactNode; onSearch?: () => void; right?: ReactNode; friendBadge?: number; dark?: boolean; className?: string }) {
  return (
    <header className={cn('sticky top-0 z-30 flex items-center gap-2 px-3.5 pb-2 pt-safe', !dark && 'bg-noir/95', className)}>
      <MeButton />
      {onSearch ? (
        <BarButton label="Search" onClick={onSearch} dark={dark}>
          <Search className="h-5 w-5" />
        </BarButton>
      ) : (
        right && <span className="w-10 shrink-0" aria-hidden />
      )}
      <h1 className={cn('min-w-0 flex-1 truncate text-center text-xl font-extrabold', dark && 'text-white')}>{title}</h1>
      <BarButton label={`Add friends${friendBadge ? `, ${friendBadge} requests` : ''}`} to="/friends" badge={friendBadge} dark={dark}>
        <UserPlus className="h-5 w-5" />
      </BarButton>
      {right}
    </header>
  );
}
