import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNative } from './platform';

let enabled = true;
export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

/** Light tactile feedback: native haptics in the app, vibration API on Android web. */
export function haptic(pattern: number | number[] = 8) {
  if (!enabled) return;
  try {
    if (isNative) {
      const strong = Array.isArray(pattern) || pattern >= 10;
      void Haptics.impact({ style: strong ? ImpactStyle.Medium : ImpactStyle.Light });
    } else {
      navigator.vibrate?.(pattern);
    }
  } catch {
    /* unsupported */
  }
}
