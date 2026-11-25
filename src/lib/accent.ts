/**
 * Accent colour ("theme") picker. The Bento surfaces stay the same; only the
 * accent — buttons, highlights, active states, gradients — changes. Stored per
 * device and applied before first paint via CSS variables that the Tailwind
 * `ember-flame` / `ember-amber` / `bg-ember-gradient` tokens read.
 */
export interface Accent {
  id: string;
  label: string;
  /** main accent */
  main: string;
  /** gradient start / end */
  from: string;
  to: string;
}

export const ACCENTS: Accent[] = [
  { id: 'ink', label: 'Ink', main: '#111111', from: '#111111', to: '#111111' },
  { id: 'rose', label: 'Pink', main: '#E0408A', from: '#E0408A', to: '#E0408A' },
  { id: 'ocean', label: 'Blue', main: '#2F6BEA', from: '#2F6BEA', to: '#2F6BEA' },
  { id: 'jade', label: 'Green', main: '#0E9A6A', from: '#0E9A6A', to: '#0E9A6A' },
  { id: 'violet', label: 'Violet', main: '#7452F0', from: '#7452F0', to: '#7452F0' },
  { id: 'sunset', label: 'Orange', main: '#E0700B', from: '#E0700B', to: '#E0700B' },
];

const KEY = 'snv-accent';

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

export function getAccent(): Accent {
  try {
    const id = localStorage.getItem(KEY);
    return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
  } catch {
    return ACCENTS[0];
  }
}

export function applyAccent(a: Accent = getAccent()) {
  const s = document.documentElement.style;
  s.setProperty('--accent', rgb(a.main));
  s.setProperty('--accent-from', rgb(a.from));
  s.setProperty('--accent-to', rgb(a.to));
}

export function setAccent(id: string) {
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0];
  try {
    localStorage.setItem(KEY, a.id);
  } catch {
    /* private mode — still applies for this session */
  }
  applyAccent(a);
  return a;
}
