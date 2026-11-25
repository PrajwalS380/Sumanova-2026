import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { iceServers } from './config';
import type { CallKind } from './api';

/**
 * Group call (mesh): one RTCPeerConnection per other person, all signalled over the same private
 * Realtime channel as 1:1 calls ("call:<id>", participants only). No media server — free — and
 * practical for up to 6 people. For each pair, the person with the smaller user id makes the offer,
 * so two people never offer to each other at the same time.
 */
type Signal =
  | { type: 'hello'; from: string; to?: string }
  | { type: 'offer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; from: string; to: string; candidate: RTCIceCandidateInit }
  | { type: 'media'; from: string; audio: boolean; video: boolean }
  | { type: 'bye'; from: string };

export interface GroupPeer {
  id: string;
  stream: MediaStream;
  audio: boolean;
  video: boolean;
  state: 'connecting' | 'connected' | 'reconnecting';
}

export interface GroupEvents {
  onLocalStream: (s: MediaStream) => void;
  onPeers: (peers: GroupPeer[]) => void;
  onError: (message: string) => void;
}

/** Who makes the offer for a pair (deterministic, so both sides agree). */
export const isOfferer = (me: string, other: string) => me < other;

interface Link {
  pc: RTCPeerConnection;
  peer: GroupPeer;
  pendingIce: RTCIceCandidateInit[];
  resend?: ReturnType<typeof setInterval>;
  restarts: number;
}

export class GroupCallSession {
  private channel: RealtimeChannel | null = null;
  private local: MediaStream | null = null;
  private links = new Map<string, Link>();
  private closed = false;
  private helloLoop: ReturnType<typeof setInterval> | null = null;
  facing: 'user' | 'environment' = 'user';
  audioOn = true;
  videoOn: boolean;

  constructor(readonly callId: string, readonly kind: CallKind, readonly me: string, private ev: GroupEvents) {
    this.videoOn = kind === 'video';
  }

  async start() {
    try {
      this.local = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        // Smaller video in groups keeps every phone's upload manageable (one copy per person).
        video: this.kind === 'video' ? { facingMode: this.facing, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 24 } } : false,
      });
    } catch (e) {
      const name = (e as DOMException).name;
      throw new Error(name === 'NotAllowedError' ? `Allow ${this.kind === 'video' ? 'camera and microphone' : 'microphone'} access to join calls.` : 'Couldn’t access your microphone/camera.');
    }
    this.ev.onLocalStream(this.local);
    await new Promise<void>((resolve, reject) => {
      const ch = supabase.channel(`call:${this.callId}`, { config: { private: true, broadcast: { self: false, ack: false } } });
      ch.on('broadcast', { event: 'signal' }, ({ payload }) => void this.onSignal(payload as Signal));
      ch.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(err?.message ?? 'Couldn’t reach the call server.'));
      });
      this.channel = ch;
    });
    // Announce myself for a while (broadcasts aren't stored, so late joiners need repeats).
    let n = 0;
    const hello = () => {
      if (this.closed || n++ > 20) return this.helloLoop && clearInterval(this.helloLoop);
      this.send({ type: 'hello', from: this.me });
    };
    hello();
    this.helloLoop = setInterval(hello, 2000);
  }

  private send(s: Signal) {
    void this.channel?.send({ type: 'broadcast', event: 'signal', payload: s });
  }

  private emit() {
    this.ev.onPeers([...this.links.values()].map((l) => ({ ...l.peer })));
  }

  private link(other: string): Link {
    const existing = this.links.get(other);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: iceServers(), bundlePolicy: 'max-bundle' });
    const l: Link = { pc, peer: { id: other, stream: new MediaStream(), audio: true, video: this.kind === 'video', state: 'connecting' }, pendingIce: [], restarts: 0 };
    this.links.set(other, l);
    this.local?.getTracks().forEach((t) => pc.addTrack(t, this.local!));
    pc.ontrack = (e) => {
      const tracks = e.streams[0]?.getTracks() ?? [e.track];
      tracks.forEach((t) => {
        if (!l.peer.stream.getTracks().includes(t)) l.peer.stream.addTrack(t);
      });
      // New stream object so React re-binds the <video>.
      l.peer.stream = new MediaStream(l.peer.stream.getTracks());
      this.emit();
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send({ type: 'ice', from: this.me, to: other, candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (this.closed) return;
      const st = pc.connectionState;
      if (st === 'connected') {
        l.restarts = 0;
        l.peer.state = 'connected';
        if (l.resend) clearInterval(l.resend);
      } else if (st === 'disconnected') {
        l.peer.state = 'reconnecting';
      } else if (st === 'failed') {
        l.peer.state = 'reconnecting';
        void this.restart(other);
      } else if (st === 'closed') {
        return;
      }
      this.emit();
    };
    this.emit();
    if (isOfferer(this.me, other)) void this.offer(other);
    return l;
  }

  private async offer(other: string, iceRestart = false) {
    const l = this.links.get(other);
    if (!l || this.closed) return;
    const offer = await l.pc.createOffer({ iceRestart });
    await l.pc.setLocalDescription(offer);
    this.send({ type: 'offer', from: this.me, to: other, sdp: offer });
    if (l.resend) clearInterval(l.resend);
    let n = 0;
    l.resend = setInterval(() => {
      if (l.pc.remoteDescription || this.closed || n++ > 6) return clearInterval(l.resend);
      this.send({ type: 'offer', from: this.me, to: other, sdp: l.pc.localDescription! });
    }, 2000);
  }

  private async restart(other: string) {
    const l = this.links.get(other);
    if (!l || this.closed) return;
    if (l.restarts++ >= 3) return this.drop(other);
    if (isOfferer(this.me, other)) await this.offer(other, true).catch(() => this.drop(other));
  }

  private drop(other: string) {
    const l = this.links.get(other);
    if (!l) return;
    if (l.resend) clearInterval(l.resend);
    l.pc.close();
    this.links.delete(other);
    this.emit();
  }

  private async onSignal(s: Signal) {
    if (this.closed || s.from === this.me) return;
    if ('to' in s && s.to && s.to !== this.me) return;
    try {
      switch (s.type) {
        case 'hello':
          if (!this.links.has(s.from)) {
            this.link(s.from);
            // Reply directly so the newcomer learns about me even if my hellos have stopped.
            this.send({ type: 'hello', from: this.me, to: s.from });
          }
          break;
        case 'offer': {
          const l = this.link(s.from);
          if (l.pc.signalingState !== 'stable' && l.pc.signalingState !== 'have-remote-offer') return;
          if (l.pc.remoteDescription?.sdp === s.sdp.sdp && l.pc.signalingState === 'stable') return; // duplicate
          await l.pc.setRemoteDescription(s.sdp);
          for (const c of l.pendingIce.splice(0)) await l.pc.addIceCandidate(c).catch(() => undefined);
          const answer = await l.pc.createAnswer();
          await l.pc.setLocalDescription(answer);
          this.send({ type: 'answer', from: this.me, to: s.from, sdp: answer });
          this.sendMedia();
          break;
        }
        case 'answer': {
          const l = this.links.get(s.from);
          if (!l || l.pc.signalingState !== 'have-local-offer') return;
          await l.pc.setRemoteDescription(s.sdp);
          for (const c of l.pendingIce.splice(0)) await l.pc.addIceCandidate(c).catch(() => undefined);
          this.sendMedia();
          break;
        }
        case 'ice': {
          const l = this.links.get(s.from);
          if (!l) return;
          if (l.pc.remoteDescription) await l.pc.addIceCandidate(s.candidate).catch(() => undefined);
          else l.pendingIce.push(s.candidate);
          break;
        }
        case 'media': {
          const l = this.links.get(s.from);
          if (!l) return;
          l.peer.audio = s.audio;
          l.peer.video = s.video;
          this.emit();
          break;
        }
        case 'bye':
          this.drop(s.from);
          break;
      }
    } catch (e) {
      console.warn('[group-call] signal error', e);
    }
  }

  private sendMedia() {
    this.send({ type: 'media', from: this.me, audio: this.audioOn, video: this.videoOn });
  }

  /** Someone's participant row says they left — close their link even if their "bye" was lost. */
  removePeer(id: string) {
    this.drop(id);
  }

  setMuted(muted: boolean) {
    this.audioOn = !muted;
    this.local?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.sendMedia();
  }

  setVideo(on: boolean) {
    if (this.kind !== 'video') return;
    this.videoOn = on;
    this.local?.getVideoTracks().forEach((t) => (t.enabled = on));
    this.sendMedia();
  }

  async switchCamera() {
    if (this.kind !== 'video' || !this.local) return;
    const next = this.facing === 'user' ? 'environment' : 'user';
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: next }, width: { ideal: 640 }, height: { ideal: 480 } } }).catch(() =>
      navigator.mediaDevices.getUserMedia({ video: { facingMode: next } }),
    );
    const track = stream.getVideoTracks()[0];
    for (const l of this.links.values()) await l.pc.getSenders().find((s) => s.track?.kind === 'video')?.replaceTrack(track);
    this.local.getVideoTracks().forEach((t) => {
      t.stop();
      this.local!.removeTrack(t);
    });
    track.enabled = this.videoOn;
    this.local.addTrack(track);
    this.facing = next;
    this.ev.onLocalStream(this.local);
  }

  leave() {
    this.send({ type: 'bye', from: this.me });
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.helloLoop) clearInterval(this.helloLoop);
    for (const id of [...this.links.keys()]) this.drop(id);
    this.local?.getTracks().forEach((t) => t.stop());
    if (this.channel) void supabase.removeChannel(this.channel);
    this.channel = null;
  }
}
