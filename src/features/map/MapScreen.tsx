import { MeButton } from '@/components/MeButton';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Ghost, Loader2, LocateFixed, Navigation, Search, ShieldCheck, Sun, Users } from 'lucide-react';
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
import { Ghost as GhostLayer } from '@/components/ui/Ghost';
import { distanceM, getPosition, mapApi, type FriendLocation, type MyShare } from './api';

const DURATIONS = [{ m: 15, l: '15 min' }, { m: 60, l: '1 hour' }, { m: 480, l: '8 hours' }, { m: 1440, l: '24 hours' }];
const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Map pin: the person's full-body avatar standing on the map with a "Name · time" tag (face circle if no body picture yet). */
function pin(f: { display_name: string; avatar_url: string | null; avatar_body_url?: string | null; aura_color: keyof typeof AURA }, tag: string, me = false) {
  const a = AURA[f.aura_color] ?? AURA.violet;
  const initials = escape(f.display_name.split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase());
  const ok = (u?: string | null) => !!u && /^https:\/\//.test(u);
  const figure = ok(f.avatar_body_url)
    ? `<img src="${escape(f.avatar_body_url!)}" alt="" style="height:${me ? 110 : 96}px;width:auto;display:block"/>`
    : `<div class="snv-pin-face" style="width:52px;height:52px">${ok(f.avatar_url) ? `<img src="${escape(f.avatar_url!)}" alt="" style="width:100%;height:100%;object-fit:cover"/>` : `<span style="font:600 18px 'Instrument Serif',serif;font-style:italic;color:${a.from}">${initials}</span>`}</div>`;
  const h = ok(f.avatar_body_url) ? (me ? 132 : 118) : 76;
  return L.divIcon({
    className: '',
    iconSize: [110, h],
    iconAnchor: [55, h],
    html: `<div class="snv-fig">${figure}<span class="snv-tag${me ? ' me' : ''}">${escape(tag)}</span></div>`,
  });
}

const WHITE = 'grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-ink shadow-[0_8px_20px_-12px_rgba(17,17,17,0.5)] active:scale-90';
const CHIP = 'relative isolate flex h-[96px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[22px] bg-white text-xs font-extrabold text-ink shadow-[0_8px_20px_-12px_rgba(17,17,17,0.45)] disabled:opacity-60';
const ROUND = 'grid h-12 w-12 place-items-center rounded-2xl bg-[#F1F1F4] text-ink';

