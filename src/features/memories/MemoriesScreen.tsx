import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, ArchiveRestore, CalendarSearch, Check, Download, FolderPlus, Heart, Loader2, Play, Sparkles, Trash2, X } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Sheet, SheetItem } from '@/components/ui/Sheet';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { memoriesApi, storiesApi, type Album, type Memory } from '@/lib/social/api';
import { privateUrl } from '@/lib/storageUrl';
import { saveMedia } from '@/lib/saveMedia';
import { dayLabel } from '@/lib/chat/time';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { useLongPress } from '@/features/chat/useLongPress';

type Tab = 'all' | 'favourites' | 'albums' | 'archived';

export default function MemoriesScreen() {
  const { session } = useAuth();
  const me = session!.user.id;
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('all');
  const [album, setAlbum] = useState<Album | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [items, setItems] = useState<Memory[] | null>(null);
  const [more, setMore] = useState(true);
  const [month, setMonth] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewer, setViewer] = useState<Memory | null>(null);
  const [albumPicker, setAlbumPicker] = useState(false);
  const [usage, setUsage] = useState<{ items: number; bytes: number; max_items: number; max_bytes: number } | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const query = useCallback(
    (offset: number) => {
      const range = month ? { from: `${month}-01T00:00:00Z`, to: new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 1)).toISOString() } : {};
      return memoriesApi.list({ archived: tab === 'archived', favourite: tab === 'favourites', album: tab === 'albums' ? album?.id ?? null : null, offset, ...range });
    },
    [tab, album, month],
  );

  const reload = useCallback(async () => {
    setItems(null);
    setSelected(new Set());
    if (tab === 'albums' && !album) {
      setItems([]);
      return;
    }
    try {
      const first = await query(0);
      setItems(first);
      setMore(first.length === 60);
    } catch (e) {
      toast((e as Error).message, 'error');
      setItems([]);
    }
    void memoriesApi.usage().then(setUsage).catch(() => undefined);
  }, [query, tab, album, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    void memoriesApi.albums().then(setAlbums).catch(() => undefined);
  }, []);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more || !items?.length) return;
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting) return;
      const nextPage = await query(items.length).catch(() => []);
      setMore(nextPage.length === 60);
      setItems((cur) => [...(cur ?? []), ...nextPage]);
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [items, more, query]);

  const groups = useMemo(() => {
    const out: { label: string; items: Memory[] }[] = [];
    for (const m of items ?? []) {
      const l = dayLabel(m.taken_at);
      if (out.at(-1)?.label === l) out.at(-1)!.items.push(m);
      else out.push({ label: l, items: [m] });
    }
    return out;
  }, [items]);

  const selecting = selected.size > 0;
  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const chosen = (items ?? []).filter((m) => selected.has(m.id));

  async function act(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      haptic(10);
      toast(msg, 'success');
      await reload();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <div className="pb-36">
      <ScreenHeader
        title={album ? album.title : 'Memories'}
        kicker={album ? 'Album' : 'Only you can see these'}
        back={!!album}
        right={
          <label className="glass relative grid h-10 w-10 cursor-pointer place-items-center rounded-full" aria-label="Jump to month">
            <CalendarSearch className="h-5 w-5" />
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="absolute inset-0 opacity-0" />
          </label>
        }
      />
      <div className="mx-auto max-w-lg px-4">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
          {(['all', 'favourites', 'albums', 'archived'] as Tab[]).map((t) => (
            <button key={t} onClick={() => { setTab(t); setAlbum(null); }} className={cn('shrink-0 rounded-full px-4 py-2 text-sm capitalize', tab === t ? 'bg-ember-cream font-semibold text-noir' : 'bg-ink/5 text-ink-soft ring-1 ring-ink/10')}>{t}</button>
          ))}
          {month && (
            <button onClick={() => setMonth('')} className="flex shrink-0 items-center gap-1 rounded-full bg-ember-flame/25 px-3 text-xs">
              {new Date(`${month}-01`).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {usage && tab === 'all' && !month && (
          <div className="mb-4 px-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-ember-gradient text-noir" style={{ width: `${Math.min(100, (usage.bytes / usage.max_bytes) * 100)}%` }} /></div>
            <p className="mt-1 text-[11px] text-ink-faint">{(usage.bytes / 1048576).toFixed(1)} MB of {usage.max_bytes / 1048576} MB · {usage.items}/{usage.max_items} items</p>
          </div>
        )}

        {tab === 'albums' && !album ? (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={async () => { const t = window.prompt('Album name')?.trim(); if (t) { await memoriesApi.createAlbum(me, t.slice(0, 40)).catch((e) => toast((e as Error).message, 'error')); setAlbums(await memoriesApi.albums()); } }} className="grid aspect-square place-items-center rounded-3xl border border-dashed border-ink/20 text-sm text-ink-mute">
              <span className="flex flex-col items-center gap-2"><FolderPlus className="h-6 w-6" /> New album</span>
            </button>
            {albums.map((a) => (
              <button key={a.id} onClick={() => setAlbum(a)} className="glass flex aspect-square flex-col justify-end rounded-3xl p-4 text-left active:scale-[0.98]">
                <span className="font-semibold">{a.title}</span>
                <span className="text-xs text-ink-mute">{new Date(a.created_at).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        ) : items === null ? (
          <div className="grid grid-cols-3 gap-1.5">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-xl bg-ink/[0.04]" />)}</div>
        ) : items.length === 0 ? (
          <div className="glass mt-4 rounded-4xl p-8 text-center">
            <p className="font-display text-lg">{tab === 'favourites' ? 'No favourites yet' : tab === 'archived' ? 'Nothing archived' : 'Your private library'}</p>
            <p className="mt-2 text-sm text-ink-mute">Save snaps and stories to Memories from the editor’s Share sheet. Only you can see them.</p>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.label} className="mb-4">
              <h3 className="mb-2 px-1 text-xs font-semibold text-ink-mute">{g.label}</h3>
              <div className="grid grid-cols-3 gap-1.5">
                {g.items.map((m) => (
                  <Tile key={m.id} m={m} selected={selected.has(m.id)} selecting={selecting} onTap={() => (selecting ? toggle(m.id) : setViewer(m))} onLong={() => { haptic(12); toggle(m.id); }} />
                ))}
              </div>
            </section>
          ))
        )}
        <div ref={sentinel} className="h-4" />
      </div>

      {/* Selection bar */}
      <AnimatePresence>
        {selecting && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="glass-strong fixed inset-x-3 bottom-28 z-40 flex items-center justify-between rounded-3xl p-2">
            <button onClick={() => setSelected(new Set())} className="grid h-11 w-11 place-items-center" aria-label="Cancel selection"><X className="h-5 w-5" /></button>
            <span className="text-sm font-semibold">{selected.size} selected</span>
            <div className="flex">
              <IconBtn label="Favourite" onClick={() => void act(() => memoriesApi.update([...selected], { favourite: true }), 'Added to favourites')}><Heart className="h-5 w-5" /></IconBtn>
              <IconBtn label="Add to album" onClick={() => setAlbumPicker(true)}><FolderPlus className="h-5 w-5" /></IconBtn>
              <IconBtn label={tab === 'archived' ? 'Unarchive' : 'Archive'} onClick={() => void act(() => memoriesApi.update([...selected], { archived: tab !== 'archived' }), tab === 'archived' ? 'Restored' : 'Archived')}>{tab === 'archived' ? <ArchiveRestore className="h-5 w-5" /> : <Archive className="h-5 w-5" />}</IconBtn>
              <IconBtn label="Delete" danger onClick={() => window.confirm(`Delete ${selected.size} memories permanently?`) && void act(() => memoriesApi.remove(chosen), 'Deleted')}><Trash2 className="h-5 w-5" /></IconBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={albumPicker} onClose={() => setAlbumPicker(false)} title="Add to album">
        <div className="pb-4">
          {albums.length === 0 && <p className="px-5 pb-3 text-sm text-ink-mute">Create an album in the Albums tab first.</p>}
          {albums.map((a) => (
            <SheetItem key={a.id} icon={<FolderPlus className="h-4 w-4" />} label={a.title} onClick={() => { setAlbumPicker(false); void act(() => memoriesApi.update([...selected], { album_id: a.id }), `Added to ${a.title}`); }} />
          ))}
        </div>
      </Sheet>

      <AnimatePresence>
        {viewer && (
          <MemoryViewer
            m={viewer}
            onClose={() => setViewer(null)}
            onChanged={() => { setViewer(null); void reload(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function IconBtn({ children, label, onClick, danger }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} aria-label={label} className={cn('grid h-11 w-11 place-items-center rounded-full', danger ? 'text-ember-rose' : '')}>{children}</button>;
}

function Tile({ m, selected, selecting, onTap, onLong }: { m: Memory; selected: boolean; selecting: boolean; onTap: () => void; onLong: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const press = useLongPress(onLong);
  useEffect(() => {
    if (m.kind === 'image') privateUrl('memories', m.media_path).then(setUrl).catch(() => undefined);
  }, [m]);
  return (
    <button {...press} onClick={() => !press.wasLongPress() && onTap()} className={cn('relative aspect-square select-none overflow-hidden rounded-xl bg-ink/5 transition-transform', selected && 'scale-[0.92] ring-2 ring-ember-amber')}>
      {m.kind === 'image' ? (url ? <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" /> : <span className="block h-full animate-pulse bg-ink/5" />) : (
        <span className="grid h-full place-items-center bg-gradient-to-br from-ember-flame/30 to-ember-jade/20"><Play className="h-7 w-7" /></span>
      )}
      {m.favourite && <Heart className="absolute right-1.5 top-1.5 h-4 w-4 fill-ember-rose text-ember-rose" />}
      {selecting && <span className={cn('absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full ring-2 ring-ember-flame', selected ? 'bg-ember-amber' : 'bg-black/30')}>{selected && <Check className="h-3 w-3" />}</span>}
    </button>
  );
}

function MemoryViewer({ m, onClose, onChanged }: { m: Memory; onClose: () => void; onChanged: () => void }) {
  const { session } = useAuth();
  const toast = useToast();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    privateUrl('memories', m.media_path).then(setUrl).catch(() => toast('Couldn’t load this memory', 'error'));
  }, [m, toast]);

  async function run(key: string, fn: () => Promise<unknown>, msg: string) {
    setBusy(key);
    try {
      await fn();
      toast(msg, 'success');
      onChanged();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }
  const blob = async () => (await fetch(url!)).blob();

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[95] flex flex-col bg-black">
      <div className="flex items-center justify-between px-3 pt-safe">
        <button onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center text-white"><X className="h-6 w-6" /></button>
        <span className="text-sm text-white/70">{new Date(m.taken_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
        <span className="w-11" />
      </div>
      <div className="grid min-h-0 flex-1 place-items-center">
        {!url ? <Loader2 className="h-7 w-7 animate-spin text-white/60" /> : m.kind === 'image' ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <video src={url} controls autoPlay playsInline className="max-h-full max-w-full" />}
      </div>
      <div className="flex justify-around px-2 pb-safe pt-3 text-white">
        <VBtn label={m.favourite ? 'Unfavourite' : 'Favourite'} busy={busy === 'fav'} onClick={() => void run('fav', () => memoriesApi.update([m.id], { favourite: !m.favourite }), m.favourite ? 'Removed from favourites' : 'Favourited')}><Heart className={cn('h-6 w-6', m.favourite && 'fill-ember-rose text-ember-rose')} /></VBtn>
        <VBtn label="Story" busy={busy === 'story'} onClick={() => void run('story', async () => storiesApi.post(session!.user.id, { kind: m.kind, blob: await blob(), meta: m.media_meta, audience: 'friends' }), 'Posted to your story')}><Sparkles className="h-6 w-6" /></VBtn>
        <VBtn label="Save" busy={busy === 'dl'} onClick={() => void (async () => { setBusy('dl'); try { await saveMedia(await blob(), `sumanova-memory-${m.id.slice(0, 8)}.${m.kind === 'image' ? 'webp' : 'mp4'}`); } finally { setBusy(null); } })()}><Download className="h-6 w-6" /></VBtn>
        <VBtn label={m.archived ? 'Unarchive' : 'Archive'} busy={busy === 'arc'} onClick={() => void run('arc', () => memoriesApi.update([m.id], { archived: !m.archived }), m.archived ? 'Restored' : 'Archived')}><Archive className="h-6 w-6" /></VBtn>
        <VBtn label="Delete" busy={busy === 'del'} onClick={() => window.confirm('Delete this memory permanently?') && void run('del', () => memoriesApi.remove([m]), 'Deleted')}><Trash2 className="h-6 w-6 text-ember-rose" /></VBtn>
      </div>
    </motion.div>,
    document.body,
  );
}

function VBtn({ children, label, onClick, busy }: { children: React.ReactNode; label: string; onClick: () => void; busy?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy} className="flex w-16 flex-col items-center gap-1 text-[11px] text-white/80">
      {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : children}
      {label}
    </button>
  );
}
