import { supabase } from '@/lib/supabase';
import { distanceM, getPosition } from '@/features/map/api';

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---------- polls ----------
export interface PollVote { message_id: string; user_id: string; option: number }
export const pollApi = {
  votes: async (messageId: string) => must(await supabase.from('poll_votes').select('message_id,user_id,option').eq('message_id', messageId)) as PollVote[],
  vote: async (messageId: string, option: number) => must(await supabase.rpc('vote_poll', { p_message: messageId, p_option: option })),
};

/** Tally per option, my choice, and the total. */
export function tally(votes: PollVote[], options: number, me: string) {
  const counts = Array.from({ length: options }, () => 0);
  let mine: number | null = null;
  for (const v of votes) {
    if (v.option >= 0 && v.option < options) counts[v.option] += 1;
    if (v.user_id === me) mine = v.option;
  }
  return { counts, mine, total: votes.length };
}

// ---------- scheduled messages ----------
export interface Scheduled { id: string; conversation_id: string; body: string; send_at: string }
export const scheduleApi = {
  pending: async (conversationId: string) =>
    must(await supabase.from('scheduled_messages').select('id,conversation_id,body,send_at').eq('conversation_id', conversationId).is('sent_at', null).is('cancelled_at', null).order('send_at')) as Scheduled[],
  create: async (conversationId: string, body: string, at: Date) => must(await supabase.rpc('schedule_message', { p_conversation: conversationId, p_body: body, p_send_at: at.toISOString() })) as string,
  cancel: async (id: string) => must(await supabase.rpc('cancel_scheduled_message', { p_id: id })),
};

// ---------- screenshots ----------
export const reportChatScreenshot = async (conversationId: string) => must(await supabase.rpc('report_chat_screenshot', { p_conversation: conversationId }));

// ---------- location ----------
export { getPosition };

/** OpenStreetMap tile maths for the small map in a location card. */
export function tileFor(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x, y };
}

export const isLive = (meta: { live_until?: string }) => !!meta.live_until && new Date(meta.live_until).getTime() > Date.now();

/**
 * Live location: while the app is open, my pin in each live share follows me (throttled to
 * every 20 s or 25 m). Shares survive reloads (kept in localStorage) until they expire.
 * When the app is closed the pin stays where it was — the card says how old it is.
 */
interface Share { conversationId: string; clientId: string; until: number; messageId?: string }
const KEY = 'snv-live-shares';
function load(): Share[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) || '[]') as Share[]).filter((s) => s.until > Date.now());
  } catch {
    return [];
  }
}
function save(list: Share[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage blocked */
  }
}

let watchId: number | null = null;
let last: { lat: number; lng: number; at: number } | null = null;

async function resolveIds(list: Share[], me: string) {
  for (const s of list) {
    if (s.messageId) continue;
    const { data } = await supabase.from('messages').select('id').eq('client_id', s.clientId).eq('sender_id', me).maybeSingle();
    if (data?.id) s.messageId = data.id as string;
  }
  save(list);
}

function ensureWatching(me: string) {
  if (watchId !== null || !('geolocation' in navigator)) return;
  watchId = navigator.geolocation.watchPosition(
    async (p) => {
      const list = load();
      if (!list.length) return stopWatching();
      const here = { lat: p.coords.latitude, lng: p.coords.longitude };
      if (last && Date.now() - last.at < 20_000 && distanceM(last, here) < 25) return;
      last = { ...here, at: Date.now() };
      await resolveIds(list, me);
      for (const s of list) {
        if (!s.messageId) continue;
        const { data, error } = await supabase.rpc('update_live_location', { p_message: s.messageId, p_lat: here.lat, p_lng: here.lng, p_acc: p.coords.accuracy });
        if (error || data === false) s.until = 0; // ended or removed
      }
      save(list.filter((s) => s.until > Date.now()));
    },
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
  );
}
function stopWatching() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

export const liveShare = {
  start(me: string, conversationId: string, clientId: string, minutes: number) {
    save([...load(), { conversationId, clientId, until: Date.now() + minutes * 60_000 }]);
    ensureWatching(me);
  },
  async stop(messageId: string) {
    save(load().filter((s) => s.messageId !== messageId));
    must(await supabase.rpc('stop_live_location', { p_message: messageId }));
  },
  /** Call on app start: keeps following any shares that are still live. */
  resume(me: string) {
    if (load().length) ensureWatching(me);
  },
};
