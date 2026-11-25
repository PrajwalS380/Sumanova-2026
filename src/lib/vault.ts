import { supabase } from './supabase';

/**
 * "My Eyes Only" vault. Memories moved here are encrypted ON THE PHONE with a key derived from
 * the owner's passcode (PBKDF2-SHA256, 250k rounds → AES-GCM-256). The server only ever stores
 * ciphertext plus a salt and an encrypted check value — nobody (not even us) can open them
 * without the passcode. Forgetting the passcode means those items can't be recovered.
 */
export interface VaultRecord { v: 1; salt: string; iv: string; check: string }
const CHECK = 'sumanova-vault-ok';
const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function deriveKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function createVault(passcode: string): Promise<{ record: VaultRecord; key: CryptoKey }> {
  if (!/^\d{4,8}$/.test(passcode)) throw new Error('Use a 4–8 digit passcode');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passcode, salt);
  const check = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(CHECK)));
  return { record: { v: 1, salt: b64(salt), iv: b64(iv), check: b64(check) }, key };
}

export async function unlockVault(record: VaultRecord, passcode: string): Promise<CryptoKey> {
  const key = await deriveKey(passcode, unb64(record.salt));
  try {
    const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(record.iv) }, key, unb64(record.check));
    if (new TextDecoder().decode(out) !== CHECK) throw new Error();
  } catch {
    throw new Error('Wrong passcode');
  }
  return key;
}

/** Encrypt a file → [12-byte IV][ciphertext] as one binary blob. */
export async function encryptBlob(key: CryptoKey, blob: Blob): Promise<Blob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await blob.arrayBuffer());
  return new Blob([iv, new Uint8Array(ct)], { type: 'application/octet-stream' });
}

export async function decryptBlob(key: CryptoKey, data: Blob, type: string): Promise<Blob> {
  const buf = new Uint8Array(await data.arrayBuffer());
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, key, buf.slice(12));
  return new Blob([pt], { type });
}

export const vaultApi = {
  async get(uid: string): Promise<VaultRecord | null> {
    const { data, error } = await supabase.from('user_settings').select('vault').eq('user_id', uid).maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.vault as VaultRecord | null) ?? null;
  },
  async save(uid: string, record: VaultRecord) {
    const { error } = await supabase.from('user_settings').update({ vault: record }).eq('user_id', uid);
    if (error) throw new Error(error.message);
  },
};
