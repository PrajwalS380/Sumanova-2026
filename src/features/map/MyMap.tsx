import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import L from 'leaflet';
import { Loader2, MapPin, Route, Star, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { activeTrip, mapMemoriesApi, memPlaceOn, placesApi, setActiveTrip, setMemPlace, tripKm, tripsApi, type FavPlace, type MapMemory, type Trip } from '@/lib/map/extras';
import { cn } from '@/lib/cn';

const ICONS = ['⭐', '🏠', '🏫', '💼', '☕', '🍕', '🏋️', '🌳', '❤️', '🎉'];
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * "My map": favourite places (long-press the map to save one), trip mode (records your route
 * about once a minute while the app is open) and your memories pinned where they were taken.
 * Everything here is private to you.
 */
export function MyMap({ map, onOpenMemory, buttonClass }: { map: MutableRefObject<L.Map | null>; onOpenMemory?: (m: MapMemory) => void; buttonClass: string }) {
  const { session } = useAuth();
  const me = session!.user.id;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState({ places: true, memories: false, trip: true });
  const [places, setPlaces] = useState<FavPlace[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [memories, setMemories] = useState<MapMemory[] | null>(null);
  const [running, setRunning] = useState(activeTrip);
  const [tripTitle, setTripTitle] = useState('');
  const [shownTrip, setShownTrip] = useState<{ trip: Trip; km: number; n: number } | null>(null);
  const [memPlace, setMemPlaceState] = useState(memPlaceOn);
  const [saveAt, setSaveAt] = useState<{ lat: number; lng: number } | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [placeIcon, setPlaceIcon] = useState('⭐');
  const groups = useRef<{ places: L.LayerGroup; memories: L.LayerGroup; trip: L.LayerGroup } | null>(null);

  // layer groups + long-press to save a place
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const g = { places: L.layerGroup().addTo(m), memories: L.layerGroup().addTo(m), trip: L.layerGroup().addTo(m) };
    groups.current = g;
    const onHold = (e: L.LeafletMouseEvent) => {
      setSaveAt({ lat: e.latlng.lat, lng: e.latlng.lng });
      setPlaceName('');
    };
    m.on('contextmenu', onHold);
    return () => {
      m.off('contextmenu', onHold);
      g.places.remove();
      g.memories.remove();
      g.trip.remove();
    };
  }, [map]);

  useEffect(() => {
    void placesApi.list().then(setPlaces).catch(() => undefined);
    void tripsApi.list().then(setTrips).catch(() => undefined);
    const on = () => setRunning(activeTrip());
    window.addEventListener('snv-trip', on);
    return () => window.removeEventListener('snv-trip', on);
  }, []);

  // favourite places
  useEffect(() => {
    const g = groups.current?.places;
    if (!g) return;
    g.clearLayers();
    if (!show.places) return;
    for (const p of places) {
      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: '', iconSize: [40, 40], iconAnchor: [20, 36], html: `<div style="display:grid;place-items:center;width:40px;height:40px;border-radius:14px;background:#fff;box-shadow:0 6px 16px -8px rgba(0,0,0,.6);font-size:22px">${esc(p.emoji)}</div>` }),
        title: p.name,
      }).bindTooltip(esc(p.name), { direction: 'top', offset: [0, -30] }).addTo(g);
    }
  }, [places, show.places]);

  // memories (thumbnails via short-lived signed links)
  useEffect(() => {
    if (!show.memories || memories) return;
    void mapMemoriesApi.list().then(setMemories).catch(() => setMemories([]));
  }, [show.memories, memories]);
  useEffect(() => {
    const g = groups.current?.memories;
    if (!g) return;
    g.clearLayers();
    if (!show.memories || !memories?.length) return;
    let alive = true;
    void (async () => {
      const imgs = memories.filter((m) => m.kind === 'image');
      const { data } = imgs.length ? await supabase.storage.from('memories').createSignedUrls(imgs.map((m) => m.media_path), 3600) : { data: [] };
      if (!alive) return;
      const urls = new Map((data ?? []).map((d, i) => [imgs[i].id, d.signedUrl]));
      for (const m of memories) {
        const pl = m.media_meta.place;
        if (!pl) continue;
        const u = urls.get(m.id);
        const html = u
          ? `<div style="width:46px;height:46px;border-radius:14px;border:3px solid #fff;box-shadow:0 6px 16px -8px rgba(0,0,0,.6);background:#ddd center/cover url('${u}')"></div>`
          : `<div style="display:grid;place-items:center;width:46px;height:46px;border-radius:14px;border:3px solid #fff;background:#111;color:#fff;font-size:20px">🎬</div>`;
        L.marker([pl.lat, pl.lng], { icon: L.divIcon({ className: '', iconSize: [46, 46], iconAnchor: [23, 23], html }) })
          .on('click', () => onOpenMemory?.(m))
          .addTo(g);
      }
    })();
    return () => {
      alive = false;
    };
  }, [memories, show.memories, onOpenMemory]);

  const drawTrip = useCallback(async (t: Trip) => {
    const g = groups.current?.trip;
    if (!g || !map.current) return;
    g.clearLayers();
    const pts = await tripsApi.points(t.id).catch(() => []);
    setShownTrip({ trip: t, km: tripKm(pts), n: pts.length });
    if (pts.length === 0) return toast('No route points yet — they’re added about once a minute while the app is open', 'info');
    const line = L.polyline(pts.map((p) => [p.lat, p.lng] as [number, number]), { color: '#FF4F9A', weight: 5, opacity: 0.9 }).addTo(g);
    L.circleMarker([pts[0].lat, pts[0].lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#12A577', fillOpacity: 1 }).addTo(g);
    L.circleMarker([pts[pts.length - 1].lat, pts[pts.length - 1].lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#111', fillOpacity: 1 }).addTo(g);
    map.current.fitBounds(line.getBounds(), { padding: [60, 60], maxZoom: 16 });
    setOpen(false);
  }, [map, toast]);

  async function startTrip() {
    const title = tripTitle.trim() || `Trip ${new Date().toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
    try {
      const id = await tripsApi.start(title);
      setActiveTrip({ id, title });
      setTripTitle('');
      setTrips(await tripsApi.list());
      toast('Trip started — your route is saved while SUMANOVA is open', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function stopTrip() {
    if (!running) return;
    try {
      await tripsApi.end(running.id);
      setActiveTrip(null);
      const list = await tripsApi.list();
      setTrips(list);
      const t = list.find((x) => x.id === running.id);
      if (t) void drawTrip(t);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  async function savePlace() {
    if (!saveAt || !placeName.trim()) return;
    try {
      const p = await placesApi.add(me, { name: placeName.trim().slice(0, 60), emoji: placeIcon, lat: saveAt.lat, lng: saveAt.lng });
      setPlaces((l) => [p, ...l]);
      setSaveAt(null);
      toast('Place saved', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="My map: places, trips, memories" className={cn(buttonClass, 'relative')}>
        <Star className="h-5 w-5" />
        {running && <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-ember-rose ring-2 ring-white" aria-label="Trip running" />}
      </button>
      {shownTrip && (
        <div className="absolute inset-x-3.5 top-[calc(var(--safe-top)+64px)] z-[600] flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 shadow-card">
          <Route className="h-5 w-5 text-ember-rose" />
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{shownTrip.trip.title}</span><span className="block text-xs text-ink-mute">{shownTrip.km.toFixed(1)} km · {shownTrip.n} points</span></span>
          <button onClick={() => { groups.current?.trip.clearLayers(); setShownTrip(null); }} className="rounded-xl bg-[#F1F1F4] px-3 py-1.5 text-xs font-extrabold">Hide</button>
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="My map">
        <div className="space-y-1 pb-6">
          <div className="mx-4 rounded-2xl bg-[#111111] p-3.5 text-white">
            <p className="flex items-center gap-1.5 text-sm font-extrabold"><Route className="h-4 w-4" /> Trip mode</p>
            {running ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-ember-rose" />
                <span className="flex-1 truncate text-sm">{running.title} — recording</span>
                <button onClick={() => void stopTrip()} className="rounded-xl bg-white px-3 py-1.5 text-xs font-extrabold text-ink">End trip</button>
              </div>
            ) : (
              <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); void startTrip(); }}>
                <input value={tripTitle} onChange={(e) => setTripTitle(e.target.value)} maxLength={60} placeholder="Name it, e.g. Goa weekend" aria-label="Trip name" className="h-10 min-w-0 flex-1 rounded-xl bg-white/10 px-3 text-sm font-semibold outline-none placeholder:text-white/40" />
                <button type="submit" className="rounded-xl bg-white px-3 text-sm font-extrabold text-ink">Start</button>
              </form>
            )}
            <p className="mt-2 text-[11px] text-white/60">Only you see your trips. The route is saved about once a minute while SUMANOVA is open.</p>
          </div>
          {trips.length > 0 && (
            <ul className="px-4 pt-2">
              {trips.slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-1.5">
                  <button onClick={() => void drawTrip(t)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <Route className="h-4 w-4 shrink-0 text-ink-mute" />
                    <span className="truncate text-sm font-bold">{t.title}</span>
                    <span className="shrink-0 text-xs text-ink-mute">{new Date(t.started_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}{!t.ended_at && ' · now'}</span>
                  </button>
                  <button onClick={async () => { if (!confirm(`Remove “${t.title}”?`)) return; await tripsApi.remove(t.id).catch(() => undefined); if (running?.id === t.id) setActiveTrip(null); setTrips((l) => l.filter((x) => x.id !== t.id)); }} aria-label={`Remove ${t.title}`} className="grid h-8 w-8 place-items-center text-ink-faint"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}

          <Toggle label="Favourite places" description="Long-press anywhere on the map to save a place" checked={show.places} onChange={(v) => setShow((s) => ({ ...s, places: v }))} />
          {places.length > 0 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
              {places.map((p) => (
                <span key={p.id} className="flex shrink-0 items-center gap-1 rounded-xl bg-[#F1F1F4] py-1.5 pl-2.5 pr-1 text-sm font-bold">
                  <button onClick={() => { map.current?.flyTo([p.lat, p.lng], 16); setOpen(false); }}>{p.emoji} {p.name}</button>
                  <button onClick={async () => { await placesApi.remove(p.id).catch(() => undefined); setPlaces((l) => l.filter((x) => x.id !== p.id)); }} aria-label={`Remove ${p.name}`} className="grid h-6 w-6 place-items-center text-ink-faint"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              ))}
            </div>
          )}
          <Toggle label="My memories on the map" description={memories && show.memories ? `${memories.length} with a place` : 'Snaps you saved, pinned where you took them'} checked={show.memories} onChange={(v) => setShow((s) => ({ ...s, memories: v }))} />
          <Toggle label="Save where memories were taken" description="From now on, new memories keep a rough spot (about 100 m) — only you see it" checked={memPlace} onChange={(v) => { setMemPlace(v); setMemPlaceState(v); }} />
          {show.memories && memories === null && <Loader2 className="mx-auto h-5 w-5 animate-spin text-ink-mute" />}
        </div>
      </Sheet>

      <Sheet open={!!saveAt} onClose={() => setSaveAt(null)} title="Save this place">
        <form className="space-y-3 px-4 pb-6" onSubmit={(e) => { e.preventDefault(); void savePlace(); }}>
          <p className="flex items-center gap-1.5 text-xs text-ink-mute"><MapPin className="h-3.5 w-3.5" /> {saveAt?.lat.toFixed(4)}, {saveAt?.lng.toFixed(4)}</p>
          <input autoFocus value={placeName} onChange={(e) => setPlaceName(e.target.value)} maxLength={60} placeholder="Name, e.g. Home, Best dosa" aria-label="Place name" className="h-12 w-full rounded-2xl bg-[#F1F1F4] px-4 text-[15px] font-bold outline-none" />
          <div className="flex flex-wrap gap-1.5">
            {ICONS.map((i) => <button type="button" key={i} onClick={() => setPlaceIcon(i)} aria-pressed={placeIcon === i} className={cn('grid h-10 w-10 place-items-center rounded-xl text-xl', placeIcon === i ? 'bg-ink' : 'bg-[#F1F1F4]')}>{i}</button>)}
          </div>
          <button type="submit" disabled={!placeName.trim()} className="h-12 w-full rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:opacity-40">Save place</button>
        </form>
      </Sheet>
    </>
  );
}
