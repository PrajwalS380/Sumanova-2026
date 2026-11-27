import { useEffect, useState } from 'react';
import { Pin as PinIcon, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { pinsApi, type Pin } from '@/lib/chat/more';
import type { LocalMessage } from '@/lib/chat/types';
import { wallpaperFor } from './wallpaper';

/** Pinned messages of a chat, live. */
export function usePins(chatId: string) {
  const [pins, setPins] = useState<Pin[]>([]);
  useEffect(() => {
    if (!chatId) return;
    let alive = true;
    const load = () => void pinsApi.list(chatId).then((p) => alive && setPins(p)).catch(() => undefined);
    load();
    const ch = supabase.channel(`pins:${chatId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'message_pins', filter: `conversation_id=eq.${chatId}` }, load).subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(ch);
    };
  }, [chatId]);
  return { pins, setPins };
}

/** This phone's wallpaper for a chat (pattern or photo). */
export function useWallpaper(chatId: string) {
  const [wall, setWall] = useState<{ css: string; dark: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    const load = () =>
      void wallpaperFor(chatId).then((w) => {
        if (!alive) return;
        if (url) URL.revokeObjectURL(url);
        url = w?.css.match(/url\((blob:[^)]+)\)/)?.[1] ?? null;
        setWall(w);
      });
    load();
    const on = (e: Event) => (e as CustomEvent).detail === chatId && load();
    window.addEventListener('snv-wallpaper', on);
    return () => {
      alive = false;
      window.removeEventListener('snv-wallpaper', on);
      if (url) URL.revokeObjectURL(url);
    };
  }, [chatId]);
  return wall;
}

const label = (m?: LocalMessage) =>
  !m ? 'Pinned message' : m.deleted_at ? 'Deleted message' : m.body?.startsWith('e2e:') ? 'Encrypted message' : m.kind === 'text' ? m.body ?? '' : m.kind === 'todo' ? `To-do: ${m.body}` : m.kind === 'poll' ? `Poll: ${m.body}` : m.kind === 'image' ? 'Photo' : m.kind === 'video' ? 'Video' : m.kind === 'voice' ? 'Voice note' : m.body ?? 'Message';

/** Bar under the chat header: tap to jump to a pinned message (cycles through them). */
export function PinnedBar({ pins, byId, onJump, onUnpin }: { pins: Pin[]; byId: Map<string, LocalMessage>; onJump: (id: string) => void; onUnpin: (id: string) => void }) {
  const [i, setI] = useState(0);
  if (!pins.length) return null;
  const k = i % pins.length;
  const p = pins[k];
  return (
    <div className="z-20 mx-3 mb-1 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-card">
      <button
        type="button"
        onClick={() => {
          onJump(p.message_id);
          setI(k + 1);
        }}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        aria-label="Go to pinned message"
      >
        <span className="flex flex-col gap-0.5">
          {pins.map((x, j) => <span key={x.message_id} className={j === k ? 'h-2.5 w-[3px] rounded-full bg-ember-flame' : 'h-2.5 w-[3px] rounded-full bg-ink/15'} />)}
        </span>
        <PinIcon className="h-4 w-4 shrink-0 text-ember-flame" />
        <span className="min-w-0">
          <span className="block text-[11px] font-extrabold text-ember-flame">Pinned{pins.length > 1 ? ` · ${k + 1} of ${pins.length}` : ''}</span>
          <span className="block truncate text-sm font-semibold">{label(byId.get(p.message_id))}</span>
        </span>
      </button>
      <button type="button" onClick={() => onUnpin(p.message_id)} aria-label="Unpin" className="grid h-8 w-8 place-items-center rounded-xl text-ink-mute"><X className="h-4 w-4" /></button>
    </div>
  );
}
