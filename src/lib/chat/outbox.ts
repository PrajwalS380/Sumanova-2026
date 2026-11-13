import type { LocalMessage } from './types';

/**
 * Persistent outbox for text messages that couldn't be sent (offline, server
 * error). Survives reloads; flushed with exponential backoff. Media messages
 * keep their blob in memory only (too large for storage) and are retried
 * while the app stays open.
 */
const KEY = 'sumanova:outbox:v1';

type Stored = Pick<LocalMessage, 'id' | 'conversation_id' | 'client_id' | 'kind' | 'body' | 'reply_to_id' | 'forwarded' | 'created_at' | 'media_meta' | 'media_path'>;

function read(): Stored[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Stored[];
  } catch {
    return [];
  }
}
function write(items: Stored[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(-200)));
  } catch {
    /* storage full or blocked */
  }
}

export const outbox = {
  all: read,
  forConversation: (id: string) => read().filter((m) => m.conversation_id === id),
  put(m: LocalMessage) {
    if (m.kind !== 'text' && m.kind !== 'sticker') return;
    const items = read().filter((x) => x.client_id !== m.client_id);
    items.push({ id: m.id, conversation_id: m.conversation_id, client_id: m.client_id, kind: m.kind, body: m.body, reply_to_id: m.reply_to_id, forwarded: m.forwarded, created_at: m.created_at, media_meta: m.media_meta, media_path: m.media_path });
    write(items);
  },
  remove(clientId: string) {
    write(read().filter((x) => x.client_id !== clientId));
  },
};

/** 1s, 2s, 4s … capped at 30s, with ±20% jitter. */
export function backoffDelay(attempt: number, random = Math.random): number {
  const base = Math.min(30_000, 1000 * 2 ** attempt);
  return Math.round(base * (0.8 + random() * 0.4));
}

/** Merge server messages with local pending ones, de-duplicated by client_id, ordered by time. */
export function mergeMessages(server: LocalMessage[], local: LocalMessage[]): LocalMessage[] {
  const byClient = new Map<string, LocalMessage>();
  for (const m of local) byClient.set(m.client_id, m);
  for (const m of server) byClient.set(m.client_id, m); // server copy wins
  return [...byClient.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}
