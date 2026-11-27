import { supabase } from '@/lib/supabase';

/** Chat batch B: pins, to-do lists, reminders, link previews. */
export interface Pin { message_id: string; conversation_id: string; pinned_by: string | null; created_at: string }
export interface TodoItem { id: string; message_id: string; text: string; done_by: string | null; done_at: string | null; created_by: string | null; created_at: string }
export interface LinkPreview { url: string; title: string | null; description: string | null; image: string | null; site: string | null; ok: boolean }

const must = <T,>(r: { data: T; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

export const pinsApi = {
  list: async (conversationId: string) =>
    must(await supabase.from('message_pins').select('message_id,conversation_id,pinned_by,created_at').eq('conversation_id', conversationId).is('unpinned_at', null).order('created_at', { ascending: false })) as Pin[],
  toggle: async (messageId: string) => must(await supabase.rpc('toggle_pin', { p_message: messageId })) as boolean,
};

export const todoApi = {
  items: async (messageId: string) =>
    must(await supabase.from('todo_items').select('id,message_id,text,done_by,done_at,created_by,created_at').eq('message_id', messageId).is('removed_at', null).order('created_at')) as TodoItem[],
  add: async (messageId: string, text: string) => must(await supabase.rpc('todo_add', { p_message: messageId, p_text: text })) as string,
  toggle: async (id: string) => must(await supabase.rpc('todo_toggle', { p_item: id })) as boolean,
  remove: async (id: string) => void must(await supabase.rpc('todo_remove', { p_item: id })),
};

export const reminderApi = {
  create: async (messageId: string, at: Date) => must(await supabase.rpc('remind_message', { p_message: messageId, p_at: at.toISOString() })) as string,
};

/** Reminder quick picks, computed from "now" (local time). */
export function reminderChoices(now = new Date()) {
  const at = (d: Date, h: number, m = 0) => {
    const x = new Date(d);
    x.setHours(h, m, 0, 0);
    return x;
  };
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tonight = at(now, 20);
  const monday = new Date(now);
  monday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  return [
    { label: 'In 1 hour', at: new Date(now.getTime() + 3600_000) },
    ...(tonight.getTime() - now.getTime() > 30 * 60_000 ? [{ label: 'Tonight, 8 PM', at: tonight }] : []),
    { label: 'Tomorrow, 9 AM', at: at(tomorrow, 9) },
    { label: 'Next Monday, 9 AM', at: at(monday, 9) },
  ];
}

const URL_RE = /\bhttps?:\/\/[^\s<>"')]+[^\s<>"').,!?;:]/i;
/** First web link in a message, or null. */
export function firstLink(text: string | null | undefined): string | null {
  if (!text || text.startsWith('e2e:')) return null;
  return text.match(URL_RE)?.[0] ?? null;
}

const previewCache = new Map<string, Promise<LinkPreview | null>>();
export function linkPreview(url: string): Promise<LinkPreview | null> {
  let p = previewCache.get(url);
  if (!p) {
    p = supabase.functions
      .invoke('link-preview', { body: { url } })
      .then(({ data, error }) => (error || !data?.ok ? null : (data as LinkPreview)))
      .catch(() => null);
    previewCache.set(url, p);
  }
  return p;
}
