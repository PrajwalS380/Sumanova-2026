import { Camera, Clapperboard, Map, MessageCircle, Sparkles, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Dock order — camera sits in the centre and is the home screen. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/map', label: 'Map', icon: Map },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
  { to: '/', label: 'Camera', icon: Camera },
  { to: '/stories', label: 'Stories', icon: Sparkles },
  { to: '/spotlight', label: 'Spotlight', icon: Clapperboard },
];

export function navIndex(pathname: string): number {
  const i = NAV_ITEMS.findIndex((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)));
  return i;
}
