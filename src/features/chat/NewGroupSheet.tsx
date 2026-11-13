import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/Avatar';
import { chatApi, friendsApi } from '@/lib/chat/api';
import type { Friend } from '@/lib/chat/types';
import { useToast } from '@/providers/ToastProvider';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/haptics';

/** Pick friends + name → create group. Also reused to add members to an existing group. */
export function NewGroupSheet({ open, onClose, addTo, exclude = [] }: { open: boolean; onClose: () => void; addTo?: string; exclude?: string[] }) {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setPicked(new Set());
    setTitle('');
    friendsApi.list().then(setFriends).catch(() => setFriends([]));
  }, [open]);

  const toggle = (id: string) => {
    haptic(5);
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  async function submit() {
    setBusy(true);
    try {
      if (addTo) {
        await chatApi.addMembers(addTo, [...picked]);
        toast('Added to the group', 'success');
        onClose();
      } else {
        const id = await chatApi.createGroup(title.trim(), [...picked]);
        onClose();
        navigate(`/chat/${id}`);
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const list = (friends ?? []).filter((f) => !exclude.includes(f.id));
  const valid = picked.size > 0 && (addTo || title.trim().length > 0);

  return (
    <Sheet open={open} onClose={onClose} title={addTo ? 'Add people' : 'New group'}>
      <div className="space-y-4 px-5 pb-5">
        {!addTo && <Field label="Group name" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={50} />}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">Friends {picked.size > 0 && `· ${picked.size} selected`}</p>
          {friends === null ? (
            <p className="py-6 text-center text-sm text-ink-mute">Loading…</p>
          ) : list.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-mute">{addTo ? 'All your friends are already here.' : 'Add some friends first.'}</p>
          ) : (
            <ul className="max-h-[42vh] space-y-1 overflow-y-auto">
              {list.map((f) => {
                const on = picked.has(f.id);
                return (
                  <li key={f.id}>
                    <button onClick={() => toggle(f.id)} className={cn('flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors', on ? 'bg-white/10' : 'hover:bg-white/5')} aria-pressed={on}>
                      <Avatar name={f.display_name} url={f.avatar_url} aura={f.aura_color} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{f.display_name}</span>
                        <span className="block truncate text-xs text-ink-mute">@{f.username}</span>
                      </span>
                      <span className={cn('grid h-6 w-6 place-items-center rounded-full ring-1 transition-all', on ? 'bg-aurora-gradient ring-transparent' : 'ring-white/20')}>{on && <Check className="h-4 w-4" />}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <Button block size="lg" disabled={!valid} loading={busy} onClick={submit}>
          {addTo ? `Add ${picked.size || ''}` : 'Create group'}
        </Button>
      </div>
    </Sheet>
  );
}
