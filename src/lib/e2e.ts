import { supabase } from './supabase';

/**
 * Secret (end-to-end encrypted) chats.
 * - Each person has an ECDH P-256 key pair made on their phone. The private key is stored
 *   NON-EXTRACTABLE in this device's IndexedDB and never leaves it; only the public key is
 *   published (e2e_keys).
 * - A secret message is AES-GCM-256 encrypted with the ECDH shared key of sender + recipient, so the
 *   server (and we) only ever see ciphertext: "e2e:<base64 json>".
 * - Messages carry the key ids used, so they stay readable on the devices that hold those keys.
 *   (One device per person at a time: setting up on a new phone replaces the key.)
 */
interface MyKey { uid: string; keyId: string; privateKey: CryptoKey; publicJwk: JsonWebKey }
interface Envelope { v: 1; s: string; r: string; iv: string; ct: string }

const DB = 'snv-e2e';
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keys', { keyPath: 'uid' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function getStored(uid: string): Promise<MyKey | null> {
  const db = await idb();
  return new Promise((resolve) => {
    const r = db.transaction('keys').objectStore('keys').get(uid);
    r.onsuccess = () => resolve((r.result as MyKey) ?? null);
    r.onerror = () => resolve(null);
  });
}
async function putStored(k: MyKey) {
  const db = await idb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('keys', 'readwrite');
    tx.objectStore('keys').put(k);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const isE2E = (body: string | null | undefined) => !!body?.startsWith('e2e:');

let mine: Promise<MyKey> | null = null;
/** Make (once) and publish this device's key pair. */
export function ensureMyKey(uid: string): Promise<MyKey> {
  if (!mine) {
    mine = (async () => {
      const stored = await getStored(uid);
      if (stored) {
        // Re-publish if the server doesn't know it (e.g. first run after an update).
        const { data } = await supabase.from('e2e_keys').select('key_id').eq('key_id', stored.keyId).maybeSingle();
        if (data) return stored;
      }
      const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey'])) as CryptoKeyPair;
      const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
      const { data, error } = await supabase.rpc('publish_e2e_key', { p_jwk: { kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x, y: publicJwk.y } });
      if (error) throw new Error(error.message);
      const k: MyKey = { uid, keyId: data as string, privateKey: pair.privateKey, publicJwk };
      await putStored(k);
      return k;
    })().catch((e) => {
      mine = null;
      throw e;
    });
  }
  return mine;
}

const pubCache = new Map<string, Promise<CryptoKey>>();
function publicKey(keyId: string): Promise<CryptoKey> {
  let p = pubCache.get(keyId);
  if (!p) {
    p = (async () => {
      const { data, error } = await supabase.from('e2e_keys').select('public_jwk').eq('key_id', keyId).maybeSingle();
      if (error || !data) throw new Error('Key not found');
      return crypto.subtle.importKey('jwk', data.public_jwk as JsonWebKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
    })();
    pubCache.set(keyId, p);
  }
  return p;
}
export async function currentKeyOf(userId: string): Promise<string | null> {
  const { data } = await supabase.from('e2e_keys').select('key_id').eq('user_id', userId).is('replaced_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return (data?.key_id as string | undefined) ?? null;
}

const aesCache = new Map<string, Promise<CryptoKey>>();
function sharedKey(my: MyKey, otherKeyId: string): Promise<CryptoKey> {
  const k = `${my.keyId}:${otherKeyId}`;
  let p = aesCache.get(k);
  if (!p) {
    p = publicKey(otherKeyId).then((pub) => crypto.subtle.deriveKey({ name: 'ECDH', public: pub }, my.privateKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']));
    aesCache.set(k, p);
  }
  return p;
}

export async function encryptFor(uid: string, peerId: string, text: string): Promise<string> {
  const my = await ensureMyKey(uid);
  const peerKey = await currentKeyOf(peerId);
  if (!peerKey) throw new Error('Your friend needs to open the latest SUMANOVA once before secret chats work');
  const key = await sharedKey(my, peerKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
  const env: Envelope = { v: 1, s: my.keyId, r: peerKey, iv: b64(iv), ct: b64(ct) };
  return `e2e:${btoa(JSON.stringify(env))}`;
}

export async function decryptBody(uid: string, body: string, senderIsMe: boolean): Promise<string> {
  const my = await ensureMyKey(uid);
  const env = JSON.parse(atob(body.slice(4))) as Envelope;
  const myId = senderIsMe ? env.s : env.r;
  const otherId = senderIsMe ? env.r : env.s;
  if (myId !== my.keyId) throw new Error('other-device');
  const key = await sharedKey(my, otherId);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, key, unb64(env.ct));
  return new TextDecoder().decode(pt);
}

/** Per-chat "secret mode" switch (remembered on this device). */
export const secretMode = {
  get: (conversationId: string) => {
    try {
      return localStorage.getItem(`snv-secret-${conversationId}`) === '1';
    } catch {
      return false;
    }
  },
  set: (conversationId: string, on: boolean) => {
    try {
      if (on) localStorage.setItem(`snv-secret-${conversationId}`, '1');
      else localStorage.removeItem(`snv-secret-${conversationId}`);
    } catch {
      /* storage blocked */
    }
  },
};
