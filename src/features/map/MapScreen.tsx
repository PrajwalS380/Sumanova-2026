import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Ghost, Loader2, LocateFixed, MapPin, Navigation, ShieldCheck } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { friendsApi } from '@/lib/chat/api';
import type { Friend } from '@/lib/chat/types';
import { AURA } from '@/lib/types';
import { lastSeenLabel } from '@/lib/chat/time';
import { cn } from '@/lib/cn';
import { distanceM, getPosition, mapApi, type FriendLocation, type MyShare } from './api';

const DURATIONS = [{ m: 15, l: '15 min' }, { m: 60, l: '1 hour' }, { m: 480, l: '8 hours' }, { m: 1440, l: '24 hours' }];
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function pin(f: { display_name: string; avatar_url: string | null; aura_color: keyof typeof AURA }, live: boolean, me = false) {
  const a = AURA[f.aura_color] ?? AURA.violet;
  const initials = escape(f.display_name.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase());
  const img = f.avatar_url && /^https:\/\//.test(f.avatar_url) ? `<img src="${escape(f.avatar_url)}" style="width:100%;height:100%;object-fit:cover;border-radius:999px"/>` : `<span style="font:700 15px Unbounded Variable,sans-serif;color:${a.to}">${initials}</span>`;
  return L.divIcon({
    className: '',
    iconSize: [54, 64],
    iconAnchor: [27, 60],
    html: `<div class="snv-pin${live ? ' live' : ''}${me ? ' me' : ''}" style="--a:${a.from};--b:${a.to}"><div class="snv-pin-ring"><div class="snv-pin-face">${img}</div></div><div class="snv-pin-tail"></div></div>`,
  });
}

