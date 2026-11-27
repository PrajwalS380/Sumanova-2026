import { supabase } from '@/lib/supabase';

/** Map batch E: favourite places, trips, memories on the map (all private to you). */
const must = <T,>(r: { data: T; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

export interface FavPlace { id: string; name: string; emoji: string; lat: number; lng: number; created_at: string }
export interface Trip { id: string; title: string; started_at: string; ended_at: string | null }
export interface TripPoint { lat: number; lng: number; at: string }

export const placesApi = {
  list: async () => must(await supabase.from('favourite_places').select('id,name,emoji,lat,lng,created_at').is('removed_at', null).order('created_at', { ascending: false }).limit(200)) as FavPlace[],
  add: async (uid: string, p: { name: string; emoji: string; lat: number; lng: number }) =>
    must(await supabase.from('favourite_places').insert({ user_id: uid, ...p }).select('id,name,emoji,lat,lng,created_at').single()) as FavPlace,
  remove: async (id: string) => void must(await supabase.from('favourite_places').update({ removed_at: new Date().toISOString() }).eq('id', id)),
};

export const tripsApi = {
  list: async () => must(await supabase.from('trips').select('id,title,started_at,ended_at').is('removed_at', null).order('started_at', { ascending: false }).limit(50)) as Trip[],
  points: async (id: string) => must(await supabase.from('trip_points').select('lat,lng,at').eq('trip_id', id).order('at').limit(2000)) as TripPoint[],
  start: async (title: string) => must(await supabase.rpc('start_trip', { p_title: title })) as string,
  end: async (id: string) => void must(await supabase.rpc('end_trip', { p_trip: id })),
  remove: async (id: string) => void must(await supabase.rpc('remove_trip', { p_trip: id })),
  point: async (id: string, lat: number, lng: number) => must(await supabase.rpc('add_trip_point', { p_trip: id, p_lat: lat, p_lng: lng })) as boolean,
};

/** Great-circle distance in km along the points. */
export function tripKm(pts: { lat: number; lng: number }[]) {
  let d = 0;
  const R = 6371, rad = Math.PI / 180;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    d += 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  return d;
}

// ---- trip recording (while the app is open) ----
const TRIP_KEY = 'snv-active-trip';
export function activeTrip(): { id: string; title: string } | null {
  try {
    return JSON.parse(localStorage.getItem(TRIP_KEY) || 'null');
  } catch {
    return null;
  }
}
export function setActiveTrip(t: { id: string; title: string } | null) {
  try {
    if (t) localStorage.setItem(TRIP_KEY, JSON.stringify(t));
    else localStorage.removeItem(TRIP_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event('snv-trip'));
}

/** Records a point about once a minute while a trip is on and the app is visible. Returns a stop function. */
export function startTripRecorder(): () => void {
  let watch: number | null = null;
  let last = 0;
  const run = () => {
    const t = activeTrip();
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null;
    if (!t || document.hidden || !('geolocation' in navigator)) return;
    watch = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - last < 60_000) return;
        last = Date.now();
        void tripsApi.point(t.id, p.coords.latitude, p.coords.longitude).catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 30_000 },
    );
  };
  run();
  document.addEventListener('visibilitychange', run);
  window.addEventListener('snv-trip', run);
  return () => {
    document.removeEventListener('visibilitychange', run);
    window.removeEventListener('snv-trip', run);
    if (watch !== null) navigator.geolocation.clearWatch(watch);
  };
}

// ---- memories on the map ----
const MEM_KEY = 'snv-mem-place';
export const memPlaceOn = () => {
  try {
    return localStorage.getItem(MEM_KEY) === '1';
  } catch {
    return false;
  }
};
export function setMemPlace(on: boolean) {
  try {
    localStorage.setItem(MEM_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
/** Where a memory was saved (rounded to ~100 m), when the person turned it on. Never blocks saving. */
export function memoryPlace(): Promise<{ lat: number; lng: number } | null> {
  if (!memPlaceOn() || !('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((res) => {
    const t = setTimeout(() => res(null), 5000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); res({ lat: Math.round(p.coords.latitude * 1000) / 1000, lng: Math.round(p.coords.longitude * 1000) / 1000 }); },
      () => { clearTimeout(t); res(null); },
      { enableHighAccuracy: false, maximumAge: 600_000, timeout: 4500 },
    );
  });
}
export interface MapMemory { id: string; kind: 'image' | 'video'; media_path: string; taken_at: string; media_meta: { place?: { lat: number; lng: number } } }
export const mapMemoriesApi = {
  list: async () =>
    must(await supabase.from('memories').select('id,kind,media_path,taken_at,media_meta').not('media_meta->place', 'is', null).eq('private', false).is('deleted_at', null).order('taken_at', { ascending: false }).limit(300)) as MapMemory[],
};
