import { useEffect, useState } from 'react';

/** Countdown used to throttle "resend code" taps. */
export function useCooldown(initial = 0) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: (s = 60) => setLeft(s) };
}