export default function MapScreen() {
  const { privacy, setPrivacy, profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const myMarker = useRef<L.Marker | null>(null);
  const [friendsOnMap, setFriendsOnMap] = useState<FriendLocation[]>([]);
  const [mine, setMine] = useState<MyShare | null>(null);
  const [sheet, setSheet] = useState(false);
  const [selected, setSelected] = useState<FriendLocation | null>(null);
  const [minutes, setMinutes] = useState(60);
  const [precise, setPrecise] = useState(false);
  const [audience, setAudience] = useState<'friends' | 'selected'>('friends');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [friends, setFriends] = useState<Friend[]>([]);
  const [busy, setBusy] = useState(false);
  const sharing = !!mine && new Date(mine.expires_at) > new Date();

  // Init map once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, worldCopyJump: true }).setView([20.6, 78.9], 4);
    // CARTO dark basemap (OpenStreetMap data) — free with attribution for light use.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      setFriendsOnMap(await mapApi.friends());
    } catch {
      /* offline: keep last */
    }
  }, []);

  useEffect(() => {
    void loadFriends();
    void mapApi.mine().then(setMine).catch(() => undefined);
    void friendsApi.list().then(setFriends).catch(() => undefined);
    const t = setInterval(() => !document.hidden && void loadFriends(), 30_000);
    return () => clearInterval(t);
  }, [loadFriends]);

  // Draw friend markers (diffed, so panning stays smooth).
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    for (const f of friendsOnMap) {
      seen.add(f.user_id);
      const live = Date.now() - new Date(f.updated_at).getTime() < 5 * 60_000;
      const existing = markers.current.get(f.user_id);
      if (existing) {
        existing.setLatLng([f.lat, f.lng]);
        existing.setIcon(pin(f, live));
      } else {
        const mk = L.marker([f.lat, f.lng], { icon: pin(f, live) }).addTo(m).on('click', () => setSelected(f));
        markers.current.set(f.user_id, mk);
      }
    }
    for (const [id, mk] of markers.current) {
      if (!seen.has(id)) {
        mk.remove();
        markers.current.delete(id);
      }
    }
  }, [friendsOnMap]);

  // My own pin while sharing.
  useEffect(() => {
    const m = map.current;
    if (!m || !profile) return;
    if (sharing && mine) {
      if (!myMarker.current) myMarker.current = L.marker([mine.lat, mine.lng], { icon: pin(profile, true, true), zIndexOffset: 1000 }).addTo(m);
      else myMarker.current.setLatLng([mine.lat, mine.lng]);
    } else {
      myMarker.current?.remove();
      myMarker.current = null;
    }
  }, [sharing, mine, profile]);

  // While sharing and the screen is open: refresh position at most every 45 s or 50 m. Never in the background.
  useEffect(() => {
    if (!sharing || !('geolocation' in navigator)) return;
    let last = { lat: mine!.lat, lng: mine!.lng, t: Date.now() };
    const id = navigator.geolocation.watchPosition(async (p) => {
      if (document.hidden) return;
      const cur = { lat: p.coords.latitude, lng: p.coords.longitude };
      if (Date.now() - last.t < 45_000 && distanceM(last, cur) < 50) return;
      last = { ...cur, t: Date.now() };
      const exp = await mapApi.update(cur.lat, cur.lng, p.coords.accuracy).catch(() => null);
      if (!exp) setMine(null);
      else setMine((s) => (s ? { ...s, ...cur, updated_at: new Date().toISOString() } : s));
    }, () => undefined, { enableHighAccuracy: true, maximumAge: 20_000 });
    // Auto-stop exactly when the chosen duration ends.
    const ms = new Date(mine!.expires_at).getTime() - Date.now();
    const stopT = setTimeout(() => {
      setMine(null);
      toast('Location sharing ended', 'info');
    }, Math.max(0, ms));
    return () => {
      navigator.geolocation.clearWatch(id);
      clearTimeout(stopT);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharing, mine?.expires_at]);

  async function locate() {
    try {
      const p = await getPosition();
      map.current?.flyTo([p.coords.latitude, p.coords.longitude], 14, { duration: 0.8 });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  async function start() {
    setBusy(true);
    try {
      const p = await getPosition();
      await mapApi.start({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, minutes, precise, audience, friends: [...picked] });
      setMine(await mapApi.mine());
      if (privacy) setPrivacy({ ...privacy, ghost_mode: false });
      map.current?.flyTo([p.coords.latitude, p.coords.longitude], 14, { duration: 0.8 });
      setSheet(false);
      toast(`Sharing ${precise ? 'your exact' : 'your approximate'} location for ${DURATIONS.find((d) => d.m === minutes)?.l}`, 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      await mapApi.stop();
      setMine(null);
      if (privacy) setPrivacy({ ...privacy, ghost_mode: true });
      toast('Ghost mode on — you’re hidden', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const left = sharing ? Math.max(0, Math.round((new Date(mine!.expires_at).getTime() - Date.now()) / 60000)) : 0;

  return (
    <div className="fixed inset-0 bg-night">
      <div ref={el} className="absolute inset-0 z-0" aria-label="Map" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] bg-gradient-to-b from-night/90 to-transparent px-4 pb-10 pt-safe">
        <div className="pointer-events-auto flex items-center gap-2">
          <h1 className="flex-1 font-display text-2xl font-semibold drop-shadow">Map</h1>
          <button onClick={() => void locate()} className="glass grid h-11 w-11 place-items-center rounded-full" aria-label="Find me"><LocateFixed className="h-5 w-5" /></button>
        </div>
        <div className="pointer-events-auto mt-3 flex items-center gap-2">
          <span className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold', sharing ? 'bg-aurora-teal/20 text-aurora-mint' : 'bg-white/10 text-ink-soft')}>
            {sharing ? <Navigation className="h-3.5 w-3.5" /> : <Ghost className="h-3.5 w-3.5" />}
            {sharing ? `Sharing · ${left >= 60 ? `${Math.round(left / 60)}h` : `${left}m`} left` : 'Ghost mode'}
          </span>
          <span className="text-xs text-ink-mute">{friendsOnMap.length} {friendsOnMap.length === 1 ? 'friend' : 'friends'} sharing</span>
        </div>
      </div>

      {friendsOnMap.length > 0 && (
        <div className="no-scrollbar absolute inset-x-0 bottom-48 z-[500] flex gap-2 overflow-x-auto px-4">
          {friendsOnMap.map((f) => (
            <button key={f.user_id} onClick={() => { map.current?.flyTo([f.lat, f.lng], 15, { duration: 0.8 }); setSelected(f); }} className="glass-strong flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3">
              <Avatar name={f.display_name} url={f.avatar_url} aura={f.aura_color} size={30} ring={false} />
              <span className="text-xs font-semibold">{f.display_name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-28 z-[500] flex justify-center px-4">
        {sharing ? (
          <button onClick={() => void stop()} disabled={busy} className="glass-strong flex h-14 items-center gap-2 rounded-full px-6 font-semibold">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Ghost className="h-5 w-5" /> Stop sharing</>}
          </button>
        ) : (
          <button onClick={() => setSheet(true)} className="flex h-14 items-center gap-2 rounded-full bg-aurora-gradient px-6 font-semibold shadow-glow">
            <MapPin className="h-5 w-5" /> Share my location
          </button>
        )}
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Share location">
        <div className="space-y-4 px-5 pb-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">For</p>
            <div className="grid grid-cols-4 gap-2">
              {DURATIONS.map((d) => (
                <button key={d.m} onClick={() => setMinutes(d.m)} className={cn('rounded-2xl py-2.5 text-sm', minutes === d.m ? 'bg-white font-semibold text-night' : 'bg-white/5 ring-1 ring-white/10')}>{d.l}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">With</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setAudience('friends')} className={cn('rounded-2xl py-2.5 text-sm', audience === 'friends' ? 'bg-white font-semibold text-night' : 'bg-white/5 ring-1 ring-white/10')}>All friends</button>
              <button onClick={() => setAudience('selected')} className={cn('rounded-2xl py-2.5 text-sm', audience === 'selected' ? 'bg-white font-semibold text-night' : 'bg-white/5 ring-1 ring-white/10')}>Choose friends</button>
            </div>
            {audience === 'selected' && (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {friends.map((f) => {
                  const on = picked.has(f.id);
                  return (
                    <li key={f.id}>
                      <button onClick={() => setPicked((s) => { const n = new Set(s); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })} className={cn('flex w-full items-center gap-3 rounded-2xl p-2 text-left', on ? 'bg-white/10' : '')}>
                        <Avatar name={f.display_name} url={f.avatar_url} aura={f.aura_color} size={34} />
                        <span className="flex-1 text-sm">{f.display_name}</span>
                        {on && <Check className="h-4 w-4 text-aurora-mint" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="glass overflow-hidden rounded-2xl">
            <Toggle label="Precise location" description={precise ? 'Friends see your exact spot' : 'Friends see roughly where you are (about 1 km)'} checked={precise} onChange={setPrecise} />
          </div>
          <p className="flex gap-2 text-xs text-ink-mute"><ShieldCheck className="h-4 w-4 shrink-0 text-aurora-mint" /> Updates only while SUMANOVA is open — never in the background. Sharing stops automatically when time is up, and you can stop anytime.</p>
          <button onClick={() => void start()} disabled={busy || (audience === 'selected' && picked.size === 0)} className="flex h-14 w-full items-center justify-center gap-2 rounded-[1.25rem] bg-aurora-gradient font-semibold shadow-glow disabled:opacity-50">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Start sharing'}
          </button>
        </div>
      </Sheet>

      <Sheet open={!!selected} onClose={() => setSelected(null)}>
        {selected && (
          <div className="flex items-center gap-3 px-5 pb-6">
            <Avatar name={selected.display_name} url={selected.avatar_url} aura={selected.aura_color} size={52} />
            <div className="flex-1">
              <p className="font-semibold">{selected.display_name}</p>
              <p className="text-xs text-ink-mute">{lastSeenLabel(selected.updated_at).replace('Active', 'Updated')} · {selected.precise ? 'precise' : 'approximate'}</p>
            </div>
            <button onClick={() => navigate(`/u/${selected.username}`)} className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">Profile</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
