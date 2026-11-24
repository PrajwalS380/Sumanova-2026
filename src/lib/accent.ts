/**
 * Accent colour ("theme") picker. The Pearl surfaces stay the same; only the
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
  { id: 'indigo', label: 'Indigo', main: '#3D4FE0', from: '#6E7BFF', to: '#8E5BEA' },
  { id: 'rose', label: 'Rose', main: '#D63A72', from: '#FF7BA8', to: '#B44AA8' },
  { id: 'jade', label: 'Jade', main: '#0E8C6D', from: '#3CCB9E', to: '#2F7FC2' },
  { id: 'ocean', label: 'Ocean', main: '#1F6FC4', from: '#4FB0FF', to: '#3D4FE0' },
  { id: 'violet', label: 'Violet', main: '#7A3FD6', from: '#A98BFF', to: '#D24FA0' },
  { id: 'sunset', label: 'Sunset', main: '#D2541F', from: '#FF9A5A', to: '#E0447A' },
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
