/**
 * Main tabs (bottom bar). The camera is home (/). Everything else is reached
 * from a tab, the profile face button, or in-screen links.
 */
export type TabId = 'map' | 'chat' | 'camera' | 'stories' | 'spotlight';

export interface Tab {
  id: TabId;
  to: string;
  label: string;
  /** single SVG path, 24×24, stroke icon (own artwork) */
  d: string;
}

export const TABS: Tab[] = [
  { id: 'map', to: '/map', label: 'Map', d: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z' },
  { id: 'chat', to: '/chat', label: 'Chat', d: 'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4.2A2.5 2.5 0 0 1 4 14.5z' },
  { id: 'camera', to: '/', label: 'Camera', d: 'M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8L10 4h4l1.7 2h1.8A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5zM12 16a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z' },
  { id: 'stories', to: '/stories', label: 'Stories', d: 'M8 4.5h8a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2zM3 7v10M21 7v10' },
  { id: 'spotlight', to: '/spotlight', label: 'Spotlight', d: 'M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8-4.3-4.1 5.9-.8z' },
];

/** Exact paths where the bottom bar is shown. */
export const TAB_PATHS = TABS.map((t) => t.to);

/** Tabs drawn on a dark, full-bleed media background. */
export const DARK_TABS: string[] = ['/', '/spotlight'];

/** Root sections: Android back from these returns to the camera. */
export const ROOTS = ['/chat', '/stories', '/spotlight', '/map', '/memories', '/friends', '/calls', '/notifications', '/profile'];

export function activeTab(pathname: string): TabId | null {
  return TABS.find((t) => t.to === pathname)?.id ?? null;
}