function tagFor(f: FriendLocation, live: boolean) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(f.updated_at).getTime()) / 60000));
  const when = live && mins < 1 ? 'now' : mins < 60 ? `${mins}m` : `${Math.round(mins / 60)}h`;
  return `${f.display_name.split(' ')[0]} · ${when}`;
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
  const [finder, setFinder] = useState(false);
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
    // OpenStreetMap standard tiles: free, no API key (CARTO began requiring one).
    // Light use only, per the OSM tile usage policy; attribution is required.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
        existing.setIcon(pin(f, tagFor(f, live)));
      } else {
        const mk = L.marker([f.lat, f.lng], { icon: pin(f, tagFor(f, live)) }).addTo(m).on('click', () => setSelected(f));
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
      if (!myMarker.current) myMarker.current = L.marker([mine.lat, mine.lng], { icon: pin(profile, 'You', true), zIndexOffset: 1000 }).addTo(m);
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
    <div className="fixed inset-0 bg-[#E4E8E3]">
      <div ref={el} className="absolute inset-0 z-0" aria-label="Map" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-center gap-2 px-3.5 pt-safe">
        <span className="pointer-events-auto"><MeButton size={44} className="rounded-2xl" /></span>
        <button onClick={() => setFinder(true)} aria-label="Find a friend on the map" className={cn(WHITE, 'pointer-events-auto')}><Search className="h-5 w-5" /></button>
        <div className="flex flex-1 justify-center">
          <span className="pointer-events-auto rounded-2xl bg-white px-4 py-[11px] text-sm font-extrabold shadow-[0_8px_20px_-12px_rgba(17,17,17,0.5)]">
            {sharing ? `Sharing · ${left >= 60 ? `${Math.round(left / 60)}h` : `${left}m`} left` : 'Ghost mode'}
          </span>
        </div>
        <button onClick={() => setSheet(true)} aria-label="Location settings" className={cn(WHITE, 'pointer-events-auto')}><Sun className="h-5 w-5" /></button>
      </header>
      <button onClick={() => void locate()} aria-label="Centre on me" className={cn(WHITE, 'absolute right-3.5 z-[500] bottom-[calc(84px+var(--safe-bottom)+8.25rem)]')}><Navigation className="h-5 w-5" /></button>

      {/* Bottom card (wireframe 5): My status · Friends · Find me · Ghost mode */}
      <div className="absolute inset-x-3.5 bottom-[calc(84px+var(--safe-bottom)+0.75rem)] z-[500] grid grid-cols-4 gap-2">
        <button onClick={() => (sharing ? setSheet(true) : setSheet(true))} className={CHIP}>
          <GhostLayer url={profile?.avatar_url} size={90} className="-bottom-7 -right-6 top-auto" />
          <Avatar name={profile?.display_name ?? 'Me'} url={profile?.avatar_url} aura={profile?.aura_color} size={48} ring={sharing} />
          {sharing ? `${left >= 60 ? `${Math.round(left / 60)}h` : `${left}m`} left` : 'My status'}
        </button>
        <button onClick={() => setFinder(true)} className={CHIP}>
          <GhostLayer url={friendsOnMap[0]?.avatar_url} size={90} className="-bottom-7 -right-6 top-auto" />
          {friendsOnMap[0] ? <Avatar name={friendsOnMap[0].display_name} url={friendsOnMap[0].avatar_url} aura={friendsOnMap[0].aura_color} size={48} /> : <span className={ROUND}><Users className="h-[22px] w-[22px]" /></span>}
          Friends · {friendsOnMap.length}
        </button>
        <button onClick={() => void locate()} className={CHIP}>
          <GhostLayer size={86} className="-bottom-6 -right-5 top-auto"><LocateFixed className="h-full w-full" strokeWidth={1.4} /></GhostLayer>
          <span className={cn(ROUND, 'bg-ember-rose text-white')}><LocateFixed className="h-[22px] w-[22px]" /></span>
          Find me
        </button>
        <button onClick={() => (sharing ? void stop() : setSheet(true))} disabled={busy} className={CHIP} aria-pressed={!sharing}>
          <GhostLayer size={86} className="-bottom-6 -right-5 top-auto"><Ghost className="h-full w-full" strokeWidth={1.4} /></GhostLayer>
          <span className={cn(ROUND, !sharing && 'bg-ink text-white')}>{busy ? <Loader2 className="h-[22px] w-[22px] animate-spin" /> : <Ghost className="h-[22px] w-[22px]" />}</span>
          {sharing ? 'Go ghost' : 'Ghost mode'}
        </button>
      </div>

      <Sheet open={finder} onClose={() => setFinder(false)} title="Friends on the map">
        <ul className="space-y-1 px-4 pb-6">
          {friendsOnMap.length === 0 && <li className="px-1 py-3 text-sm text-ink-mute">No friends are sharing right now.</li>}
          {friendsOnMap.map((f) => (
            <li key={f.user_id}>
              <button onClick={() => { setFinder(false); map.current?.flyTo([f.lat, f.lng], 15, { duration: 0.8 }); setSelected(f); }} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left active:bg-ink/[0.05]">
                <Avatar name={f.display_name} url={f.avatar_url} aura={f.aura_color} size={44} />
                <span className="flex-1"><span className="block font-extrabold">{f.display_name}</span><span className="text-xs text-ink-mute">{lastSeenLabel(f.updated_at).replace('Active', 'Updated')}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Share location">
        <div className="space-y-4 px-5 pb-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">For</p>
            <div className="grid grid-cols-4 gap-2">
              {DURATIONS.map((d) => (
                <button key={d.m} onClick={() => setMinutes(d.m)} className={cn('rounded-2xl py-2.5 text-sm', minutes === d.m ? 'bg-[#111111] font-extrabold text-white' : 'bg-ink/5 ring-1 ring-ink/10')}>{d.l}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">With</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setAudience('friends')} className={cn('rounded-2xl py-2.5 text-sm', audience === 'friends' ? 'bg-[#111111] font-extrabold text-white' : 'bg-ink/5 ring-1 ring-ink/10')}>All friends</button>
              <button onClick={() => setAudience('selected')} className={cn('rounded-2xl py-2.5 text-sm', audience === 'selected' ? 'bg-[#111111] font-extrabold text-white' : 'bg-ink/5 ring-1 ring-ink/10')}>Choose friends</button>
            </div>
            {audience === 'selected' && (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {friends.map((f) => {
                  const on = picked.has(f.id);
                  return (
                    <li key={f.id}>
                      <button onClick={() => setPicked((s) => { const n = new Set(s); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })} className={cn('flex w-full items-center gap-3 rounded-2xl p-2 text-left', on ? 'bg-ink/10' : '')}>
                        <Avatar name={f.display_name} url={f.avatar_url} aura={f.aura_color} size={34} />
                        <span className="flex-1 text-sm">{f.display_name}</span>
                        {on && <Check className="h-4 w-4 text-ember-sage" />}
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
          <p className="flex gap-2 text-xs text-ink-mute"><ShieldCheck className="h-4 w-4 shrink-0 text-ember-sage" /> Updates only while SUMANOVA is open — never in the background. Sharing stops automatically when time is up, and you can stop anytime.</p>
          <button onClick={() => void start()} disabled={busy || (audience === 'selected' && picked.size === 0)} className="flex h-14 w-full items-center justify-center gap-2 rounded-[1.25rem] bg-ember-gradient text-noir font-semibold shadow-glow disabled:opacity-50">
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
            <button onClick={() => navigate(`/u/${selected.username}`)} className="rounded-2xl bg-[#111111] px-4 py-2 text-sm font-extrabold text-white">Profile</button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
