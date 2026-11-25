/**
 * Offline mode: the chat list and the last messages of recently opened chats are kept on this
 * phone, so they can be read with no connection (sending already queues in the outbox).
 * Disappearing messages are never cached. Secret-chat messages stay encrypted.
 */
const LIST = (uid: string) => `snv-off-list-${uid}`;
const CONV = (uid: string, id: string) => `snv-off-c-${uid}-${id}`;
const INDEX = (uid: string) => `snv-off-idx-${uid}`;
const MAX_CHATS = 25;
const MAX_MSGS = 40;

function read<T>(k: string): T | null {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false; // full or blocked: offline copy is best-effort
  }
}

export const offlineCache = {
  saveList<T>(uid: string, list: T[]) {
    write(LIST(uid), { at: Date.now(), list: list.slice(0, 100) });
  },
  loadList<T>(uid: string): T[] | null {
    return read<{ list: T[] }>(LIST(uid))?.list ?? null;
  },
  saveChat<T extends { disappear_mode?: string; expires_at?: string | null }>(uid: string, id: string, snap: { info: unknown; members: unknown[]; people: Record<string, unknown>; messages: T[] }) {
    const messages = snap.messages.filter((m) => (m.disappear_mode ?? 'never') === 'never' && !m.expires_at).slice(-MAX_MSGS);
    if (!write(CONV(uid, id), { ...snap, messages, at: Date.now() })) return;
    const idx = [id, ...(read<string[]>(INDEX(uid)) ?? []).filter((x) => x !== id)];
    for (const old of idx.slice(MAX_CHATS)) {
      try {
        localStorage.removeItem(CONV(uid, old));
      } catch {
        /* ignore */
      }
    }
    write(INDEX(uid), idx.slice(0, MAX_CHATS));
  },
  loadChat<T>(uid: string, id: string): { info: unknown; members: unknown[]; people: Record<string, unknown>; messages: T[]; at: number } | null {
    return read(CONV(uid, id));
  },
};
