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

/** Index of the dock tab for this path, or -1 for screens that hide the dock (threads, settings…). */
export function navIndex(pathname: string): number {
  const clean = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  return NAV_ITEMS.findIndex((n) => n.to === clean);
}
