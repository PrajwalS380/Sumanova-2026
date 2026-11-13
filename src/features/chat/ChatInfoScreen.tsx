import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Ban, BellOff, Bell, Camera, Clock3, Crown, Eraser, Eye, Flag, LogOut, MoreHorizontal, PencilLine, Pin, PinOff, Shield, Trash2, UserMinus, UserPlus, Users } from 'lucide-react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Avatar } from '@/components/Avatar';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet, SheetItem } from '@/components/ui/Sheet';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/providers/AuthProvider';
import { useInbox } from '@/providers/InboxProvider';
import { useToast } from '@/providers/ToastProvider';
import { chatApi, friendsApi } from '@/lib/chat/api';
import { squareAvatar } from '@/lib/image';
import { supabase } from '@/lib/supabase';
import type { ChatTheme, DisappearMode, Member, PublicProfile } from '@/lib/chat/types';
import { cn } from '@/lib/cn';
import { CHAT_THEMES } from './themes';
import { NewGroupSheet } from './NewGroupSheet';

interface Conv { id: string; kind: 'direct' | 'group'; title: string | null; avatar_url: string | null; disappear_mode: DisappearMode }

export default function ChatInfoScreen() {
  const { id = '' } = useParams();
  const { session } = useAuth();
  const me = session!.user.id;
  const inbox = useInbox();
  const toast = useToast();
  const navigate = useNavigate();
  const summary = inbox.conversations.find((c) => c.id === id);
  const [conv, setConv] = useState<Conv | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [people, setPeople] = useState<Record<string, PublicProfile>>({});
  const [memberMenu, setMemberMenu] = useState<Member | null>(null);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [confirm, setConfirm] = useState<null | { title: string; body: string; action: string; run: () => Promise<void> }>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const [c, m] = await Promise.all([chatApi.conversation(id), chatApi.members(id)]);
      setConv(c as unknown as Conv);
      setMembers(m);
      const profs = await chatApi.profiles(m.map((x) => x.user_id));
      setPeople(Object.fromEntries(profs.map((p) => [p.id, p])));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const myRole = members.find((m) => m.user_id === me)?.role ?? 'member';
  const isGroup = conv?.kind === 'group';
  const other = !isGroup ? members.find((m) => m.user_id !== me) : undefined;
  const otherP = other ? people[other.user_id] : undefined;
  const isAdmin = myRole === 'owner' || myRole === 'admin';

  async function act(fn: () => Promise<unknown>, ok?: string) {
    try {
      await fn();
      if (ok) toast(ok, 'success');
      await load();
      void inbox.refresh();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  async function setPref(p: Partial<{ pinned: boolean; muted: boolean; theme: ChatTheme }>) {
    inbox.patch(id, p);
    try {
      await chatApi.setPrefs(id, me, p);
    } catch (e) {
      toast((e as Error).message, 'error');
      void inbox.refresh();
    }
  }

  async function changePhoto(f: File | undefined) {
    if (!f) return;
    await act(async () => {
      const blob = await squareAvatar(f, 400);
      const path = `${me}/group-${id}-${Date.now()}.webp`;
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/webp' });
      if (error) throw error;
      await chatApi.updateGroup(id, { avatarUrl: supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl });
    }, 'Group photo updated');
  }

  if (!conv) return <div className="grid h-full place-items-center text-sm text-ink-mute">Loading…</div>;

  const name = isGroup ? conv.title ?? 'Group' : otherP?.display_name ?? '';
  const since = other ? new Date(other.joined_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div className="pb-16">
      <ScreenHeader title="" back />
      <div className="mx-auto max-w-md space-y-6 px-4">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            {isGroup && !conv.avatar_url ? (
              <span className="grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-aurora-violet/50 to-aurora-teal/50 ring-4 ring-white/5"><Users className="h-10 w-10" /></span>
            ) : (
              <Avatar name={name || '?'} url={isGroup ? conv.avatar_url : otherP?.avatar_url} aura={otherP?.aura_color} size={112} />
            )}
            {isGroup && isAdmin && (
              <>
                <button onClick={() => file.current?.click()} className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full bg-aurora-gradient ring-4 ring-night" aria-label="Change group photo"><Camera className="h-4 w-4" /></button>
                <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => void changePhoto(e.target.files?.[0])} />
              </>
            )}
          </div>
          <h2 className="mt-4 flex items-center gap-2 font-display text-2xl font-semibold">
            {name}
            {isGroup && isAdmin && <button onClick={() => { setNewTitle(conv.title ?? ''); setRenaming(true); }} aria-label="Rename group" className="text-ink-mute"><PencilLine className="h-4 w-4" /></button>}
          </h2>
          <p className="text-sm text-ink-mute">{isGroup ? `${members.length} members` : `@${otherP?.username ?? ''}`}</p>
          {!isGroup && since && <p className="mt-1 text-xs text-ink-faint">Chatting since {since}</p>}
        </div>

        <section className="glass divide-y divide-white/5 overflow-hidden rounded-3xl">
          <Segmented<DisappearMode>
            label="Disappearing messages"
            value={conv.disappear_mode}
            options={[{ value: 'never', label: 'Off' }, { value: 'after_view', label: 'After view' }, { value: '24h', label: '24 hours' }]}
            onChange={(v) => void act(() => chatApi.updateGroup(id, { disappearMode: v }), v === 'never' ? 'Messages will stay' : v === '24h' ? 'New messages vanish after 24h' : 'New messages vanish after they’re seen')}
          />
          <p className="flex items-center gap-2 px-4 pb-3 text-xs text-ink-mute">
            {conv.disappear_mode === 'after_view' ? <Eye className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
            Applies to new messages for everyone in this chat. Deletion is enforced on the server.
          </p>
          <div className="px-4 py-3">
            <p className="mb-2 text-[15px] font-medium">Chat theme</p>
            <div className="flex justify-between">
              {(Object.keys(CHAT_THEMES) as ChatTheme[]).map((t) => (
                <button key={t} onClick={() => void setPref({ theme: t })} aria-label={CHAT_THEMES[t].label} aria-pressed={summary?.theme === t} className={cn('h-10 w-10 rounded-full transition-transform', summary?.theme === t ? 'scale-110 ring-2 ring-white' : 'ring-1 ring-white/10')} style={{ background: CHAT_THEMES[t].mine }} />
              ))}
            </div>
          </div>
          <button onClick={() => void setPref({ muted: !summary?.muted })} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
            {summary?.muted ? <Bell className="h-5 w-5 text-ink-mute" /> : <BellOff className="h-5 w-5 text-ink-mute" />}
            <span className="text-[15px]">{summary?.muted ? 'Unmute' : 'Mute notifications'}</span>
          </button>
          <button onClick={() => void setPref({ pinned: !summary?.pinned })} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
            {summary?.pinned ? <PinOff className="h-5 w-5 text-ink-mute" /> : <Pin className="h-5 w-5 text-ink-mute" />}
            <span className="text-[15px]">{summary?.pinned ? 'Unpin chat' : 'Pin chat'}</span>
          </button>
        </section>

        {isGroup && (
          <section>
            <div className="mb-2 flex items-center justify-between px-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-mute">Members</h3>
              {isAdmin && <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm font-semibold text-aurora-iris"><UserPlus className="h-4 w-4" /> Add</button>}
            </div>
            <ul className="glass divide-y divide-white/5 overflow-hidden rounded-3xl">
              {members.map((m) => {
                const p = people[m.user_id];
                if (!p) return null;
                return (
                  <li key={m.user_id} className="flex items-center gap-3 px-3 py-2.5">
                    <Avatar name={p.display_name} url={p.avatar_url} aura={p.aura_color} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.display_name}{m.user_id === me && ' (you)'}</span>
                      <span className="block truncate text-xs text-ink-mute">@{p.username}</span>
                    </span>
                    {m.role !== 'member' && (
                      <span className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', m.role === 'owner' ? 'bg-aurora-gold/15 text-aurora-gold' : 'bg-aurora-iris/15 text-aurora-iris')}>
                        {m.role === 'owner' ? <Crown className="h-3 w-3" /> : <Shield className="h-3 w-3" />}{m.role}
                      </span>
                    )}
                    {isAdmin && m.user_id !== me && m.role !== 'owner' && (
                      <button onClick={() => setMemberMenu(m)} aria-label="Member options" className="p-1 text-ink-mute"><MoreHorizontal className="h-5 w-5" /></button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="glass divide-y divide-white/5 overflow-hidden rounded-3xl">
          <DangerRow icon={<Eraser className="h-5 w-5" />} label="Clear chat for me" onClick={() => setConfirm({ title: 'Clear this chat?', body: 'Messages disappear for you only. Others keep their copy.', action: 'Clear', run: () => act(() => chatApi.clear(id), 'Chat cleared') })} />
          {!isGroup && other && (
            <>
              <DangerRow icon={<UserMinus className="h-5 w-5" />} label="Remove friend" onClick={() => setConfirm({ title: `Remove ${name}?`, body: 'You can add each other again later.', action: 'Remove', run: () => act(() => friendsApi.remove(other.user_id), 'Friend removed') })} />
              <DangerRow icon={<Ban className="h-5 w-5" />} label={`Block ${name}`} onClick={() => setConfirm({ title: `Block ${name}?`, body: 'They won’t be able to message, call or find you. They aren’t notified.', action: 'Block', run: () => act(async () => { await friendsApi.block(other.user_id); navigate('/chat'); }, 'Blocked') })} />
              <DangerRow icon={<Flag className="h-5 w-5" />} label="Report" onClick={() => setConfirm({ title: `Report ${name}?`, body: 'Our team reviews reports. They aren’t told who reported them.', action: 'Report', run: () => act(() => friendsApi.report(other.user_id, 'harassment'), 'Report sent') })} />
            </>
          )}
          {isGroup && (
            <DangerRow icon={<LogOut className="h-5 w-5" />} label="Leave group" onClick={() => setConfirm({ title: 'Leave this group?', body: myRole === 'owner' ? 'Ownership passes to the next admin or member.' : 'You can be added back by an admin.', action: 'Leave', run: () => act(async () => { await chatApi.leave(id); navigate('/chat'); }) })} />
          )}
          {isGroup && myRole === 'owner' && (
            <DangerRow icon={<Trash2 className="h-5 w-5" />} label="Delete group for everyone" onClick={() => setConfirm({ title: 'Delete this group?', body: 'All messages are removed for every member. This can’t be undone.', action: 'Delete', run: () => act(async () => { await chatApi.deleteGroup(id); navigate('/chat'); }, 'Group deleted') })} />
          )}
        </section>
      </div>

      <Sheet open={!!memberMenu} onClose={() => setMemberMenu(null)} title={memberMenu ? people[memberMenu.user_id]?.display_name : ''}>
        {memberMenu && (
          <div className="pb-3">
            {myRole === 'owner' && (
              <SheetItem icon={<Shield className="h-4 w-4" />} label={memberMenu.role === 'admin' ? 'Remove admin' : 'Make admin'} onClick={() => { const m = memberMenu; setMemberMenu(null); void act(() => chatApi.setRole(id, m.user_id, m.role === 'admin' ? 'member' : 'admin'), 'Role updated'); }} />
            )}
            <SheetItem danger icon={<UserMinus className="h-4 w-4" />} label="Remove from group" onClick={() => { const m = memberMenu; setMemberMenu(null); void act(() => chatApi.removeMember(id, m.user_id), 'Removed'); }} />
          </div>
        )}
      </Sheet>

      <Sheet open={renaming} onClose={() => setRenaming(false)} title="Rename group">
        <div className="space-y-4 px-5 pb-5">
          <Field label="Group name" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={50} />
          <Button block size="lg" disabled={!newTitle.trim()} onClick={() => { setRenaming(false); void act(() => chatApi.updateGroup(id, { title: newTitle.trim() }), 'Renamed'); }}>Save</Button>
        </div>
      </Sheet>

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title}>
        {confirm && (
          <div className="space-y-4 px-5 pb-5">
            <p className="text-sm text-ink-soft">{confirm.body}</p>
            <div className="flex gap-2">
              <Button variant="glass" block onClick={() => setConfirm(null)}>Cancel</Button>
              <Button variant="danger" block loading={busy} onClick={async () => { setBusy(true); await confirm.run(); setBusy(false); setConfirm(null); }}>{confirm.action}</Button>
            </div>
          </div>
        )}
      </Sheet>

      <NewGroupSheet open={adding} onClose={() => { setAdding(false); void load(); }} addTo={id} exclude={members.map((m) => m.user_id)} />
    </div>
  );
}

function DangerRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-aurora-coral active:bg-white/5">
      {icon}
      <span className="text-[15px]">{label}</span>
    </button>
  );
}
