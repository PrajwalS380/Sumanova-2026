import { Menu } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDrawer } from './Drawer';

/** Opens the side drawer. `dark` = for use over photos/video. */
export function MenuButton({ dark = false }: { dark?: boolean }) {
  const drawer = useDrawer();
  return (
    <button onClick={drawer.open} aria-label="Open menu" className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl', dark ? 'bg-black/30 text-white ring-1 ring-white/15 backdrop-blur-md' : 'glass')}>
      <Menu className="h-5 w-5" />
    </button>
  );
}
