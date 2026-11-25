import { useEffect, useState } from 'react';
import { CalendarDays, Check, Loader2, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { getPosition } from '@/features/map/api';
import { NovaEmoji } from '@/components/emoji/NovaEmoji';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';

interface Hangout { id: string; title: string; place_name: string | null; lat: number | null; lng: number | null; starts_at: string; creator_id: string; cancelled_at: string | null }
interface Rsvp { user_id: string; status: 'going' | 'maybe' | 'no'; checked_in_at: string | null }

/** Hangout card in a chat: when + where, RSVPs (live), check in when you arrive. */
export function HangoutCard({ hangoutId }: { hangoutId: string }) {
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const toast = useToast();
  const [h, setH] = useState<Hangout | null>(null);
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      void supabase.from('hangouts').select('*').eq('id', hangoutId).maybeSingle().then(({ data }) => alive && setH(data as Hangout | null));
      void supabase.from('hangout_rsvps').select('user_id,status,checked_in_at').eq('hangout_id', hangoutId).then(({ data }) => alive && setRsvps((data ?? []) as Rsvp[]));
    };
    load();
    const ch = supabase.channel(`hangout:${hangoutId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'hangout_rsvps', filter: `hangout_id=eq.${hangoutId}` }, load).subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(ch);
    };
  }, [hangoutId]);

  async function run(key: string, fn: () => Promise<{ error: { message: string } | null }>, ok?: string) {
    setBusy(key);
    try {
      const { error } = await fn();
      if (error) throw new Error(error.message);
      haptic(8);
      if (ok) toast(ok, 'success');
      const { data } = await supabase.from('hangout_rsvps').select('user_id,status,checked_in_at').eq('hangout_id', hangoutId);
      setRsvps((data ?? []) as Rsvp[]);
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  }

  if (!h) return <div className="grid h-24 w-[260px] place-items-center rounded-[22px] bg-white"><Loader2 className="h-5 w-5 animate-spin text-ink-mute" /></div>;
  const mine = rsvps.find((r) => r.user_id === me);
  const going = rsvps.filter((r) => r.status === 'going').length;
  const maybe = rsvps.filter((r) => r.status === 'maybe').length;
  const here = rsvps.filter((r) => r.checked_in_at).length;
  const start = new Date(h.starts_at);
  const soon = Date.now() > start.getTime() - 2 * 3600_000 && Date.now() < start.getTime() + 6 * 3600_000;
  return (
    <div className={cn('w-[260px] max-w-full rounded-[22px] bg-white p-3.5 text-ink', h.cancelled_at && 'opacity-60')}>
      <div className="flex items-start gap-2.5">
        <NovaEmoji id="sparkle" size={34} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-black leading-tight">{h.title}</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-ink-mute"><CalendarDays className="h-3.5 w-3.5" /> {start.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p>
          {h.place_name && (
            <a href={h.lat != null ? `https://www.openstreetmap.org/?mlat=${h.lat}&mlon=${h.lng}#map=17/${h.lat}/${h.lng}` : undefined} target="_blank" rel="noreferrer" className="mt-0.5 flex items-center gap-1 text-xs font-bold text-ink-mute"><MapPin className="h-3.5 w-3.5" /> {h.place_name}</a>
          )}
        </div>
      </div>
      {h.cancelled_at ? (
        <p className="mt-2.5 text-xs font-extrabold text-ember-rose">Cancelled</p>
      ) : (
        <>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {(['going', 'maybe', 'no'] as const).map((s) => (
              <button key={s} disabled={!!busy} onClick={() => void run(s, async () => supabase.rpc('rsvp_hangout', { p_hangout: h.id, p_status: s }))} className={cn('rounded-xl py-2 text-xs font-extrabold capitalize', mine?.status === s ? 'bg-ink text-white' : 'bg-[#F1F1F4]')}>
                {s === 'no' ? 'Can’t' : s}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] font-semibold text-ink-mute">{going} going · {maybe} maybe{here ? ` · ${here} here now` : ''}</p>
          {soon && mine?.status !== 'no' && (
            mine?.checked_in_at ? (
              <p className="mt-2 flex items-center gap-1 text-xs font-extrabold text-ember-sage"><Check className="h-4 w-4" /> You’re checked in</p>
            ) : (
              <button disabled={!!busy} onClick={() => void run('in', async () => { const p = await getPosition(); return supabase.rpc('checkin_hangout', { p_hangout: h.id, p_lat: p.coords.latitude, p_lng: p.coords.longitude }); }, 'Checked in')} className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-ember-sage text-sm font-extrabold text-white">
                {busy === 'in' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} I’m here — check in
              </button>
            )
          )}
          {h.creator_id === me && <button onClick={() => window.confirm('Cancel this hangout?') && void run('x', async () => supabase.rpc('cancel_hangout', { p_hangout: h.id }), 'Cancelled')} className="mt-1.5 w-full py-1 text-[11px] font-bold text-ink-mute">Cancel hangout</button>}
        </>
      )}
    </div>
  );
}
