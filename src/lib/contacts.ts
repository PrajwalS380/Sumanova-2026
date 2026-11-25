import { supabase } from './supabase';
import { isNative } from './platform';
import type { SearchResult } from './chat/types';

/**
 * Find friends from phone contacts — privately.
 * Numbers never leave the phone in plain text: each one is normalised to E.164 and
 * SHA-256 hashed on the device; the server compares hashes only (see the
 * contacts_and_suggestions migration). The server keeps my latest hash set so a
 * contact who joins later is suggested (and I'm notified) right away.
 */

export type ContactMatch = SearchResult;

const KEY = (uid: string) => `snv-contacts-${uid}`;
const CC_KEY = 'snv-country-code';

/** Default country calling code for local numbers (from my own number, else India). */
export function defaultCountryCode(): string {
  try {
    return localStorage.getItem(CC_KEY) || '91';
  } catch {
    return '91';
  }
}
export function rememberCountryCode(e164: string) {
  const d = e164.replace(/\D/g, '');
  // Common 1–3 digit codes: keep the shortest prefix that leaves a 6+ digit national number.
  const cc = d.startsWith('1') ? '1' : d.length > 11 ? d.slice(0, d.length - 10) : d.slice(0, 2);
  try {
    localStorage.setItem(CC_KEY, cc);
  } catch {
    /* storage blocked */
  }
}

/** Normalise a number typed or stored in an address book to +<digits>, or null if unusable. */
export function normalizePhone(raw: string, cc = defaultCountryCode()): string | null {
  const s = raw.trim();
  let d = s.replace(/\D/g, '');
  if (!d) return null;
  if (s.startsWith('+')) return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
  if (d.startsWith('00')) d = d.slice(2);
  else {
    d = d.replace(/^0+/, ''); // trunk prefix (0 98765 43210)
    // A national number (≤10 digits) gets my country code; longer ones already carry one.
    if (d.length <= 10) d = cc + d;
  }
  return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const contactsSupported = isNative;

export function contactSyncOn(uid: string): boolean {
  try {
    return localStorage.getItem(KEY(uid)) === 'on';
  } catch {
    return false;
  }
}
function setSyncFlag(uid: string, on: boolean) {
  try {
    if (on) localStorage.setItem(KEY(uid), 'on');
    else localStorage.removeItem(KEY(uid));
  } catch {
    /* storage blocked */
  }
}

/** Read and hash every phone number in the address book (asks for permission once). */
async function readHashes(ask: boolean): Promise<string[] | 'denied'> {
  const { Contacts } = await import('@capacitor-community/contacts');
  let perm = (await Contacts.checkPermissions()).contacts;
  if (perm !== 'granted' && perm !== 'limited' && ask) perm = (await Contacts.requestPermissions()).contacts;
  if (perm !== 'granted' && perm !== 'limited') return 'denied';
  const { contacts } = await Contacts.getContacts({ projection: { phones: true } });
  const cc = defaultCountryCode();
  const numbers = new Set<string>();
  for (const c of contacts) for (const p of c.phones ?? []) {
    const n = p.number && normalizePhone(p.number, cc);
    if (n) numbers.add(n);
  }
  const list = [...numbers].slice(0, 5000);
  return Promise.all(list.map(sha256Hex));
}

const rpcMatches = (data: unknown) => (data ?? []) as ContactMatch[];

/** Matches from the address book the server already has (no upload). */
export async function storedContactMatches(): Promise<ContactMatch[]> {
  const { data, error } = await supabase.rpc('contact_suggestions');
  if (error) throw error;
  return rpcMatches(data);
}

/** Upload the current address book (hashes) if it changed, and return matches. */
export async function syncContacts(uid: string, opts: { ask?: boolean; force?: boolean } = {}): Promise<ContactMatch[] | 'denied'> {
  const hashes = await readHashes(!!opts.ask);
  if (hashes === 'denied') return 'denied';
  setSyncFlag(uid, true);
  hashes.sort();
  const fingerprint = await sha256Hex(hashes.join(''));
  const fpKey = `${KEY(uid)}-fp`;
  let last: string | null = null;
  try {
    last = localStorage.getItem(fpKey);
  } catch {
    /* storage blocked */
  }
  if (!opts.force && last === fingerprint) return storedContactMatches();
  const { data, error } = await supabase.rpc('sync_contacts', { p_hashes: hashes });
  if (error) throw error;
  try {
    localStorage.setItem(fpKey, fingerprint);
  } catch {
    /* storage blocked */
  }
  return rpcMatches(data);
}

/** Stop syncing and forget the address book on the server. */
export async function stopContactSync(uid: string) {
  setSyncFlag(uid, false);
  try {
    localStorage.removeItem(`${KEY(uid)}-fp`);
  } catch {
    /* storage blocked */
  }
  const { error } = await supabase.rpc('clear_contacts');
  if (error) throw error;
}

/**
 * Keep contacts fresh while sync is on: on app start and every time the app comes back
 * to the foreground (a contact saved a minute ago is matched as soon as you return).
 */
export function startContactAutoSync(uid: string, onMatches?: (m: ContactMatch[]) => void): () => void {
  if (!isNative || !contactSyncOn(uid)) return () => undefined;
  let stopped = false;
  const run = () => {
    if (stopped) return;
    syncContacts(uid)
      .then((m) => { if (m !== 'denied' && !stopped) onMatches?.(m); })
      .catch(() => undefined);
  };
  run();
  let remove: (() => void) | undefined;
  void import('@capacitor/app').then(({ App }) =>
    App.addListener('resume', run).then((h) => {
      if (stopped) void h.remove();
      else remove = () => void h.remove();
    }),
  );
  return () => {
    stopped = true;
    remove?.();
  };
}

export const phoneApi = {
  /** My saved number's last 4 digits, or null. */
  async mine(uid: string): Promise<string | null> {
    const { data, error } = await supabase.from('phone_numbers').select('last4').eq('user_id', uid).maybeSingle();
    if (error) throw error;
    return (data?.last4 as string | null) ?? null;
  },
  async set(raw: string): Promise<string | null> {
    const n = raw.trim() ? normalizePhone(raw) : '';
    if (n === null) throw new Error('Enter a valid phone number');
    const { data, error } = await supabase.rpc('set_phone', { p_phone: n });
    if (error) throw error;
    if (n) rememberCountryCode(n);
    return (data as string | null) ?? null;
  },
};

export interface PymkPerson {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  aura_color: SearchResult['aura_color'];
  mutual: number;
}
export async function peopleYouMayKnow(): Promise<PymkPerson[]> {
  const { data, error } = await supabase.rpc('suggest_friends');
  if (error) throw error;
  return (data ?? []) as PymkPerson[];
}
