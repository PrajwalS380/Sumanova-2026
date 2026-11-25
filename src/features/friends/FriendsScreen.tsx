import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, Loader2, MessageCircle, Plus, Search, Share2, UserCheck, X } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { Ghost, GHOST_HOST } from '@/components/ui/Ghost';
import { useAuth } from '@/providers/AuthProvider';
import { useInbox } from '@/providers/InboxProvider';
import { useToast } from '@/providers/ToastProvider';
import { chatApi, friendsApi } from '@/lib/chat/api';
import type { Friend, FriendRequest, PublicProfile, SearchResult } from '@/lib/chat/types';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';

export default function FriendsScreen() {
  const { session, profile } = useAuth();
  const me = session!.user.id;
  const { pendingRequests } = useInbox();
  const toast = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [people, setPeople] = useState<Record<string, PublicProfile>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([friendsApi.list(), friendsApi.requests()]);
      setFriends(f);
      setRequests(r);
      const ids = [...new Set(r.flatMap((x) => [x.sender_id, x.receiver_id]).filter((x) => x !== me))];
      const profs = await chatApi.profiles(ids);
      setPeople(Object.fromEntries(profs.map((p) => [p.id, p])));
    } catch (e) {
      toast((e as Error).message, 'error');
      setFriends([]);
    }
  }, [me, toast]);

  useEffect(() => {
    void load();
  }, [load, pendingRequests]);

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        setResults(await friendsApi.search(q.replace(/^@/, '')));
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, toast]);

  async function run(key: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(key);
    try {
      await fn();
      haptic(10);
      if (success) toast(success, 'success');
      await load();
      if (query.trim().length >= 2) setResults(await friendsApi.search(query.trim().replace(/^@/, '')));
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function openChat(userId: string) {
    try {
      const id = await chatApi.getOrCreateDirect(userId);
      navigate(`/chat/${id}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const incoming = requests.filter((r) => r.receiver_id === me);
  const outgoing = requests.filter((r) => r.sender_id === me);

  return (
    <div className="min-h-full bg-noir pb-16">
      <header className="flex items-center gap-2 px-3.5 pb-3 pt-safe">
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-ink active:scale-90"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 text-center text-lg font-extrabold">Add friends</h1>
        <span className="w-10" aria-hidden />
      </header>
      <div className="mx-auto max-w-lg px-4">
        <label className="flex h-[46px] items-center gap-2.5 rounded-2xl bg-white px-3.5 focus-within:ring-2 focus-within:ring-ink/20">
          <Search className="h-5 w-5 text-ink-mute" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or username" autoCapitalize="none" spellCheck={false} className="h-full flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-ink-mute" aria-label="Search people" />
          {searching && <Loader2 className="h-4 w-4 animate-spin text-ink-mute" />}
          {query && !searching && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="text-ink-mute">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>

        {!query && profile && (
          <button onClick={() => navigate('/profile/code')} className={cn("mt-3.5 flex w-full items-center gap-3 rounded-tile bg-white p-3.5 text-left", GHOST_HOST)}>
            <Ghost url={profile.avatar_url} />
            <Avatar name={profile.display_name} url={profile.avatar_url} aura={profile.aura_color} size={48} />
            <span className="flex-1"><span className="block font-extrabold">Share my code</span><span className="text-xs text-ink-soft">Show your code, share your link, or scan a friend’s code</span></span>
            <Share2 className="h-[22px] w-[22px] text-ember-flame" />
          </button>
        )}

        <AnimatePresence mode="wait">
          {query.trim().length >= 2 ? (
            <motion.section key="results" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4">
              {!searching && results.length === 0 && <p className="py-10 text-center text-sm text-ink-mute">No one found. Try their exact username.</p>}
              <ul className="space-y-2">
                {results.map((p) => (
                  <PersonRow key={p.id} person={p} onClick={() => navigate(`/u/${p.username}`)}>
                    {p.relation === 'friend' ? (
                      <RowButton onClick={() => openChat(p.id)} icon={<MessageCircle className="h-4 w-4" />} label="Chat" />
                    ) : p.relation === 'outgoing' ? (
                      <span className="rounded-full bg-ink/5 px-3 py-1.5 text-xs text-ink-mute">Requested</span>
                    ) : p.relation === 'incoming' ? (
                      <RowButton primary loading={busy === p.id} onClick={() => run(p.id, () => friendsApi.send(p.id), 'You’re now friends!')} icon={<UserCheck className="h-4 w-4" />} label="Accept" />
                    ) : (
                      <RowButton loading={busy === p.id} onClick={() => run(p.id, () => friendsApi.send(p.id), 'Request sent')} icon={<Plus className="h-[15px] w-[15px]" strokeWidth={2.6} />} label="Add" />
                    )}
                  </PersonRow>
                ))}
              </ul>
            </motion.section>
          ) : (
            <motion.div key="lists" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {incoming.length > 0 && (
                <Section title={`Added me · ${incoming.length}`}>
                  {incoming.map((r) => {
                    const p = people[r.sender_id];
                    if (!p) return null;
                    return (
                      <PersonRow key={r.id} person={p}>
                        <RowButton primary loading={busy === r.id} onClick={() => run(r.id, () => friendsApi.respond(r.id, true), `You and ${p.display_name} are friends`)} label="Accept" />
                        <button aria-label="Ignore" disabled={busy === r.id} onClick={() => run(r.id, () => friendsApi.respond(r.id, false))} className="grid h-[34px] w-[34px] place-items-center rounded-full bg-[#F1F1F4] text-ink">
                          <X className="h-4 w-4" />
                        </button>
                      </PersonRow>
                    );
                  })}
                </Section>
              )}

              <Section title={friends ? `My friends · ${friends.length}` : 'My friends'}>
                {friends === null ? (
                  <SkeletonRows />
                ) : friends.length === 0 ? (
                  <div className="mt-2 rounded-3xl bg-[#ECECEF] p-6 text-center">
                    <p className="font-medium">No friends yet</p>
                    <p className="mt-1 text-sm text-ink-mute">Search for a username above to send your first request.</p>
                  </div>
                ) : (
                  friends.map((f) => (
                    <PersonRow key={f.id} person={f} onClick={() => navigate(`/u/${f.username}`)}>
                      <RowButton onClick={() => openChat(f.id)} icon={<MessageCircle className="h-4 w-4" />} label="Chat" />
                    </PersonRow>
                  ))
                )}
              </Section>

              {outgoing.length > 0 && (
                <Section title="Sent requests">
                  {outgoing.map((r) => {
                    const p = people[r.receiver_id];
                    if (!p) return null;
                    return (
                      <PersonRow key={r.id} person={p}>
                        <RowButton loading={busy === r.id} onClick={() => run(r.id, () => friendsApi.cancel(r.id), 'Request cancelled')} icon={<X className="h-4 w-4" />} label="Cancel" />
                      </PersonRow>
                    );
                  })}
                </Section>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h2 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-ink-mute">{title}</h2>
      <ul className="mt-2 rounded-tile bg-white px-3 py-1">{children}</ul>
    </section>
  );
}

function PersonRow({ person, children, onClick }: { person: PublicProfile; children: React.ReactNode; onClick?: () => void }) {
  return (
    <li className={cn('flex items-center gap-3 py-[9px]', GHOST_HOST)}>
      <Ghost url={person.avatar_url} />
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left" disabled={!onClick}>
        <Avatar name={person.display_name} url={person.avatar_url} aura={person.aura_color} size={50} />
        <span className="min-w-0">
          <span className="block truncate font-extrabold">{person.display_name}</span>
          <span className="block truncate text-xs text-ink-mute">@{person.username}</span>
        </span>
      </button>
      <span className="flex shrink-0 items-center gap-2">{children}</span>
    </li>
  );
}

function RowButton({ onClick, icon, label, primary, loading }: { onClick: () => void; icon?: React.ReactNode; label: string; primary?: boolean; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading} className={cn('flex items-center gap-1 rounded-full px-3.5 py-[9px] text-[13px] font-extrabold transition-transform active:scale-95 disabled:opacity-60', primary ? 'bg-ember-flame text-white' : 'bg-[#F1F1F4] text-ink')}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex h-[68px] items-center gap-3">
          <span className="h-[50px] w-[50px] animate-pulse rounded-full bg-ink/10" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-32 animate-pulse rounded bg-ink/10" />
            <span className="block h-2.5 w-20 animate-pulse rounded bg-ink/5" />
          </span>
        </li>
      ))}
    </>
  );
}
