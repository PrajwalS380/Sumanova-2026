import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Sheet } from '@/components/ui/Sheet';
import { Ghost, GHOST_HOST } from '@/components/ui/Ghost';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { supabase } from '@/lib/supabase';
import { authStorageKey, savedAccounts, type SavedAccount } from '@/lib/savedAccounts';
import { cn } from '@/lib/cn';

/** Step out of the current account WITHOUT revoking it, so it stays switchable. */
function parkCurrentSession() {
  const key = authStorageKey(import.meta.env.VITE_SUPABASE_URL as string | undefined);
  try {
    if (key) localStorage.removeItem(key);
  } catch {
    /* storage blocked */
  }
}

/** Welcome back (wireframe 16): accounts saved on this phone — continue, switch, remove, add. */
export default function AccountsScreen() {
  const { session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState<SavedAccount[]>(() => savedAccounts.list());
  const current = session?.user.id ?? null;
  const [pick, setPick] = useState<string | null>(() => current ?? list[0]?.id ?? null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const chosen = list.find((a) => a.id === pick) ?? null;

  async function go() {
    if (!chosen) return;
    if (chosen.id === current) return navigate('/', { replace: true });
    if (!chosen.refresh_token) return navigate(`/auth/sign-in?email=${encodeURIComponent(chosen.email ?? '')}`);
    setBusy(true);
    const { error } = await supabase.auth.setSession({ access_token: chosen.access_token ?? '', refresh_token: chosen.refresh_token });
    if (error) {
      setBusy(false);
      savedAccounts.forgetTokens(chosen.id);
      setList(savedAccounts.list());
      toast('Please log in again', 'info');
      return navigate(`/auth/sign-in?email=${encodeURIComponent(chosen.email ?? '')}`);
    }
    // Full reload so every live connection starts fresh as the new account.
    location.replace('/');
  }

  async function remove() {
    if (!chosen) return;
    setConfirm(false);
    if (chosen.id === current) {
      await supabase.auth.signOut({ scope: 'local' });
    }
    savedAccounts.remove(chosen.id);
    const next = savedAccounts.list();
    setList(next);
    setPick(next[0]?.id ?? null);
    toast('Removed from this phone', 'success');
    if (chosen.id === current) navigate('/auth/welcome', { replace: true });
  }

  function addAnother(to: '/auth/sign-in' | '/auth/sign-up') {
    if (session) {
      parkCurrentSession();
      location.replace(to);
    } else navigate(to);
  }

  return (
    <div className="flex min-h-full flex-col bg-noir px-5 pt-safe text-ink">
      <p className="mt-6 text-center text-[13px] font-black tracking-[0.3em]">SUMANOVA</p>
      <h1 className="mt-10 text-center font-display text-[44px] leading-none">Welcome back</h1>
      <p className="mt-2 text-center text-sm font-semibold text-ink-mute">{list.length ? 'Tap your account to continue' : 'No accounts saved on this phone yet'}</p>

      <div className="no-scrollbar -mx-5 mt-8 flex justify-center gap-3 overflow-x-auto px-5 pb-2">
        {list.map((a) => (
          <button key={a.id} onClick={() => setPick(a.id)} aria-pressed={pick === a.id} className={cn('flex w-[150px] shrink-0 flex-col items-center gap-1.5 rounded-tile bg-white px-2.5 pb-3 pt-4 transition-shadow', GHOST_HOST, pick === a.id ? 'ring-[3px] ring-ink' : 'opacity-80')}>
            <Ghost url={a.avatar_url} size={160} opacity={0.12} className="-right-10 -top-8" />
            <Avatar name={a.display_name} url={a.avatar_url} aura={a.aura_color} size={88} />
            <b className="w-full truncate text-[15px]">{a.display_name}</b>
            <span className="w-full truncate text-xs font-bold text-ink-mute">@{a.username}</span>
            {a.id === current && <span className="rounded-lg bg-ember-sage/15 px-2 py-0.5 text-[10px] font-extrabold text-ember-jade">SIGNED IN</span>}
          </button>
        ))}
        <button onClick={() => addAnother('/auth/sign-in')} className="flex w-[70px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-tile border-2 border-dashed border-ink/15 text-[11px] font-extrabold">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white"><Plus className="h-5 w-5" /></span>Add
        </button>
      </div>

      {chosen && (
        <button onClick={() => setConfirm(true)} className="mx-auto mt-4 text-sm font-extrabold text-[#B42318] underline underline-offset-4">
          Remove @{chosen.username} from this phone
        </button>
      )}

      <div className="mt-auto flex flex-col gap-2.5 pb-safe pt-8">
        {chosen && (
          <button onClick={() => void go()} disabled={busy} className="flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-[#111111] text-base font-extrabold text-white disabled:opacity-60">
            {busy && <Loader2 className="h-5 w-5 animate-spin" />}
            {chosen.id === current ? `Continue as ${chosen.display_name}` : chosen.refresh_token ? `Switch to ${chosen.display_name}` : `Log in as ${chosen.display_name}`}
          </button>
        )}
        <div className="flex gap-2.5">
          <button onClick={() => addAnother('/auth/sign-in')} className="h-12 flex-1 rounded-2xl bg-white text-sm font-extrabold">Log in to another</button>
          <button onClick={() => addAnother('/auth/sign-up')} className="h-12 flex-1 rounded-2xl bg-white text-sm font-extrabold">Create account</button>
        </div>
        {!session && <Link to="/auth/welcome?fresh=1" className="text-center text-xs font-bold text-ink-mute">Back to welcome</Link>}
        <p className="text-center text-[11px] font-semibold text-ink-mute">Saved on this device only · passwords are never stored</p>
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={chosen ? `Remove @${chosen.username}?` : undefined}>
        <div className="px-4 pb-5">
          <p className="text-sm text-ink-mute">{chosen?.id === current ? 'You’ll be signed out here. ' : ''}You’ll need your password to log in again. Your account, chats and memories are not deleted.</p>
          <button onClick={() => void remove()} className="mt-4 h-12 w-full rounded-2xl bg-[#B42318] font-extrabold text-white">Remove from this phone</button>
          <button onClick={() => setConfirm(false)} className="mt-2 h-12 w-full rounded-2xl bg-ink/[0.06] font-extrabold">Cancel</button>
        </div>
      </Sheet>
    </div>
  );
}
