import { CallSession } from '@/lib/calls/session';
const q = new URLSearchParams(location.search);
const role = q.get('role') as 'caller' | 'callee';
const kind = (q.get('kind') ?? 'video') as 'voice' | 'video';
const w = window as unknown as Record<string, unknown>;
w.phases = [] as string[];
w.remoteTracks = 0;
w.remoteMedia = null;
w.hungUp = false;
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
