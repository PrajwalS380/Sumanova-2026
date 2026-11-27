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
  const root = document.documentElement;
  const s = root.style;
  // black "Ink" accent would vanish on the dark canvas: use a raised grey there
  if (a.id === 'ink' && root.classList.contains('dark')) a = { ...a, main: '#3A3A42', from: '#3A3A42', to: '#3A3A42' };
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

/** Page canvas ("background theme"): the soft tone behind the white tiles. */
export interface Canvas { id: string; label: string; hex: string }
export const CANVASES: Canvas[] = [
  { id: 'grey', label: 'Soft grey', hex: '#ECECEF' },
  { id: 'blush', label: 'Blush', hex: '#F6E7EE' },
  { id: 'sky', label: 'Sky', hex: '#E3ECF7' },
  { id: 'mint', label: 'Mint', hex: '#E2F1EA' },
  { id: 'lilac', label: 'Lilac', hex: '#ECE6F7' },
  { id: 'sand', label: 'Sand', hex: '#F3EDE3' },
];
const CANVAS_KEY = 'snv-canvas';

export function getCanvas(): Canvas {
  try {
    const id = localStorage.getItem(CANVAS_KEY);
    return CANVASES.find((c) => c.id === id) ?? CANVASES[0];
  } catch {
    return CANVASES[0];
  }
}

export function applyCanvas(c: Canvas = getCanvas()) {
  // dark mode owns the canvas (lib/display.ts); the choice applies again in light mode
  if (document.documentElement.classList.contains('dark')) return;
  document.documentElement.style.setProperty('--canvas', rgb(c.hex));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', c.hex);
}

export function setCanvas(id: string) {
  const c = CANVASES.find((x) => x.id === id) ?? CANVASES[0];
  try {
    localStorage.setItem(CANVAS_KEY, c.id);
  } catch {
    /* applies for this session */
  }
  applyCanvas(c);
  return c;
}
