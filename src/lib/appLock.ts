/**
 * App lock (this device only): a 4–6 digit PIN, optionally unlocked with the phone's
 * fingerprint / face. The PIN is never stored — only a salted PBKDF2 hash. Forgetting the PIN
 * means signing out (signing back in needs the account password), which also clears the lock.
 */
import { registerPlugin } from '@capacitor/core';
import { isNative, platform } from './platform';

const KEY = 'snv-lock';
const FAIL_KEY = 'snv-lock-fails';

export type LockAfter = 0 | 60 | 300 | 900;
interface LockConfig {
  salt: string;
  hash: string;
  /** seconds in the background before it locks again */
  after: LockAfter;
  bio: boolean;
  /** WebAuthn credential id (web only) */
  cred?: string;
}

const b64 = (u: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(u)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function load(): LockConfig | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? (JSON.parse(v) as LockConfig) : null;
  } catch {
    return null;
  }
}
function save(c: LockConfig | null) {
  try {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event('snv-lock-changed'));
}

async function hashPin(pin: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 150_000 }, key, 256);
  return b64(bits);
}

export const PIN_RE = /^\d{4,6}$/;

export function lockEnabled() {
  return !!load();
}
export function lockConfig() {
  const c = load();
  return c ? { after: c.after, bio: c.bio } : null;
}

export async function setPin(pin: string, after: LockAfter = 0) {
  if (!PIN_RE.test(pin)) throw new Error('Use 4 to 6 digits');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prev = load();
  save({ salt: b64(salt), hash: await hashPin(pin, salt), after: prev?.after ?? after, bio: prev?.bio ?? false, cred: prev?.cred });
}

export function updateLock(p: Partial<Pick<LockConfig, 'after' | 'bio' | 'cred'>>) {
  const c = load();
  if (c) save({ ...c, ...p });
}

export function removeLock() {
  save(null);
  try {
    localStorage.removeItem(FAIL_KEY);
  } catch {
    /* ignore */
  }
}

/** Wrong-PIN back-off: 5 free tries, then 30 s, 60 s, 2 min … */
export function lockoutRemaining(): number {
  try {
    const f = JSON.parse(localStorage.getItem(FAIL_KEY) || '{"n":0,"t":0}') as { n: number; t: number };
    if (f.n < 5) return 0;
    const wait = 30_000 * 2 ** Math.min(f.n - 5, 6);
    return Math.max(0, f.t + wait - Date.now());
  } catch {
    return 0;
  }
}
function noteFail(ok: boolean) {
  try {
    if (ok) localStorage.removeItem(FAIL_KEY);
    else {
      const f = JSON.parse(localStorage.getItem(FAIL_KEY) || '{"n":0,"t":0}') as { n: number; t: number };
      localStorage.setItem(FAIL_KEY, JSON.stringify({ n: f.n + 1, t: Date.now() }));
    }
  } catch {
    /* ignore */
  }
}

export async function checkPin(pin: string): Promise<boolean> {
  const c = load();
  if (!c) return true;
  if (lockoutRemaining() > 0) return false;
  const ok = (await hashPin(pin, unb64(c.salt))) === c.hash;
  noteFail(ok);
  return ok;
}

// ---------------------------------------------------------------------------
// Fingerprint / face
// ---------------------------------------------------------------------------
interface BiometricPlugin {
  available(): Promise<{ available: boolean }>;
  verify(opts: { title: string; subtitle?: string }): Promise<{ ok: boolean }>;
}
const Biometric = registerPlugin<BiometricPlugin>('Biometric');

export async function biometricAvailable(): Promise<boolean> {
  if (isNative) {
    if (platform !== 'android') return false;
    return Biometric.available().then((r) => r.available).catch(() => false);
  }
  const P = window.PublicKeyCredential as (typeof PublicKeyCredential & { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> }) | undefined;
  return !!P?.isUserVerifyingPlatformAuthenticatorAvailable && (await P.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false));
}

/** Turn on fingerprint unlock (registers a local passkey on the web; nothing leaves the phone). */
export async function enableBiometric(): Promise<boolean> {
  if (isNative) {
    const r = await Biometric.verify({ title: 'Use fingerprint to unlock SUMANOVA' }).catch(() => ({ ok: false }));
    if (r.ok) updateLock({ bio: true });
    return r.ok;
  }
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'SUMANOVA', id: location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'app-lock', displayName: 'SUMANOVA app lock' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    updateLock({ bio: true, cred: b64(cred.rawId) });
    return true;
  } catch {
    return false;
  }
}

export async function unlockWithBiometric(): Promise<boolean> {
  const c = load();
  if (!c?.bio) return false;
  if (isNative) {
    const r = await Biometric.verify({ title: 'Unlock SUMANOVA' }).catch(() => ({ ok: false }));
    return r.ok;
  }
  if (!c.cred) return false;
  try {
    const a = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: unb64(c.cred) as BufferSource }],
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    return !!a;
  } catch {
    return false;
  }
}
