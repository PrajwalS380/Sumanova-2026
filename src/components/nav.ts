import { Bell, Camera, Clapperboard, Home, Images, Map, MessageCircle, Phone, Settings, Sparkles, UserRound, Users, Shirt, type LucideIcon } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** shown in the drawer's main group (others go under "You") */
  main?: boolean;
}

/** Every section, as listed in the side drawer. The dashboard (/) is home. */
export const SECTIONS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, main: true },
  { to: '/chat', label: 'Chats', icon: MessageCircle, main: true },
  { to: '/stories', label: 'Stories', icon: Sparkles, main: true },
  { to: '/spotlight', label: 'Spotlight', icon: Clapperboard, main: true },
  { to: '/map', label: 'Map', icon: Map, main: true },
  { to: '/memories', label: 'Memories', icon: Images, main: true },
  { to: '/camera', label: 'Camera', icon: Camera, main: true },
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/calls', label: 'Calls', icon: Phone },
  { to: '/notifications', label: 'Activity', icon: Bell },
  { to: '/avatar', label: 'Avatar studio', icon: Shirt },
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/** Root sections: Android back from these returns to the dashboard. */
export const ROOTS = ['/chat', '/stories', '/spotlight', '/map', '/memories', '/friends', '/calls', '/notifications', '/camera'];

export function isActive(item: NavItem, pathname: string) {
  return item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(item.to + '/');
}
