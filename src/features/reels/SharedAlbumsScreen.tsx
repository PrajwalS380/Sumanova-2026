import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Check, ChevronLeft, Clapperboard, ImagePlus, Loader2, LogOut, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { friendsApi } from '@/lib/chat/api';
import type { Friend } from '@/lib/chat/types';
import { extFor, privateUrl, uploadTo } from '@/lib/storageUrl';
import { Sheet } from '@/components/ui/Sheet';
import { Avatar } from '@/components/Avatar';
import { NovaEmoji } from '@/components/emoji/NovaEmoji';
import { Ghost, GHOST_HOST } from '@/components/ui/Ghost';
import { ReelBuilder, type ReelSource } from './ReelBuilder';
import { cn } from '@/lib/cn';

interface Album { id: string; title: string; owner_id: string; created_at: string }
interface Item { id: string; album_id: string; user_id: string; kind: 'image' | 'video'; media_path: string; created_at: string }

const BACK = 'grid h-10 w-10 place-items-center rounded-2xl bg-white active:scale-90';

/** Shared albums: everyone in it adds photos; anyone can make a recap reel. */
export default function SharedAlbumsScreen() {
  const { id } = useParams();
  return id ? <AlbumView id={id} /> : <AlbumList />;
}

function AlbumList() {
  const navigate = useNavigate();
  const toast = useToast();
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [create, setCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void supabase.from('shared_albums').select('id,title,owner_id,created_at').is('deleted_at', null).order('created_at', { ascending: false }).then(({ data }) => setAlbums((data ?? []) as Album[]));
    void friendsApi.list().then(setFriends).catch(() => undefined);
  }, []);
  async function make() {
    setBusy(true);
    const { data, error } = await supabase.rpc('create_shared_album', { p_title: title.trim(), p_members: [...picked] });
    setBusy(false);
    if (error) return toast(error.message, 'error');
    navigate(`/albums/${data as string}`);
  }
  return (
    <div className="min-h-full bg-noir pb-16">
      <header className="flex items-center gap-2 px-3.5 pb-3 pt-safe">
        <button onClick={() => navigate(-1)} aria-label="Back" className={BACK}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-center text-lg font-extrabold">Shared albums</h1>
        <button onClick={() => setCreate(true)} aria-label="New shared album" className={BACK}><Plus className="h-5 w-5" /></button>
      </header>
      <div className="mx-auto max-w-md space-y-2 px-4">
        {albums === null ? <div className="grid h-32 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-mute" /></div> : albums.length === 0 ? (
          <div className="rounded-tile bg-white p-6 text-center"><NovaEmoji id="camera" size={48} /><p className="mt-2 font-extrabold">No shared albums yet</p><p className="text-sm text-ink-mute">Make one for a trip or a party — friends add their photos, and anyone can make a recap reel.</p></div>
        ) : albums.map((a) => (
          <button key={a.id} onClick={() => navigate(`/albums/${a.id}`)} className={cn('flex w-full items-center gap-3 rounded-tile bg-white p-4 text-left', GHOST_HOST)}>
            <Ghost size={100} opacity={0.08} className="-right-4 -top-4"><NovaEmoji id="camera" size={100} /></Ghost>
            <NovaEmoji id="camera" size={40} />
            <span className="flex-1"><span className="block font-extrabold">{a.title}</span><span className="text-xs text-ink-mute">Created {new Date(a.created_at).toLocaleDateString()}</span></span>
          </button>
        ))}
      </div>
      <Sheet open={create} onClose={() => setCreate(false)} title="New shared album">
        <div className="space-y-2 px-4 pb-6">
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="Album name — e.g. Goa trip" aria-label="Album name" className="h-12 w-full rounded-2xl bg-[#F1F1F4] px-4 text-[15px] font-bold outline-none" />
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {friends.map((f) => (
              <li key={f.id}>
                <button onClick={() => setPicked((s) => { const n = new Set(s); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n; })} className={cn('flex w-full items-center gap-3 rounded-2xl p-2 text-left', picked.has(f.id) && 'bg-ink/10')}>
                  <Avatar name={f.display_name} url={f.avatar_url} aura={f.aura_color} size={34} /><span className="flex-1 text-sm font-bold">{f.display_name}</span>{picked.has(f.id) && <Check className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </ul>
          <button onClick={() => void make()} disabled={busy || !title.trim()} className="h-12 w-full rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create album'}</button>
        </div>
      </Sheet>
    </div>
  );
}

function AlbumView({ id }: { id: string }) {
  const { session } = useAuth();
  const me = session!.user.id;
  const navigate = useNavigate();
  const toast = useToast();
  const [album, setAlbum] = useState<Album | null>(null);
  const [items, setItems] = useState<(Item & { url: string })[] | null>(null);
  const [uploading, setUploading] = useState(0);
  const [recap, setRecap] = useState(false);
  const load = useCallback(async () => {
    const [{ data: a }, { data: list }] = await Promise.all([
      supabase.from('shared_albums').select('id,title,owner_id,created_at').eq('id', id).maybeSingle(),
      supabase.from('shared_album_items').select('*').eq('album_id', id).order('created_at', { ascending: false }).limit(500),
    ]);
    setAlbum((a as Album) ?? null);
    setItems(await Promise.all(((list ?? []) as Item[]).map(async (it) => ({ ...it, url: await privateUrl('albums', it.media_path).catch(() => '') }))));
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  async function add(files: FileList | null) {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/')).slice(0, 30);
    setUploading(list.length);
    for (const f of list) {
      try {
        const path = await uploadTo('albums', `${id}/${me}/${crypto.randomUUID()}.${extFor(f.type)}`, f);
        const { error } = await supabase.rpc('add_album_item', { p_album: id, p_kind: f.type.startsWith('video/') ? 'video' : 'image', p_path: path });
        if (error) throw new Error(error.message);
      } catch (e) {
        toast((e as Error).message, 'error');
      }
      setUploading((n) => n - 1);
    }
    void load();
  }

  if (album === null && items !== null) return <div className="grid h-full place-items-center p-8 text-center text-sm text-ink-mute">This album isn’t available.</div>;
  const images = (items ?? []).filter((i) => i.kind === 'image' && i.url);
  const sources: ReelSource[] = images.map((i) => ({ key: i.id, url: i.url, load: async () => (await fetch(i.url)).blob() }));
  return (
    <div className="min-h-full bg-noir pb-16">
      <header className="flex items-center gap-2 px-3.5 pb-3 pt-safe">
        <button onClick={() => navigate('/albums')} aria-label="Back" className={BACK}><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="min-w-0 flex-1 truncate text-center text-lg font-extrabold">{album?.title ?? '…'}</h1>
        <button onClick={async () => { if (!window.confirm(album?.owner_id === me ? 'Delete this album for everyone?' : 'Leave this album?')) return; await supabase.rpc('leave_shared_album', { p_album: id }); navigate('/albums'); }} aria-label="Leave album" className={BACK}><LogOut className="h-5 w-5" /></button>
      </header>
      <div className="mx-auto max-w-md px-4">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-ink py-3 text-sm font-extrabold text-white">
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> {uploading} left</> : <><ImagePlus className="h-4 w-4" /> Add photos</>}
            <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
          </label>
          <button onClick={() => setRecap(true)} disabled={!images.length} className="flex items-center justify-center gap-2 rounded-2xl bg-ember-rose py-3 text-sm font-extrabold text-white disabled:opacity-50"><Clapperboard className="h-4 w-4" /> Make recap</button>
        </div>
        {items === null ? <div className="grid h-32 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-mute" /></div> : (
          <div className="grid grid-cols-3 gap-1.5">
            {items.map((i) => (
              <div key={i.id} className="relative aspect-square overflow-hidden rounded-xl bg-ink/5">
                {i.kind === 'image' ? <img src={i.url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <video src={i.url} muted playsInline className="h-full w-full object-cover" />}
                {(i.user_id === me || album?.owner_id === me) && (
                  <button onClick={async () => { await supabase.rpc('remove_album_item', { p_item: i.id }); void load(); }} aria-label="Remove" className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-lg bg-black/45 text-white"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <AnimatePresence>{recap && album && <ReelBuilder title={album.title} subtitle="A SUMANOVA recap" emoji="camera" sources={sources} fromMemories={false} onClose={() => setRecap(false)} />}</AnimatePresence>
    </div>
  );
}
