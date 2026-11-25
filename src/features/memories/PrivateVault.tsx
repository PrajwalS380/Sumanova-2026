import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Loader2, Lock, LockOpen, Play, Trash2, X } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { memoriesApi, type Memory } from '@/lib/social/api';
import { createVault, unlockVault, vaultApi, type VaultRecord } from '@/lib/vault';
import { NovaEmoji } from '@/components/emoji/NovaEmoji';
import { cn } from '@/lib/cn';

/** Passcode entry: create (twice) or unlock. Returns the derived key. */
export function VaultGate({ onKey }: { onKey: (k: CryptoKey) => void }) {
  const { session } = useAuth();
  const uid = session!.user.id;
  const toast = useToast();
  const [record, setRecord] = useState<VaultRecord | null | undefined>(undefined);
  const [code, setCode] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void vaultApi.get(uid).then(setRecord).catch(() => setRecord(null));
  }, [uid]);

  async function submit() {
    setBusy(true);
    try {
      if (record) {
        onKey(await unlockVault(record, code));
      } else if (!first) {
        if (!/^\d{4,8}$/.test(code)) throw new Error('Use 4–8 digits');
        setFirst(code);
        setCode('');
      } else {
        if (code !== first) {
          setFirst(null);
          setCode('');
          throw new Error('Passcodes didn’t match — try again');
        }
        const { record: r, key } = await createVault(code);
        await vaultApi.save(uid, r);
        setRecord(r);
        onKey(key);
        toast('My Eyes Only is ready', 'success');
      }
    } catch (e) {
      toast((e as Error).message, 'error');
      if (record) setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (record === undefined) return <div className="grid h-48 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-mute" /></div>;
  const title = record ? 'Enter your passcode' : first ? 'Confirm your passcode' : 'Create a passcode';
  return (
    <div className="mx-auto mt-2 max-w-xs rounded-tile bg-white p-5 text-center">
      <NovaEmoji id="halo" size={56} />
      <h2 className="mt-2 text-lg font-black">My Eyes Only</h2>
      <p className="mt-1 text-xs text-ink-mute">{record ? 'Snaps here are encrypted on your phone with your passcode.' : 'Encrypted on your phone with this passcode. If you forget it, these snaps can’t be recovered — not even by us.'}</p>
      <p className="mt-4 text-sm font-extrabold">{title}</p>
      <div className="mt-2 flex justify-center gap-2" aria-hidden>
        {Array.from({ length: Math.max(4, code.length) }).map((_, i) => <span key={i} className={cn('h-3 w-3 rounded-full', i < code.length ? 'bg-ink' : 'bg-ink/15')} />)}
      </div>
      <input type="password" inputMode="numeric" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))} onKeyDown={(e) => e.key === 'Enter' && void submit()} aria-label={title} className="mt-3 h-12 w-full rounded-2xl bg-[#F1F1F4] text-center text-xl font-black tracking-[0.4em] outline-none" autoFocus />
      <button onClick={() => void submit()} disabled={busy || code.length < 4} className="mt-3 h-12 w-full rounded-2xl bg-ink text-[15px] font-extrabold text-white disabled:opacity-50">{busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : record ? 'Unlock' : first ? 'Confirm' : 'Next'}</button>
    </div>
  );
}

/** Unlocked vault: decrypted thumbnails, viewer, move out, delete. */
export function PrivateGrid({ vaultKey, onLock }: { vaultKey: CryptoKey; onLock: () => void }) {
  const { session } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Memory[] | null>(null);
  const [open, setOpen] = useState<{ m: Memory; url: string } | null>(null);
  const load = () => void memoriesApi.listPrivate().then(setItems).catch((e) => { toast((e as Error).message, 'error'); setItems([]); });
  useEffect(load, []);

  async function view(m: Memory) {
    try {
      const blob = await memoriesApi.openPrivate(m, vaultKey);
      setOpen({ m, url: URL.createObjectURL(blob) });
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5">
        <LockOpen className="h-4 w-4 text-ember-sage" />
        <span className="flex-1 text-sm font-bold">Unlocked · {items?.length ?? 0} private</span>
        <button onClick={onLock} className="flex items-center gap-1 rounded-xl bg-ink px-3 py-1.5 text-xs font-extrabold text-white"><Lock className="h-3.5 w-3.5" /> Lock</button>
      </div>
      {items === null ? (
        <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink-mute" /></div>
      ) : items.length === 0 ? (
        <p className="rounded-tile bg-white p-6 text-center text-sm text-ink-mute">Nothing here yet. Long-press snaps in Memories and tap the lock to move them in.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((m) => <PrivateTile key={m.id} m={m} vaultKey={vaultKey} onOpen={() => void view(m)} />)}
        </div>
      )}
      {open && createPortal(
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[95] flex flex-col bg-black text-white">
          <div className="flex items-center justify-between px-3 pt-safe">
            <button onClick={() => { URL.revokeObjectURL(open.url); setOpen(null); }} aria-label="Close" className="grid h-11 w-11 place-items-center"><X className="h-6 w-6" /></button>
            <span className="text-sm text-white/70">My Eyes Only</span>
            <span className="w-11" />
          </div>
          <div className="grid min-h-0 flex-1 place-items-center">
            {open.m.kind === 'image' ? <img src={open.url} alt="" className="max-h-full max-w-full object-contain" /> : <video src={open.url} controls autoPlay playsInline className="max-h-full max-w-full" />}
          </div>
          <div className="flex justify-around px-2 pb-safe pt-3">
            <button onClick={async () => { try { await memoriesApi.unlock(session!.user.id, open.m, vaultKey); toast('Moved back to Memories', 'success'); setOpen(null); load(); } catch (e) { toast((e as Error).message, 'error'); } }} className="flex flex-col items-center gap-1 text-[11px]"><LockOpen className="h-6 w-6" /> Move out</button>
            <button onClick={async () => { if (!window.confirm('Delete permanently?')) return; try { await memoriesApi.remove([open.m]); setOpen(null); load(); } catch (e) { toast((e as Error).message, 'error'); } }} className="flex flex-col items-center gap-1 text-[11px]"><Trash2 className="h-6 w-6 text-ember-rose" /> Delete</button>
          </div>
        </motion.div>,
        document.body,
      )}
    </div>
  );
}

function PrivateTile({ m, vaultKey, onOpen }: { m: Memory; vaultKey: CryptoKey; onOpen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (m.kind !== 'image') return;
    let u: string | null = null;
    void memoriesApi.openPrivate(m, vaultKey).then((b) => setUrl((u = URL.createObjectURL(b)))).catch(() => undefined);
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [m, vaultKey]);
  return (
    <button onClick={onOpen} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-ink/5">
      {m.kind === 'image' ? (url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <span className="block h-full animate-pulse bg-ink/5" />) : <span className="grid h-full place-items-center bg-ink/10"><Play className="h-7 w-7" /></span>}
      <Lock className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-white drop-shadow" />
    </button>
  );
}
