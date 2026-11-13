import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { isNative } from '@/lib/platform';
import { useAuth } from './AuthProvider';
import { useToast } from './ToastProvider';
import { useInboxOptional } from './InboxProvider';

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  actor_id: string | null;
  created_at: string;
  read_at: string | null;
}

interface Ctx {
  items: AppNotification[];
  unread: number;
  refresh: () => Promise<void>;
  markAllRead: () => Promise<void>;
  open: (n: AppNotification) => void;
}
const C = createContext<Ctx | null>(null);

let localId = 1;
async function nativeNotify(title: string, body: string | null, url: string | null) {
  // Android app: show a system notification when the app is in the background but still alive.
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted' && (await LocalNotifications.requestPermissions()).display !== 'granted') return;
  await LocalNotifications.schedule({ notifications: [{ id: localId++, title, body: body ?? '', extra: { url } }] });
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const me = session?.user.id;
  const toast = useToast();
  const navigate = useNavigate();
  const inbox = useInboxOptional();
  const [items, setItems] = useState<AppNotification[]>([]);

  const refresh = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase.from('notifications').select('id,kind,title,body,url,actor_id,created_at,read_at').order('created_at', { ascending: false }).limit(60);
    setItems((data as AppNotification[]) ?? []);
  }, [me]);

  useEffect(() => {
    if (!me) return;
    void refresh();
    const ch = supabase
      .channel(`notifications:${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` }, (p) => {
        const n = p.new as AppNotification;
        setItems((list) => [n, ...list].slice(0, 60));
        if (document.hidden && isNative) void nativeNotify(n.title, n.body, n.url);
        else if (!document.hidden) toast(n.title, 'info');
      })
      .subscribe();
    return () => void supabase.removeChannel(ch);
  }, [me, refresh, toast]);

  // Android app: system notification for new chat messages while backgrounded.
  useEffect(() => {
    if (!isNative || !inbox || !me) return;
    return inbox.subscribeMessages(({ eventType, new: n }) => {
      const m = n as { sender_id: string | null; kind: string; body: string | null; conversation_id: string };
      if (eventType !== 'INSERT' || !document.hidden || !m.sender_id || m.sender_id === me || m.kind === 'system') return;
      const conv = inbox.conversations.find((c) => c.id === m.conversation_id);
      if (conv?.muted) return;
      const title = conv?.kind === 'group' ? conv.title ?? 'Group' : conv?.other_display_name ?? 'New message';
      void nativeNotify(title, m.kind === 'text' ? m.body : 'Sent you something ✦', `/chat/${m.conversation_id}`);
    });
  }, [inbox, me]);

  // Taps on push / local notifications deep-link inside the app.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'navigate' && typeof e.data.url === 'string' && e.data.url.startsWith('/')) navigate(e.data.url);
    };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    let remove: (() => void) | undefined;
    if (isNative) {
      void import('@capacitor/local-notifications').then(({ LocalNotifications }) =>
        LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
          const url = (a.notification.extra as { url?: string } | undefined)?.url;
          if (url?.startsWith('/')) navigate(url);
        }).then((h) => (remove = () => void h.remove())),
      );
    }
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onMsg);
      remove?.();
    };
  }, [navigate]);

  const value = useMemo<Ctx>(() => ({
    items,
    unread: items.filter((n) => !n.read_at).length,
    refresh,
    markAllRead: async () => {
      const ids = items.filter((n) => !n.read_at).map((n) => n.id);
      if (!ids.length) return;
      const now = new Date().toISOString();
      setItems((l) => l.map((n) => (n.read_at ? n : { ...n, read_at: now })));
      await supabase.from('notifications').update({ read_at: now }).in('id', ids);
    },
    open: (n) => {
      if (!n.read_at) {
        const now = new Date().toISOString();
        setItems((l) => l.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)));
        void supabase.from('notifications').update({ read_at: now }).eq('id', n.id);
      }
      if (n.url?.startsWith('/')) navigate(n.url);
    },
  }), [items, navigate, refresh]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export const useNotifications = () => {
  const c = useContext(C);
  if (!c) throw new Error('useNotifications outside provider');
  return c;
};
export const useNotificationsOptional = () => useContext(C);
