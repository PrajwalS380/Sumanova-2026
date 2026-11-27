import { useEffect, useState } from 'react';
import { Check, ListChecks, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { todoApi, type TodoItem } from '@/lib/chat/more';
import { useToast } from '@/providers/ToastProvider';
import type { PublicProfile } from '@/lib/chat/types';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';

/** Shared to-do list in a chat: anyone in the chat can add, tick and remove items; updates live. */
export function TodoCard({ messageId, title, local, people }: { messageId: string; title: string; local: boolean; people: Record<string, PublicProfile> }) {
  const toast = useToast();
  const [items, setItems] = useState<TodoItem[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (local) return;
    let alive = true;
    const load = () => void todoApi.items(messageId).then((v) => alive && setItems(v)).catch(() => undefined);
    load();
    const ch = supabase.channel(`todo:${messageId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'todo_items', filter: `message_id=eq.${messageId}` }, load).subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(ch);
    };
  }, [messageId, local]);

  async function run(f: () => Promise<unknown>, optimistic: TodoItem[]) {
    const prev = items;
    setItems(optimistic);
    try {
      await f();
      setItems(await todoApi.items(messageId));
    } catch (e) {
      setItems(prev);
      toast((e as Error).message, 'error');
    }
  }
  function add() {
    const t = text.trim().slice(0, 120);
    if (!t) return;
    setText('');
    haptic(8);
    void run(() => todoApi.add(messageId, t), [...items, { id: `tmp-${Date.now()}`, message_id: messageId, text: t, done_by: null, done_at: null, created_by: null, created_at: new Date().toISOString() }]);
  }
  const done = items.filter((i) => i.done_at).length;

  return (
    <div className="w-[270px] max-w-full rounded-[22px] bg-white p-3.5 text-ink shadow-[0_1px_0_rgba(17,17,17,.06)]" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-ember-sage/15 text-ember-jade"><ListChecks className="h-4.5 w-4.5" /></span>
        <p className="flex-1 text-[15px] font-extrabold leading-snug">{title}</p>
        <span className="text-xs font-bold text-ink-mute">{done}/{items.length}</span>
      </div>
      <ul className="mt-2.5 space-y-1">
        {items.map((i) => (
          <li key={i.id} className="group flex items-center gap-2">
            <button
              onClick={() => { haptic(8); void run(() => todoApi.toggle(i.id), items.map((x) => (x.id === i.id ? { ...x, done_at: x.done_at ? null : new Date().toISOString() } : x))); }}
              disabled={local || i.id.startsWith('tmp-')}
              aria-label={i.done_at ? `Untick ${i.text}` : `Tick ${i.text}`}
              aria-pressed={!!i.done_at}
              className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2', i.done_at ? 'border-ember-jade bg-ember-jade text-white' : 'border-ink/25')}
            >
              {i.done_at && <Check className="h-3.5 w-3.5" />}
            </button>
            <span className={cn('min-w-0 flex-1 text-sm font-semibold [overflow-wrap:anywhere]', i.done_at && 'text-ink-mute line-through')}>
              {i.text}
              {i.done_at && i.done_by && people[i.done_by] && <span className="ml-1 text-[11px] font-normal no-underline">· {people[i.done_by].display_name.split(' ')[0]}</span>}
            </span>
            <button onClick={() => void run(() => todoApi.remove(i.id), items.filter((x) => x.id !== i.id))} disabled={local || i.id.startsWith('tmp-')} aria-label={`Remove ${i.text}`} className="grid h-6 w-6 place-items-center rounded-lg text-ink-faint"><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
      {!local && (
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="mt-2 flex items-center gap-1.5">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={120} placeholder="Add an item" aria-label="Add an item" className="h-9 min-w-0 flex-1 rounded-xl bg-[#F1F1F4] px-3 text-sm font-semibold outline-none" />
          <button type="submit" disabled={!text.trim()} aria-label="Add" className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-white disabled:opacity-40"><Plus className="h-4 w-4" /></button>
        </form>
      )}
    </div>
  );
}
