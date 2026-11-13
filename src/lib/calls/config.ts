/**
 * ICE servers. STUN is free (Google public STUN). TURN is optional and only
 * used when configured — a free public TURN service can't be assumed, so
 * without TURN some strict networks (symmetric NAT / carrier-grade NAT /
 * corporate firewalls) won't connect. See docs/CALLS.md.
 */
export function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(',').map((s) => s.trim()),
      username: import.meta.env.VITE_TURN_USERNAME as string | undefined,
      credential: import.meta.env.VITE_TURN_CREDENTIAL as string | undefined,
    });
  }
  return servers;
}

export const RING_TIMEOUT_MS = 45_000;
export const CONNECT_TIMEOUT_MS = 25_000;
export const RECONNECT_GRACE_MS = 4_000;
