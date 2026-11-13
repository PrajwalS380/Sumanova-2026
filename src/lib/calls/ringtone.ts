/**
 * Original ringtones synthesised with Web Audio (no audio files, no licensing).
 * Incoming: a bright rising two-note chime. Outgoing: a soft pulsing tone.
 */
let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function audio() {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function note(freq: number, start: number, dur: number, gain = 0.12) {
  const a = audio();
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.05);
}

export function startRingtone(kind: 'incoming' | 'outgoing') {
  stopRingtone();
  const play = () => {
    try {
      if (kind === 'incoming') {
        note(659, 0, 0.35);
        note(880, 0.18, 0.45);
        note(1047, 0.36, 0.6, 0.1);
        navigator.vibrate?.([400, 200, 400]);
      } else {
        note(440, 0, 0.9, 0.05);
        note(480, 0, 0.9, 0.05);
      }
    } catch {
      /* autoplay blocked until first user gesture */
    }
  };
  play();
  timer = setInterval(play, kind === 'incoming' ? 2200 : 3000);
}

export function stopRingtone() {
  if (timer) clearInterval(timer);
  timer = null;
  try {
    navigator.vibrate?.(0);
  } catch {
    /* ignore */
  }
}
