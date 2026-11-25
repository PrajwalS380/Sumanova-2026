import { supabase } from '@/lib/supabase';
import { friendlyDbError } from '@/lib/chat/api';
import type { AuraColor } from '@/lib/types';

export interface FriendLocation {
  user_id: string; username: string; display_name: string; avatar_url: string | null; avatar_body_url?: string | null; aura_color: AuraColor;
  lat: number; lng: number; precise: boolean; updated_at: string; expires_at: string;
  /** Battery % (only if they allow it) and travel status from their last updates. */
  battery?: number | null; motion?: 'still' | 'walking' | 'driving' | 'flying' | null;
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
    must(await supabase.rpc('share_location', { p_lat: p.lat, p_lng: p.lng, p_accuracy: p.accuracy, p_minutes: p.minutes, p_precise: p.precise, p_audience: p.audience, p_friends: p.friends, p_new_session: true, p_battery: await batteryLevel() })) as string,
  update: async (lat: number, lng: number, accuracy: number) =>
    must(await supabase.rpc('share_location', { p_lat: lat, p_lng: lng, p_accuracy: accuracy, p_minutes: null, p_precise: null, p_audience: null, p_friends: null, p_new_session: false, p_battery: await batteryLevel() })) as string | null,
  /** Public-story heat in the current view. */
  heat: async (b: Bounds) => must(await supabase.rpc('story_heat', { p_south: b.south, p_west: b.west, p_north: b.north, p_east: b.east })) as { lat: number; lng: number; stories: number }[],
  near: async (lat: number, lng: number, radius: number) => must(await supabase.rpc('stories_near', { p_lat: lat, p_lng: lng, p_radius: radius })) as { story_id: string; user_id: string; created_at: string }[],
  /** ~1 km cells I've shared my location from. */
  explored: async (b: Bounds) =>
    must(await supabase.from('explored_cells').select('lat_i,lng_i').gte('lat_i', Math.floor(b.south * 100)).lte('lat_i', Math.ceil(b.north * 100)).gte('lng_i', Math.floor(b.west * 100)).lte('lng_i', Math.ceil(b.east * 100)).limit(3000)) as { lat_i: number; lng_i: number }[],
  exploredCount: async () => {
    const { count, error } = await supabase.from('explored_cells').select('lat_i', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    return count ?? 0;
  },
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

export interface Bounds { south: number; west: number; north: number; east: number }

/** Battery level 0–100 where the browser/app exposes it (Android), else null. */
export async function batteryLevel(): Promise<number | null> {
  try {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> };
    if (!nav.getBattery) return null;
    return Math.round((await nav.getBattery()).level * 100);
  } catch {
    return null;
  }
}

export const MOTION_LABEL: Record<string, string> = { walking: 'walking', driving: 'on the move', flying: 'travelling far' };

/** OpenStreetMap places (cafés, parks, sights…) in view, via the free Overpass API. */
export interface Place { id: number; lat: number; lng: number; name: string; kind: string }
export async function placesIn(b: Bounds, signal?: AbortSignal): Promise<Place[]> {
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  const q = `[out:json][timeout:15];(node["name"]["amenity"~"cafe|restaurant|fast_food|ice_cream|bar|cinema|library|college|university"](${bbox});node["name"]["leisure"~"park|garden|stadium|sports_centre"](${bbox});node["name"]["tourism"~"attraction|museum|viewpoint|zoo|gallery"](${bbox});node["name"]["shop"="mall"](${bbox}););out 80;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: q }), signal });
  if (!res.ok) throw new Error('Places are busy right now — try again in a moment');
  const json = (await res.json()) as { elements: { id: number; lat: number; lon: number; tags: Record<string, string> }[] };
  return json.elements.map((e) => ({ id: e.id, lat: e.lat, lng: e.lon, name: e.tags.name, kind: (e.tags.amenity ?? e.tags.leisure ?? e.tags.tourism ?? e.tags.shop ?? 'place').replace(/_/g, ' ') }));
}
