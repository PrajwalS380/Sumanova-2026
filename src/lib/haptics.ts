let enabled = true;
export function setHapticsEnabled(value: boolean) {
  enabled = value;
}
/** Light vibration feedback on Android; silently no-op elsewhere. */
export function haptic(pattern: number | number[] = 8) {
  if (!enabled) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
