import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { CONNECT_TIMEOUT_MS, RECONNECT_GRACE_MS, iceServers } from './config';
import type { CallKind } from './api';

export type CallPhase = 'preparing' | 'ringing' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'failed';
export type Quality = 'good' | 'fair' | 'poor' | 'unknown';

type Signal =
  | { type: 'ready'; from: string }
  | { type: 'offer'; from: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; from: string; candidate: RTCIceCandidateInit }
  | { type: 'hangup'; from: string }
  | { type: 'media'; from: string; audio: boolean; video: boolean };

export interface SessionEvents {
  onPhase: (p: CallPhase, detail?: string) => void;
  onLocalStream: (s: MediaStream) => void;
  onRemoteStream: (s: MediaStream) => void;
  onRemoteMedia: (m: { audio: boolean; video: boolean }) => void;
  onQuality: (q: Quality) => void;
  onHangup: () => void;
}

/**
 * One 1:1 WebRTC call. The caller makes the offer once the callee signals
 * "ready"; ICE candidates trickle over a private Realtime channel and are
 * buffered until the remote description is set. Handles mute/camera/switch,
 * ICE-restart on drops, connection timeouts and full cleanup.
 */
export class CallSession {
  private pc: RTCPeerConnection | null = null;
  private channel: RealtimeChannel | null = null;
  private local: MediaStream | null = null;
  private remote = new MediaStream();
  private pendingIce: RTCIceCandidateInit[] = [];
  private offered = false;
  private gotOffer = false;
  private closed = false;
  private restarts = 0;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private readyLoop: ReturnType<typeof setInterval> | null = null;
  private statsLoop: ReturnType<typeof setInterval> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  facing: 'user' | 'environment' = 'user';
  audioOn = true;
  videoOn: boolean;

  constructor(
    readonly callId: string,
    readonly role: 'caller' | 'callee',
    readonly kind: CallKind,
    readonly me: string,
    private ev: SessionEvents,
  ) {
    this.videoOn = kind === 'video';
  }

