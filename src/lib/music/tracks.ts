/**
 * SUMANOVA's own music for snaps and stories: short loops composed here and synthesised on the
 * phone with the Web Audio API (no audio files, no licences, ₹0). Each track is a chord
 * progression + bass line + drum pattern + melody, rendered offline into an AudioBuffer.
 */
export interface Track {
  id: string;
  name: string;
  mood: string;
  bpm: number;
  /** Chords as semitone offsets from the root (one chord per bar). */
  chords: number[][];
  root: number; // MIDI note of the key
  drums: 'pop' | 'trap' | 'lofi' | 'house' | 'none';
  lead: 'bell' | 'pluck' | 'square' | 'soft';
  /** Melody as scale steps per 8th note, null = rest; loops over the bars. */
  melody: (number | null)[];
}

const MAJ = [0, 4, 7], MIN = [0, 3, 7];
const ch = (r: number, q: number[]) => q.map((n) => n + r);

export const TRACKS: Track[] = [
  { id: 'sunny', name: 'Sunny Side', mood: 'Happy', bpm: 112, root: 60, drums: 'pop', lead: 'bell', chords: [ch(0, MAJ), ch(7, MAJ), ch(9, MIN), ch(5, MAJ)], melody: [4, null, 5, 4, 2, null, 0, null, 4, 5, 7, null, 5, 4, 2, null] },
  { id: 'midnight', name: 'Midnight Drive', mood: 'Chill', bpm: 88, root: 57, drums: 'lofi', lead: 'soft', chords: [ch(0, MIN), ch(8, MAJ), ch(3, MAJ), ch(10, MAJ)], melody: [7, null, null, 5, 3, null, 2, null, 0, null, 2, 3, null, null, 5, null] },
  { id: 'hype', name: 'Hype Mode', mood: 'Energy', bpm: 140, root: 55, drums: 'trap', lead: 'square', chords: [ch(0, MIN), ch(0, MIN), ch(8, MAJ), ch(10, MAJ)], melody: [0, 0, 3, null, 5, null, 3, 0, 7, null, 5, 3, null, 0, null, null] },
  { id: 'glow', name: 'Glow Up', mood: 'Dance', bpm: 124, root: 62, drums: 'house', lead: 'pluck', chords: [ch(0, MIN), ch(5, MIN), ch(10, MAJ), ch(3, MAJ)], melody: [0, 3, 7, 3, 0, 3, 7, 10, 7, 3, 0, null, 3, null, 5, null] },
  { id: 'daydream', name: 'Daydream', mood: 'Dreamy', bpm: 76, root: 64, drums: 'none', lead: 'bell', chords: [ch(0, MAJ), ch(9, MIN), ch(4, MIN), ch(5, MAJ)], melody: [7, null, 9, null, 7, 4, null, null, 2, null, 4, null, 0, null, null, null] },
  { id: 'cheeky', name: 'Cheeky', mood: 'Funny', bpm: 128, root: 60, drums: 'pop', lead: 'square', chords: [ch(0, MAJ), ch(5, MAJ), ch(7, MAJ), ch(5, MAJ)], melody: [0, null, 4, null, 7, 4, 0, null, 2, null, 5, null, 9, 7, 5, 2] },
  { id: 'rain', name: 'Rainy Window', mood: 'Sad', bpm: 70, root: 57, drums: 'lofi', lead: 'soft', chords: [ch(0, MIN), ch(5, MIN), ch(8, MAJ), ch(7, MAJ)], melody: [3, null, 2, null, 0, null, null, null, 3, 5, 3, 2, 0, null, null, null] },
  { id: 'party', name: 'Party Starter', mood: 'Party', bpm: 120, root: 59, drums: 'house', lead: 'pluck', chords: [ch(0, MAJ), ch(9, MIN), ch(5, MAJ), ch(7, MAJ)], melody: [4, 4, 7, 4, 9, 7, 4, 2, 4, 4, 7, 9, 11, 9, 7, 4] },
];
export const trackById = (id: string | null | undefined) => TRACKS.find((t) => t.id === id) ?? null;

const SCALE_MAJ = [0, 2, 4, 5, 7, 9, 11];
const SCALE_MIN = [0, 2, 3, 5, 7, 8, 10];
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function noiseBuffer(ctx: BaseAudioContext) {
  const b = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const d = b.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 16807) % 2147483647;
    d[i] = (seed / 2147483647) * 2 - 1;
  }
  return b;
}

