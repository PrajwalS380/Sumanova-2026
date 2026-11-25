import { CallSession } from '@/lib/calls/session';
import { GroupCallSession } from '@/lib/calls/group';
const q = new URLSearchParams(location.search);
const role = q.get('role') as 'caller' | 'callee';
const kind = (q.get('kind') ?? 'video') as 'voice' | 'video';
const w = window as unknown as Record<string, unknown>;
w.phases = [] as string[];
w.remoteTracks = 0;
w.remoteMedia = null;
w.hungUp = false;
if (q.get('group')) {
  // ?group=<my id>: mesh group call; window.peers mirrors the session's peer list.
  const g = new GroupCallSession('test-group', kind, q.get('group')!, {
    onLocalStream: () => undefined,
    onPeers: (p) => (w.peers = p.map((x) => ({ id: x.id, state: x.state, tracks: x.stream.getTracks().length, audio: x.audio }))),
    onError: (m) => (w.error = m),
  });
  w.session = g;
  w.ready = g.start().then(() => 'started');
} else {
  const s = new CallSession('test-call', role, kind, role, {
    onPhase: (p) => (w.phases as string[]).push(p),
    onLocalStream: () => undefined,
    onRemoteStream: (st) => (w.remoteTracks = st.getTracks().length),
    onRemoteMedia: (m) => (w.remoteMedia = m),
    onQuality: (qq) => (w.quality = qq),
    onHangup: () => (w.hungUp = true),
  });
  w.session = s;
  w.ready = s.start().then(() => 'started');
}