  /** Acquire camera/mic and join the signalling channel. */
  async start() {
    this.ev.onPhase('preparing');
    try {
      this.local = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: this.kind === 'video' ? { facingMode: this.facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } : false,
      });
    } catch (e) {
      const name = (e as DOMException).name;
      throw new Error(name === 'NotAllowedError' ? `Allow ${this.kind === 'video' ? 'camera and microphone' : 'microphone'} access to make calls.` : 'Couldn’t access your microphone/camera.');
    }
    this.ev.onLocalStream(this.local);
    this.createPeer();
    await this.joinChannel();
    if (this.role === 'callee') this.announceReady();
    else this.ev.onPhase('ringing');
  }

  private createPeer() {
    const pc = new RTCPeerConnection({ iceServers: iceServers(), bundlePolicy: 'max-bundle' });
    this.pc = pc;
    this.local?.getTracks().forEach((t) => pc.addTrack(t, this.local!));
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => {
        if (!this.remote.getTracks().includes(t)) this.remote.addTrack(t);
      });
      this.ev.onRemoteStream(this.remote);
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send({ type: 'ice', from: this.me, candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => this.onConnState(pc.connectionState);
  }

  private onConnState(state: RTCPeerConnectionState) {
    if (this.closed) return;
    if (state === 'connected') {
      if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
      this.restarts = 0;
      this.ev.onPhase('connected');
      this.startStats();
    } else if (state === 'disconnected') {
      this.ev.onPhase('reconnecting');
      this.disconnectTimer = setTimeout(() => this.tryRestart(), RECONNECT_GRACE_MS);
    } else if (state === 'failed') {
      this.tryRestart();
    }
  }

  private async tryRestart() {
    if (this.closed || !this.pc) return;
    if (this.restarts >= 3) {
      this.fail('The connection was lost.');
      return;
    }
    this.restarts++;
    this.ev.onPhase('reconnecting');
    if (this.role === 'caller') {
      try {
        const offer = await this.pc.createOffer({ iceRestart: true });
        await this.pc.setLocalDescription(offer);
        this.send({ type: 'offer', from: this.me, sdp: offer });
      } catch {
        this.fail('The connection was lost.');
      }
    }
    this.timers.push(setTimeout(() => this.pc?.connectionState !== 'connected' && this.tryRestart(), 8000));
  }

  private async joinChannel() {
    await new Promise<void>((resolve, reject) => {
      const ch = supabase.channel(`call:${this.callId}`, { config: { private: true, broadcast: { self: false, ack: false } } });
      ch.on('broadcast', { event: 'signal' }, ({ payload }) => void this.onSignal(payload as Signal));
      ch.subscribe((status, err) => {
        if (status === 'SUBSCRIBED') resolve();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(err?.message ?? 'Couldn’t reach the call server.'));
      });
      this.channel = ch;
    });
  }

  private send(s: Signal) {
    void this.channel?.send({ type: 'broadcast', event: 'signal', payload: s });
  }

  /** Callee repeats "ready" until the offer arrives (broadcasts aren't stored). */
  private announceReady() {
    this.ev.onPhase('connecting');
    let n = 0;
    const tick = () => {
      if (this.gotOffer || this.closed || n++ > 12) {
        if (this.readyLoop) clearInterval(this.readyLoop);
        return;
      }
      this.send({ type: 'ready', from: this.me });
    };
    tick();
    this.readyLoop = setInterval(tick, 1500);
    this.timers.push(setTimeout(() => this.pc?.connectionState !== 'connected' && !this.closed && this.fail('Couldn’t connect. One of you may be on a network that blocks calls.'), CONNECT_TIMEOUT_MS));
  }

  /** Caller: the other side accepted (via DB status or "ready" signal). */
  async onAccepted() {
    if (this.role !== 'caller' || this.offered || !this.pc) return;
    this.offered = true;
    this.ev.onPhase('connecting');
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.send({ type: 'offer', from: this.me, sdp: offer });
    // Re-send the offer a couple of times in case the callee subscribed late.
    const resend = setInterval(() => {
      if (this.pc?.remoteDescription || this.closed) return clearInterval(resend);
      this.send({ type: 'offer', from: this.me, sdp: this.pc!.localDescription! });
    }, 2000);
    this.timers.push(setTimeout(() => clearInterval(resend), 12_000));
    this.timers.push(setTimeout(() => this.pc?.connectionState !== 'connected' && !this.closed && this.fail('Couldn’t connect. One of you may be on a network that blocks calls.'), CONNECT_TIMEOUT_MS));
  }

  private async onSignal(s: Signal) {
    if (this.closed || !this.pc || s.from === this.me) return;
    try {
      switch (s.type) {
        case 'ready':
          await this.onAccepted();
          break;
        case 'offer': {
          if (this.role !== 'callee') return;
          // Ignore duplicate offers we've already answered (unless it's an ICE restart).
          if (this.gotOffer && this.pc.signalingState === 'stable' && this.pc.remoteDescription?.sdp === s.sdp.sdp) return;
          this.gotOffer = true;
          await this.pc.setRemoteDescription(s.sdp);
          await this.flushIce();
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          this.send({ type: 'answer', from: this.me, sdp: answer });
          this.sendMediaState();
          break;
        }
        case 'answer':
          if (this.role !== 'caller' || this.pc.signalingState !== 'have-local-offer') return;
          await this.pc.setRemoteDescription(s.sdp);
          await this.flushIce();
          this.sendMediaState();
          break;
        case 'ice':
          if (this.pc.remoteDescription) await this.pc.addIceCandidate(s.candidate).catch(() => undefined);
          else this.pendingIce.push(s.candidate);
          break;
        case 'media':
          this.ev.onRemoteMedia({ audio: s.audio, video: s.video });
          break;
        case 'hangup':
          this.ev.onHangup();
          break;
      }
    } catch (e) {
      console.warn('[call] signal error', e);
    }
  }

  private async flushIce() {
    const list = this.pendingIce.splice(0);
    for (const c of list) await this.pc?.addIceCandidate(c).catch(() => undefined);
  }

  private sendMediaState() {
    this.send({ type: 'media', from: this.me, audio: this.audioOn, video: this.videoOn });
  }

  private startStats() {
    if (this.statsLoop) return;
    let lastLost = 0;
    let lastRecv = 0;
    this.statsLoop = setInterval(async () => {
      if (!this.pc) return;
      const stats = await this.pc.getStats();
      let rtt = 0;
      let lost = 0;
      let recv = 0;
      stats.forEach((r) => {
        if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) rtt = r.currentRoundTripTime ?? 0;
        if (r.type === 'inbound-rtp') {
          lost += r.packetsLost ?? 0;
          recv += r.packetsReceived ?? 0;
        }
      });
      const dl = lost - lastLost;
      const dr = recv - lastRecv;
      lastLost = lost;
      lastRecv = recv;
      const loss = dr + dl > 0 ? dl / (dr + dl) : 0;
      this.ev.onQuality(rtt > 0.6 || loss > 0.08 ? 'poor' : rtt > 0.3 || loss > 0.03 ? 'fair' : 'good');
    }, 2500);
  }

  setMuted(muted: boolean) {
    this.audioOn = !muted;
    this.local?.getAudioTracks().forEach((t) => (t.enabled = !muted));
    this.sendMediaState();
  }

  async setVideo(on: boolean) {
    if (this.kind !== 'video') return;
    this.videoOn = on;
    this.local?.getVideoTracks().forEach((t) => (t.enabled = on));
    this.sendMediaState();
  }

  async switchCamera() {
    if (this.kind !== 'video' || !this.local || !this.pc) return;
    const next = this.facing === 'user' ? 'environment' : 'user';
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: next }, width: { ideal: 1280 }, height: { ideal: 720 } } }).catch(() =>
      navigator.mediaDevices.getUserMedia({ video: { facingMode: next } }),
    );
    const track = stream.getVideoTracks()[0];
    const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
    await sender?.replaceTrack(track);
    this.local.getVideoTracks().forEach((t) => {
      t.stop();
      this.local!.removeTrack(t);
    });
    track.enabled = this.videoOn;
    this.local.addTrack(track);
    this.facing = next;
    this.ev.onLocalStream(this.local);
  }

  private fail(reason: string) {
    if (this.closed) return;
    this.ev.onPhase('failed', reason);
  }

  hangup() {
    this.send({ type: 'hangup', from: this.me });
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.timers.forEach(clearTimeout);
    if (this.readyLoop) clearInterval(this.readyLoop);
    if (this.statsLoop) clearInterval(this.statsLoop);
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.local?.getTracks().forEach((t) => t.stop());
    this.remote.getTracks().forEach((t) => t.stop());
    this.pc?.getSenders().forEach((s) => s.track?.stop());
    this.pc?.close();
    this.pc = null;
    if (this.channel) void supabase.removeChannel(this.channel);
    this.channel = null;
    this.ev.onPhase('ended');
  }
}
