import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Mic, MicOff, Phone, PhoneOff, PictureInPicture2, SwitchCamera, Video, VideoOff, Volume2, Wifi, WifiOff } from 'lucide-react';
import { Avatar } from '@/components/Avatar';
import { useCalls } from '@/providers/CallProvider';
import { formatDuration } from '@/lib/chat/time';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';

/** Full-screen call UI: incoming, ringing, connecting, live voice/video. */
export default function CallOverlay() {
  const calls = useCalls();
  const s = calls.state;
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const remoteAudio = useRef<HTMLAudioElement>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [outIdx, setOutIdx] = useState(0);
  const [controls, setControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const isVideo = s?.call.kind === 'video';

  useEffect(() => {
    if (remoteVideo.current && s?.remote) remoteVideo.current.srcObject = s.remote;
    if (remoteAudio.current && s?.remote && !isVideo) remoteAudio.current.srcObject = s.remote;
  }, [s?.remote, isVideo]);
  useEffect(() => {
    if (localVideo.current && s?.local) localVideo.current.srcObject = s.local;
  }, [s?.local]);

  useEffect(() => {
    if (!s?.connectedAt) return;
    const t = setInterval(() => setElapsed((Date.now() - s.connectedAt!) / 1000), 500);
    return () => clearInterval(t);
  }, [s?.connectedAt]);

  // Audio output selection where the platform supports it (desktop Chrome, some Android builds).
  useEffect(() => {
    if (!('setSinkId' in HTMLMediaElement.prototype)) return;
    navigator.mediaDevices.enumerateDevices().then((d) => setOutputs(d.filter((x) => x.kind === 'audiooutput'))).catch(() => undefined);
  }, [s?.phase]);

  // Auto-hide controls during video calls; tap to show.
  useEffect(() => {
    if (!isVideo || s?.phase !== 'connected') return setControls(true);
    clearTimeout(hideTimer.current);
    if (controls) hideTimer.current = setTimeout(() => setControls(false), 4000);
    return () => clearTimeout(hideTimer.current);
  }, [controls, isVideo, s?.phase]);

  if (!s) return null;
  if (s.group && s.phase !== 'incoming') return createPortal(<GroupStage />, document.body);
  const name = s.group?.title ?? s.peer?.display_name ?? 'Unknown';
  const live = s.phase === 'connected' || s.phase === 'reconnecting';
  const showRemoteVideo = isVideo && live && s.remoteMedia.video;
  const statusText =
    s.phase === 'incoming' ? (s.group ? `Group ${s.call.kind} call` : `Incoming ${s.call.kind} call`) :
    s.phase === 'preparing' ? 'Starting…' :
    s.phase === 'ringing' ? 'Ringing…' :
    s.phase === 'connecting' ? 'Connecting…' :
    s.phase === 'reconnecting' ? 'Reconnecting…' :
    s.phase === 'connected' ? formatDuration(elapsed) :
    s.detail ?? 'Call ended';

  async function cycleOutput() {
    if (!outputs.length) return;
    const next = (outIdx + 1) % outputs.length;
    setOutIdx(next);
    const el = (isVideo ? remoteVideo.current : remoteAudio.current) as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
    await el?.setSinkId?.(outputs[next].deviceId).catch(() => undefined);
  }

  async function pip() {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await remoteVideo.current?.requestPictureInPicture();
    } catch {
      /* unsupported */
    }
  }

  return createPortal(
    <motion.div initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] overflow-hidden bg-noir text-white" onClick={() => setControls(true)} role="dialog" aria-label={`Call with ${name}`}>
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(90% 60% at 50% 20%, rgba(255,122,61,.45), transparent 70%), radial-gradient(80% 50% at 50% 100%, rgba(255,94,108,.25), transparent 70%), #0c0a09' }} />
      {isVideo && <video ref={remoteVideo} autoPlay playsInline className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-500', showRemoteVideo ? 'opacity-100' : 'opacity-0')} />}
      {!isVideo && <audio ref={remoteAudio} autoPlay />}

      {/* Local preview */}
      {isVideo && s.local && (
        <motion.div drag dragMomentum={false} dragConstraints={{ left: -260, right: 0, top: 0, bottom: 520 }} className={cn('absolute right-4 top-[calc(env(safe-area-inset-top)+4.5rem)] z-20 overflow-hidden rounded-3xl shadow-2xl ring-2 ring-white/20 transition-all', live ? 'h-44 w-28' : 'inset-0 right-0 top-0 h-full w-full rounded-none ring-0')}>
          <video ref={localVideo} autoPlay playsInline muted className={cn('h-full w-full object-cover', s.videoOn ? '' : 'opacity-0')} style={{ transform: 'scaleX(-1)' }} />
          {!s.videoOn && <div className="absolute inset-0 grid place-items-center bg-noir-800"><VideoOff className="h-6 w-6 text-ink-mute" /></div>}
        </motion.div>
      )}
      {isVideo && !live && s.local && <div className="absolute inset-0 z-[21] bg-black/45" />}

      {/* Identity */}
      <div className={cn('relative z-30 flex flex-col items-center pt-[calc(env(safe-area-inset-top)+3.5rem)] transition-all duration-500', showRemoteVideo && 'pt-[calc(env(safe-area-inset-top)+1rem)]')}>
        {!showRemoteVideo && (
          <div className="relative grid place-items-center">
            {(s.phase === 'ringing' || s.phase === 'incoming') && [0, 1, 2].map((i) => (
              <motion.span key={i} className="absolute h-36 w-36 rounded-full ring-2 ring-ember-amber/60" animate={{ scale: [1, 1.9], opacity: [0.6, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }} />
            ))}
            <Avatar name={name} url={s.group ? s.group.avatar : s.peer?.avatar_url} aura={s.peer?.aura_color ?? 'violet'} size={136} />
          </div>
        )}
        <h2 className={cn('font-display font-medium drop-shadow-lg', showRemoteVideo ? 'text-lg' : 'mt-6 text-3xl')}>{name}</h2>
        <p className={cn('mt-1 flex items-center gap-2 text-sm drop-shadow', s.phase === 'reconnecting' ? 'text-ember-gold' : 'text-ink-soft')}>
          {statusText}
          {live && s.quality !== 'unknown' && (
            <span className={cn('flex items-center gap-1 text-xs', s.quality === 'good' ? 'text-ember-sage' : s.quality === 'fair' ? 'text-ember-gold' : 'text-ember-rose')} aria-label={`Connection ${s.quality}`}>
              {s.quality === 'poor' ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
              {s.quality}
            </span>
          )}
        </p>
        {live && !s.remoteMedia.audio && <p className="mt-2 flex items-center gap-1 rounded-xl bg-black/40 px-3 py-1 text-xs"><MicOff className="h-3 w-3" /> {name.split(' ')[0]} is muted</p>}
      </div>

      {/* Controls */}
      <motion.div animate={{ y: controls ? 0 : 140, opacity: controls ? 1 : 0 }} transition={{ type: 'spring', stiffness: 380, damping: 34 }} className="absolute inset-x-0 bottom-0 z-30 flex justify-center pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        {s.phase === 'incoming' ? (
          <div className="flex w-full max-w-xs justify-between px-6">
            <RoundButton label="Decline" danger onClick={() => { haptic(14); void calls.decline(); }}><PhoneOff className="h-7 w-7" /></RoundButton>
            <RoundButton label="Accept" accept onClick={() => { haptic(14); void calls.accept(); }}>
              {isVideo ? <Video className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
            </RoundButton>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-full bg-black/35 p-2.5 ring-1 ring-white/10">
            <Ctl label={s.muted ? 'Unmute' : 'Mute'} active={s.muted} onClick={calls.toggleMute}>{s.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}</Ctl>
            {isVideo && <Ctl label={s.videoOn ? 'Turn camera off' : 'Turn camera on'} active={!s.videoOn} onClick={calls.toggleVideo}>{s.videoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}</Ctl>}
            {isVideo && <Ctl label="Switch camera" onClick={() => void calls.switchCamera()}><SwitchCamera className="h-6 w-6" /></Ctl>}
            {outputs.length > 1 && <Ctl label="Audio output" onClick={() => void cycleOutput()}><Volume2 className="h-6 w-6" /></Ctl>}
            {isVideo && live && 'pictureInPictureEnabled' in document && <Ctl label="Picture in picture" onClick={() => void pip()}><PictureInPicture2 className="h-6 w-6" /></Ctl>}
            <RoundButton label="End call" danger small onClick={() => { haptic(14); void calls.hangup(); }}><PhoneOff className="h-6 w-6" /></RoundButton>
          </div>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** Group call: a tile per person (video or avatar), with my own tile, and the usual controls. */
function GroupStage() {
  const calls = useCalls();
  const s = calls.state!;
  const g = s.group!;
  const isVideo = s.call.kind === 'video';
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!s.connectedAt) return;
    const t = setInterval(() => setElapsed((Date.now() - s.connectedAt!) / 1000), 500);
    return () => clearInterval(t);
  }, [s.connectedAt]);
  const tiles = g.peers.length + 1;
  const cols = tiles <= 2 ? 1 : 2;
  const status = s.phase === 'connected' ? `${formatDuration(elapsed)} · ${tiles} in call` : s.phase === 'ringing' ? 'Ringing the group…' : s.phase === 'preparing' ? 'Starting…' : 'Connecting…';
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[120] flex flex-col bg-[#0c0a09] text-white" role="dialog" aria-label={`Group call in ${g.title}`}>
      <header className="flex items-center gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <Avatar name={g.title} url={g.avatar} aura="violet" size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold">{g.title}</p>
          <p className="text-xs text-white/70">{status}</p>
        </div>
      </header>
      <div className={cn('grid flex-1 gap-2 px-2 pb-2', cols === 1 ? 'grid-cols-1' : 'grid-cols-2')} style={{ gridAutoRows: '1fr' }}>
        <Tile stream={s.local} mine name="You" profile={null} video={isVideo && s.videoOn} audio={!s.muted} state="connected" />
        {g.peers.map((p) => (
          <Tile key={p.id} stream={p.stream} name={g.people[p.id]?.display_name ?? 'Friend'} profile={g.people[p.id] ?? null} video={isVideo && p.video} audio={p.audio} state={p.state} />
        ))}
      </div>
      <div className="flex justify-center pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2">
        <div className="flex items-center gap-3 rounded-full bg-white/10 p-2.5">
          <Ctl label={s.muted ? 'Unmute' : 'Mute'} active={s.muted} onClick={calls.toggleMute}>{s.muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}</Ctl>
          {isVideo && <Ctl label={s.videoOn ? 'Turn camera off' : 'Turn camera on'} active={!s.videoOn} onClick={calls.toggleVideo}>{s.videoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}</Ctl>}
          {isVideo && <Ctl label="Switch camera" onClick={() => void calls.switchCamera()}><SwitchCamera className="h-6 w-6" /></Ctl>}
          <RoundButton label="Leave call" danger small onClick={() => { haptic(14); void calls.hangup(); }}><PhoneOff className="h-6 w-6" /></RoundButton>
        </div>
      </div>
    </motion.div>
  );
}

function Tile({ stream, name, profile, video, audio, state, mine }: { stream: MediaStream | null; name: string; profile: { avatar_url: string | null; aura_color: string } | null; video: boolean; audio: boolean; state: string; mine?: boolean }) {
  const v = useRef<HTMLVideoElement>(null);
  const a = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (v.current) v.current.srcObject = stream;
    if (a.current && !mine) a.current.srcObject = stream;
  }, [stream, mine]);
  return (
    <div className="relative isolate min-h-0 overflow-hidden rounded-3xl bg-white/[0.06]">
      <video ref={v} autoPlay playsInline muted className={cn('absolute inset-0 h-full w-full object-cover transition-opacity', video ? 'opacity-100' : 'opacity-0')} style={mine ? { transform: 'scaleX(-1)' } : undefined} />
      {!mine && <audio ref={a} autoPlay />}
      {!video && (
        <div className="absolute inset-0 grid place-items-center">
          <Avatar name={name} url={profile?.avatar_url ?? null} aura={(profile?.aura_color ?? 'violet') as never} size={84} />
        </div>
      )}
      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-xs font-bold">
        {!audio && <MicOff className="h-3 w-3" />} {name}
      </span>
      {state !== 'connected' && <span className="absolute right-2 top-2 rounded-lg bg-black/50 px-2 py-1 text-[11px] font-bold text-ember-gold">{state === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}</span>}
    </div>
  );
}

function Ctl({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); haptic(6); onClick(); }} aria-label={label} aria-pressed={active} className={cn('grid h-14 w-14 place-items-center rounded-2xl transition-colors active:scale-95', active ? 'bg-ember-cream text-noir' : 'bg-white/12 text-white hover:bg-white/20')} style={!active ? { backgroundColor: 'rgba(255,255,255,0.12)' } : undefined}>
      {children}
    </button>
  );
}

function RoundButton({ children, label, onClick, danger, accept, small }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean; accept?: boolean; small?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <motion.button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        aria-label={label}
        whileTap={{ scale: 0.92 }}
        animate={accept ? { y: [0, -6, 0] } : undefined}
        transition={accept ? { duration: 1.2, repeat: Infinity } : undefined}
        className={cn('grid place-items-center rounded-full text-white shadow-2xl', small ? 'h-14 w-14' : 'h-[72px] w-[72px]', danger && 'bg-[#e5484d]', accept && 'bg-gradient-to-br from-[#9fdc8f] to-[#4fb48a] shadow-[0_0_40px_rgba(255,94,108,.6)]')}
      >
        {children}
      </motion.button>
      {!small && <span className="text-xs text-ink-soft">{label}</span>}
    </div>
  );
}
