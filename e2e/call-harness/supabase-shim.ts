// Test-only stand-in for '@/lib/supabase': relays Realtime broadcasts between
// tabs with BroadcastChannel so two real RTCPeerConnections can negotiate.
type Cb = (msg: { payload: unknown }) => void;
export const supabase = {
  channel(name: string) {
    const bc = new BroadcastChannel(name);
    const handlers: Cb[] = [];
    bc.onmessage = (e) => handlers.forEach((h) => h({ payload: e.data }));
    const ch = {
      on(_t: string, _f: unknown, cb: Cb) {
        handlers.push(cb);
        return ch;
      },
      subscribe(cb: (s: string) => void) {
        setTimeout(() => cb('SUBSCRIBED'), 50);
        return ch;
      },
      send({ payload }: { payload: unknown }) {
        bc.postMessage(payload);
        return Promise.resolve('ok');
      },
      _bc: bc,
    };
    return ch;
  },
  removeChannel(ch: { _bc: BroadcastChannel }) {
    ch._bc.close();
    return Promise.resolve();
  },
};