function env(g: GainNode, t: number, a: number, peak: number, d: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(ctx: BaseAudioContext, out: AudioNode, type: OscillatorType, f: number, t: number, dur: number, vol: number, cutoff = 6000) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.value = cutoff;
  const g = ctx.createGain();
  env(g, t, 0.008, vol, dur);
  o.connect(flt).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Renders `seconds` of a track (loops the 4-bar phrase). */
export async function renderTrack(track: Track, seconds = 16, sampleRate = 44100): Promise<AudioBuffer> {
  const OAC = (window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext);
  const ctx = new OAC(2, Math.ceil(seconds * sampleRate), sampleRate);
  const master = ctx.createGain();
  master.gain.value = 0.8;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  const noise = noiseBuffer(ctx);
  const beat = 60 / track.bpm;
  const bar = beat * 4;
  const minor = track.chords[0][1] - track.chords[0][0] === 3;
  const scale = minor ? SCALE_MIN : SCALE_MAJ;
  const bars = Math.ceil(seconds / bar);

  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    const chord = track.chords[b % track.chords.length];
    // Pad chord
    for (const n of chord) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(track.root + n);
        o.detune.value = det;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = track.lead === 'soft' ? 900 : 1500;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.035, t0 + 0.25);
        g.gain.setValueAtTime(0.035, t0 + bar - 0.2);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + bar);
        o.connect(f).connect(g).connect(master);
        o.start(t0);
        o.stop(t0 + bar + 0.05);
      }
    }
    // Bass on beats 1 and 3 (+ offbeat for house/trap)
    const bassNote = hz(track.root + chord[0] - 24);
    for (const k of track.drums === 'house' ? [0.5, 1.5, 2.5, 3.5] : [0, 2, 2.75]) tone(ctx, master, 'triangle', bassNote, t0 + k * beat, beat * 0.8, 0.3, 700);
    // Drums
    for (let s = 0; s < 16; s++) {
      const t = t0 + (s * beat) / 4;
      const kick = track.drums === 'house' ? s % 4 === 0 : track.drums === 'trap' ? [0, 7, 10].includes(s) : track.drums === 'none' ? false : [0, 8, 10].includes(s);
      const snare = track.drums !== 'none' && (s === 4 || s === 12);
      const hat = track.drums === 'trap' ? true : track.drums === 'none' ? false : s % 2 === 0;
      if (kick) {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(140, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        const g = ctx.createGain();
        env(g, t, 0.003, 0.9, 0.22);
        o.connect(g).connect(master);
        o.start(t);
        o.stop(t + 0.3);
      }
      for (const [on, type, freq, vol, dur] of [[snare, 'bandpass', 1800, 0.35, 0.14], [hat, 'highpass', 8000, track.drums === 'lofi' ? 0.05 : 0.09, 0.04]] as const) {
        if (!on) continue;
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        const g = ctx.createGain();
        env(g, t, 0.002, vol, dur);
        src.connect(f).connect(g).connect(master);
        src.start(t);
        src.stop(t + dur + 0.05);
      }
    }
    // Melody (8th notes)
    for (let s = 0; s < 8; s++) {
      const step = track.melody[(b * 8 + s) % track.melody.length];
      if (step === null) continue;
      const oct = Math.floor(step / 7);
      const note = track.root + 12 + scale[((step % 7) + 7) % 7] + oct * 12;
      const t = t0 + (s * beat) / 2;
      const type: OscillatorType = track.lead === 'square' ? 'square' : track.lead === 'pluck' ? 'sawtooth' : 'sine';
      tone(ctx, master, type, hz(note), t, track.lead === 'pluck' ? beat * 0.3 : beat * 0.45, track.lead === 'square' ? 0.07 : 0.16, track.lead === 'bell' ? 5000 : 2600);
      if (track.lead === 'bell') tone(ctx, master, 'sine', hz(note + 12), t, beat * 0.3, 0.05);
    }
  }
  return ctx.startRendering();
}

const cache = new Map<string, Promise<AudioBuffer>>();
export const trackBuffer = (id: string, seconds = 16) => {
  const key = `${id}:${seconds}`;
  if (!cache.has(key)) {
    const t = trackById(id);
    if (!t) return Promise.reject(new Error('Unknown track'));
    cache.set(key, renderTrack(t, seconds));
  }
  return cache.get(key)!;
};

/** Plays a track on loop (for previews and viewers). Returns stop(). */
export async function playTrack(id: string, volume = 0.8): Promise<() => void> {
  const buf = await trackBuffer(id);
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(g).connect(ctx.destination);
  src.start();
  return () => {
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
    void ctx.close();
  };
}
