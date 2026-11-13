import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { snapsApi, type SnapRecipient, type SnapRow } from '@/lib/snaps/api';

/** Status rows + snap metadata for the snaps visible in a conversation, kept live. */
export function useSnapStatuses(snapIds: string[]) {
  const key = useMemo(() => [...new Set(snapIds)].sort().join(','), [snapIds]);
  const [rows, setRows] = useState<SnapRecipient[]>([]);
  const [snaps, setSnaps] = useState<Record<string, SnapRow>>({});

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (!ids.length) return;
    let alive = true;
    void snapsApi.recipients(ids).then((r) => alive && setRows(r)).catch(() => undefined);
    void supabase.from('snaps').select('*').in('id', ids).then(({ data }) => {
      if (alive && data) setSnaps(Object.fromEntries((data as SnapRow[]).map((s) => [s.id, s])));
    });
    const ch = supabase
      .channel(`snaps:${ids[0]}:${ids.length}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'snap_recipients' }, (p) => {
        const r = p.new as SnapRecipient;
        if (!r?.snap_id || !ids.includes(r.snap_id)) return;
        setRows((list) => [...list.filter((x) => !(x.snap_id === r.snap_id && x.recipient_id === r.recipient_id)), r]);
      })
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(ch);
    };
  }, [key]);

  return { rows, snaps, setRows };
}
