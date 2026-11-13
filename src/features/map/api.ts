import { supabase } from '@/lib/supabase';
import { friendlyDbError } from '@/lib/chat/api';
import type { AuraColor } from '@/lib/types';

export interface FriendLocation {
  user_id: string; username: string; display_name: string; avatar_url: string | null; aura_color: AuraColor;
  lat: number; lng: number; precise: boolean; updated_at: string; expires_at: string;
}
export interface MyShare { lat: number; lng: number; precise: boolean; audience: 'friends' | 'selected'; targets: string[]; expires_at: string; updated_at: string }

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(friendlyDbError(r.error.message));
  return r.data as T;
}

export const mapApi = {
  friends: async () => must(await supabase.rpc('friend_locations')) as FriendLocation[],
  mine: async () => must(await supabase.from('location_shares').select('lat,lng,precise,audience,targets,expires_at,updated_at').maybeSingle()) as MyShare | null,
  start: async (p: { lat: number; lng: number; accuracy: number; minutes: number; precise: boolean; audience: 'friends' | 'selected'; friends: string[] }) =>
    must(await supabase.rpc('share_location', { p_lat: p.lat, p_lng: p.lng, p_accuracy: p.accuracy, p_minutes: p.minutes, p_precise: p.precise, p_audience: p.audience, p_friends: p.friends, p_new_session: true })) as string,
  update: async (lat: number, lng: number, accuracy: number) =>
    must(await supabase.rpc('share_location', { p_lat: lat, p_lng: lng, p_accuracy: accuracy, p_minutes: null, p_precise: null, p_audience: null, p_friends: null, p_new_session: false })) as string | null,
  stop: async () => must(await supabase.rpc('stop_sharing_location')),
};

/** One-shot position with a friendly error. */
export function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Location isn’t available on this device'));
    navigator.geolocation.getCurrentPosition(resolve, (e) => reject(new Error(e.code === 1 ? 'Location permission is off — allow it in settings to share' : 'Couldn’t get your location. Try again outdoors or with GPS on.')), { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
}

/** Distance in metres (haversine) — used to throttle position updates. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
