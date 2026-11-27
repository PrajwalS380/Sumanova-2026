/**
 * Per-device display preferences: light / dark / system theme, text size and data saver.
 * Applied before first paint (main.tsx) through a `dark` class + CSS variables that the
 * Tailwind tokens read, so every screen re-themes without per-component changes.
 */
import { applyAccent, applyCanvas, getCanvas } from './accent';

export type ThemeMode = 'light' | 'dark' | 'system';
export type TextSize = 'small' | 'normal' | 'large' | 'xl';

const THEME_KEY = 'snv-theme';
const TEXT_KEY = 'snv-text-size';
const SAVER_KEY = 'snv-data-saver';

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: applies for this session only */
  }
};

export function getTheme(): ThemeMode {
  const v = read(THEME_KEY);
  return v === 'dark' || v === 'system' ? v : 'light';
}

let mql: MediaQueryList | null = null;
export function isDark(mode: ThemeMode = getTheme()) {
  if (mode === 'system') return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  return mode === 'dark';
}

/** Dark canvas tone behind the tiles. */
const DARK_CANVAS = '#121216';

export function applyTheme(mode: ThemeMode = getTheme()) {
  const dark = isDark(mode);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  applyAccent();
  if (dark) {
    root.style.setProperty('--canvas', '18 18 22');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', DARK_CANVAS);
  } else applyCanvas(getCanvas());
  window.dispatchEvent(new CustomEvent('snv-theme', { detail: dark }));
  // follow the phone's setting live
  if (mode === 'system' && !mql && typeof matchMedia === 'function') {
    mql = matchMedia('(prefers-color-scheme: dark)');
    mql.addEventListener('change', () => getTheme() === 'system' && applyTheme('system'));
  }
}

export function setTheme(mode: ThemeMode) {
  write(THEME_KEY, mode);
  applyTheme(mode);
}

const TEXT_SCALE: Record<TextSize, number> = { small: 0.9, normal: 1, large: 1.12, xl: 1.25 };
export function getTextSize(): TextSize {
  const v = read(TEXT_KEY) as TextSize | null;
  return v && v in TEXT_SCALE ? v : 'normal';
}
/** Scales the whole UI's text (Tailwind sizes are rem-based). */
export function applyTextSize(size: TextSize = getTextSize()) {
  document.documentElement.style.fontSize = `${16 * TEXT_SCALE[size]}px`;
}
export function setTextSize(size: TextSize) {
  write(TEXT_KEY, size);
  applyTextSize(size);
}

/** Data saver: lower-quality media and no autoplay on mobile data. */
export function getDataSaver(): boolean {
  return read(SAVER_KEY) === '1';
}
export function setDataSaver(on: boolean) {
  write(SAVER_KEY, on ? '1' : '0');
}
/** True when media should be fetched small / not autoplayed right now. */
export function saveData(): boolean {
  if (getDataSaver()) {
    const c = (navigator as Navigator & { connection?: { type?: string; saveData?: boolean } }).connection;
    // on Wi-Fi the saver relaxes; unknown connection types are treated as mobile
    return !(c?.type === 'wifi' || c?.type === 'ethernet');
  }
  return !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
}

export function applyDisplay() {
  applyTheme();
  applyTextSize();
}
