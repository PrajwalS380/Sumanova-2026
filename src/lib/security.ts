import { supabase } from './supabase';
import { platform } from './platform';

/** A stable random id for this install (identifies "this device" in the device list). */
export function deviceKey(): string {
  try {
    let k = localStorage.getItem('snv-device-key');
    if (!k) {
      k = crypto.randomUUID().replace(/-/g, '');
      localStorage.setItem('snv-device-key', k);
    }
    return k;
  } catch {
    return 'unknown-device-key';
  }
}

/** Human label like "Android phone · SUMANOVA app" or "Windows · Chrome". */
export function deviceLabel(ua = navigator.userAgent): string {
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iOS/i.test(ua) ? 'iPhone' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X|Macintosh/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Device';
  if (platform !== 'web') return `${os} · SUMANOVA app`;
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${os} · ${browser}`;
}

/** Session id from the access token (changes on every new sign-in). */
export function sessionIdOf(accessToken: string): string | null {
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { session_id?: string };
    return payload.session_id ?? null;
  } catch {
    return null;
  }
}

/** Report each new sign-in once (server alerts on unknown devices). */
export async function reportLoginOnce(uid: string, accessToken: string) {
  const sid = sessionIdOf(accessToken);
  if (!sid) return;
  const key = `snv-login-${uid}`;
  try {
    if (localStorage.getItem(key) === sid) return;
  } catch {
    /* storage blocked */
  }
  const { error } = await supabase.rpc('report_login', { p_device: deviceLabel(), p_platform: platform, p_device_key: deviceKey() });
  if (!error) {
    try {
      localStorage.setItem(key, sid);
    } catch {
      /* storage blocked */
    }
  }
}

export interface DeviceRow { device_key: string; device: string; platform: string; last_seen: string; first_seen: string; sign_ins: number }
export const securityApi = {
  devices: async () => {
    const { data, error } = await supabase.rpc('my_devices');
    if (error) throw new Error(error.message);
    return (data ?? []) as DeviceRow[];
  },
  signOutOthers: async () => {
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) throw new Error(error.message);
  },
  /** Two-step login state. */
  async mfa() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw new Error(error.message);
    return data.totp.filter((f) => f.status === 'verified');
  },
};

/** Everything we hold about you, as one JSON file (data download). */
export async function exportMyData(uid: string): Promise<Blob> {
  const pick = async (table: string, q: (b: ReturnType<typeof supabase.from>) => PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
    const r = await q(supabase.from(table));
    return r.error ? { error: r.error.message } : r.data;
  };
  const [profile, settings, privacy, friends, stories, memories, messages, devices, stats, spotlight, phone] = await Promise.all([
    pick('profiles', (t) => t.select('*').eq('id', uid).maybeSingle()),
    pick('user_settings', (t) => t.select('date_of_birth,reduce_motion,haptics,default_snap_seconds,chat_wallpaper,interests,created_at').eq('user_id', uid).maybeSingle()),
    pick('privacy_settings', (t) => t.select('*').eq('user_id', uid).maybeSingle()),
    supabase.rpc('list_friends').then((r) => r.data ?? []),
    pick('stories', (t) => t.select('id,kind,text_body,audience,created_at,expires_at,media_meta').eq('user_id', uid).order('created_at', { ascending: false }).limit(1000)),
    pick('memories', (t) => t.select('id,kind,taken_at,media_meta,favourite,archived,private').eq('user_id', uid).is('deleted_at', null).limit(5000)),
    pick('messages', (t) => t.select('id,conversation_id,kind,body,created_at,edited_at').eq('sender_id', uid).is('deleted_at', null).order('created_at', { ascending: false }).limit(5000)),
    supabase.rpc('my_devices').then((r) => r.data ?? []),
    pick('user_stats', (t) => t.select('*').eq('user_id', uid).maybeSingle()),
    pick('spotlight_videos', (t) => t.select('id,caption,category,created_at,like_count,view_count,comment_count').eq('user_id', uid)),
    pick('phone_numbers', (t) => t.select('last4,updated_at').eq('user_id', uid).maybeSingle()),
  ]);
  const doc = {
    exported_at: new Date().toISOString(),
    note: 'Your SUMANOVA data. Photos and videos stay in your Memories; this file lists them. Messages are the ones you sent (up to 5,000 most recent). My Eyes Only items are listed but stay encrypted.',
    profile, settings, privacy, phone, friends, stories, memories, messages_sent: messages, devices, snap_stats: stats, spotlight,
  };
  return new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
}
