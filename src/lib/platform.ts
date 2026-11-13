import { Capacitor } from '@capacitor/core';

/** True inside the Android/iOS app (Capacitor), false in a browser/PWA. */
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as 'android' | 'ios' | 'web';
