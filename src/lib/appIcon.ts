import { registerPlugin } from '@capacitor/core';
import { isNative, platform } from './platform';

/** Home-screen icon colours (Android app only; each is an activity-alias in the manifest). */
export const APP_ICONS = [
  { id: 'Pink', hex: '#FF4F9A' },
  { id: 'Ink', hex: '#1C1C1E' },
  { id: 'Blue', hex: '#2F6BEA' },
  { id: 'Green', hex: '#0E9A6A' },
  { id: 'Violet', hex: '#7452F0' },
  { id: 'Orange', hex: '#E0700B' },
] as const;
export type AppIconId = (typeof APP_ICONS)[number]['id'];

interface AppIconPlugin {
  get(): Promise<{ icon: AppIconId }>;
  set(o: { icon: AppIconId }): Promise<void>;
}
const AppIcon = registerPlugin<AppIconPlugin>('AppIcon');

export const appIconSupported = isNative && platform === 'android';

export async function getAppIcon(): Promise<AppIconId | null> {
  if (!appIconSupported) return null;
  try {
    return (await AppIcon.get()).icon;
  } catch {
    return null; // older APK without the plugin
  }
}

export async function setAppIcon(icon: AppIconId) {
  await AppIcon.set({ icon });
}
