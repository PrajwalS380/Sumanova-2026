import { trackBuffer } from '@/lib/music/tracks';

/**
 * Video effects baked on the phone before sending (₹0, no server): speed, reverse, voice
 * changer and music. The clip is replayed into a canvas + Web Audio graph and re-recorded
 * with MediaRecorder, so it takes about as long as the clip itself.
 */
export type Voice = 'none' | 'chipmunk' | 'deep' | 'robot' | 'echo' | 'radio';
export interface VideoFx {
  speed: number; // 0.5 | 1 | 2
  reverse: boolean;
  voice: Voice;
  music: string | null;
  musicVolume?: number;
  keepOriginalAudio?: boolean;
}
export const NO_FX: VideoFx = { speed: 1, reverse: false, voice: 'none', music: null };
export const hasFx = (f: VideoFx) => f.speed !== 1 || f.reverse || f.voice !== 'none' || !!f.music;
export const VOICES: { id: Voice; label: string }[] = [
  { id: 'none', label: 'Normal' },
  { id: 'chipmunk', label: 'Chipmunk' },
  { id: 'deep', label: 'Deep' },
  { id: 'robot', label: 'Robot' },
  { id: 'echo', label: 'Echo' },
  { id: 'radio', label: 'Radio' },
];

const MAX_REVERSE_SECONDS = 15;
const REVERSE_FPS = 15;

function pickMime() {
  const opts = ['video/mp4;codecs=avc1,mp4a', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return opts.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? '';
}

/** Pitch shifter (two crossfaded, sawtooth-modulated delay lines). semis: +7 chipmunk, -6 deep. */
function pitchShift(ctx: AudioContext, input: AudioNode, semis: number): AudioNode {
  const bufferTime = 0.1, fadeTime = 0.05;
  const len = Math.round(ctx.sampleRate * bufferTime);
  const ramp = (down: boolean) => {
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = down ? (len - i) / len : i / len;
    return b;
  };
  const fade = ctx.createBuffer(1, len, ctx.sampleRate);
  const fd = fade.getChannelData(0);
  const fl = Math.round(fadeTime * ctx.sampleRate), half = len - fl;
  for (let i = 0; i < len; i++) fd[i] = i < half ? 1 : Math.cos(((i - half) / fl) * Math.PI * 0.5) ** 2;
  const up = semis > 0;
  const rate = Math.abs(2 ** (semis / 12) - 1);
  const out = ctx.createGain();
  for (let k = 0; k < 2; k++) {
    const t0 = ctx.currentTime + 0.05 + (k * (bufferTime - fadeTime));
    const mod = ctx.createBufferSource();
    mod.buffer = ramp(up);
    mod.loop = true;
    const modGain = ctx.createGain();
    modGain.gain.value = bufferTime * rate;
    const delay = ctx.createDelay(1);
    const fader = ctx.createBufferSource();
    fader.buffer = fade;
    fader.loop = true;
    const mix = ctx.createGain();
    mix.gain.value = 0;
    mod.connect(modGain).connect(delay.delayTime);
    fader.connect(mix.gain);
    input.connect(delay).connect(mix).connect(out);
    mod.start(t0);
    fader.start(t0);
  }
  return out;
}

function voiceChain(ctx: AudioContext, src: AudioNode, voice: Voice): AudioNode {
  switch (voice) {
    case 'chipmunk':
      return pitchShift(ctx, src, 7);
    case 'deep':
      return pitchShift(ctx, src, -6);
    case 'robot': {
      const ring = ctx.createGain();
      ring.gain.value = 0;
      const osc = ctx.createOscillator();
      osc.frequency.value = 55;
      osc.connect(ring.gain);
      osc.start();
      src.connect(ring);
      const boost = ctx.createGain();
      boost.gain.value = 1.6;
      return ring.connect(boost);
    }
    case 'echo': {
      const out = ctx.createGain();
      const d = ctx.createDelay(1);
      d.delayTime.value = 0.22;
      const fb = ctx.createGain();
      fb.gain.value = 0.42;
      src.connect(out);
      src.connect(d).connect(fb).connect(d);
      d.connect(out);
      return out;
    }
    case 'radio': {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1700;
      bp.Q.value = 1.2;
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 255) * 2 - 1;
        curve[i] = Math.tanh(x * 3);
      }
      shaper.curve = curve;
      return src.connect(bp).connect(shaper);
    }
    default:
      return src;
  }
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error('Couldn’t read the video'));
  });
}

/** Recorded webm files often report Infinity until you seek past the end. */
async function realDuration(v: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(v.duration) && v.duration > 0) return v.duration;
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, 3000);
    v.ontimeupdate = () => {
      if (!Number.isFinite(v.duration)) return;
      v.ontimeupdate = null;
      clearTimeout(t);
      resolve();
    };
    v.currentTime = 1e7;
  });
  const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 10;
  await seek(v, 0);
  return d;
}

async function decodeAudio(ctx: AudioContext, blob: Blob): Promise<AudioBuffer | null> {
  try {
    return await ctx.decodeAudioData(await blob.arrayBuffer());
  } catch {
    return null; // no audio track / unsupported container
  }
}

function seek(v: HTMLVideoElement, t: number) {
  return new Promise<void>((resolve) => {
    const done = () => {
      v.removeEventListener('seeked', done);
      resolve();
    };
    v.addEventListener('seeked', done);
    v.currentTime = t;
  });
}

export async function processVideo(blob: Blob, fx: VideoFx, onProgress?: (p: number) => void): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  const v = await loadVideo(url);
  const w = v.videoWidth || 720, h = v.videoHeight || 1280;
  const duration = await realDuration(v);
  if (fx.reverse && duration > MAX_REVERSE_SECONDS + 0.5) throw new Error(`Reverse works on clips up to ${MAX_REVERSE_SECONDS} seconds`);
  const scale = Math.min(1, 1280 / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const g = canvas.getContext('2d')!;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const actx = new AC();
  const dest = actx.createMediaStreamDestination();
  const outLen = duration / fx.speed;

  // Music bed
  if (fx.music) {
    const mb = await trackBuffer(fx.music, Math.ceil(outLen) + 1);
    const ms = actx.createBufferSource();
    ms.buffer = await copyToContext(actx, mb);
    const mg = actx.createGain();
    mg.gain.value = fx.musicVolume ?? (fx.keepOriginalAudio === false ? 0.9 : 0.45);
    ms.connect(mg).connect(dest);
    ms.start(actx.currentTime + 0.05);
  }

  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = pickMime();
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 96_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));

  try {
    if (fx.reverse) {
      // 1) Grab frames (scaled, JPEG) by seeking; 2) play them backwards with reversed audio.
      const frames: Blob[] = [];
      const n = Math.max(1, Math.floor(duration * REVERSE_FPS));
      for (let i = 0; i < n; i++) {
        await seek(v, Math.min(duration - 0.001, i / REVERSE_FPS));
        g.drawImage(v, 0, 0, canvas.width, canvas.height);
        frames.push(await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), 'image/jpeg', 0.85)));
        onProgress?.((i / n) * 0.5);
      }
      const audio = fx.keepOriginalAudio === false ? null : await decodeAudio(actx, blob);
      if (audio) {
        for (let c = 0; c < audio.numberOfChannels; c++) audio.getChannelData(c).reverse();
        const as = actx.createBufferSource();
        as.buffer = audio;
        as.playbackRate.value = fx.speed;
        voiceChain(actx, as, fx.voice).connect(dest);
        as.start(actx.currentTime + 0.05);
      }
      rec.start(250);
      const frameMs = 1000 / REVERSE_FPS / fx.speed;
      const start = performance.now();
      for (let i = frames.length - 1; i >= 0; i--) {
        const bmp = await createImageBitmap(frames[i]);
        g.drawImage(bmp, 0, 0);
        bmp.close();
        const k = frames.length - 1 - i;
        onProgress?.(0.5 + (k / frames.length) * 0.5);
        const wait = start + (k + 1) * frameMs - performance.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
    } else {
      // Live replay at the chosen speed through the voice effect.
      v.muted = false;
      v.playbackRate = fx.speed;
      (v as HTMLVideoElement & { preservesPitch?: boolean }).preservesPitch = true;
      if (fx.keepOriginalAudio !== false) {
        const src = actx.createMediaElementSource(v);
        voiceChain(actx, src, fx.voice).connect(dest);
      } else v.muted = true;
      rec.start(250);
      await v.play();
      await new Promise<void>((resolve) => {
        const draw = () => {
          g.drawImage(v, 0, 0, canvas.width, canvas.height);
          onProgress?.(Math.min(1, v.currentTime / duration));
          if (v.ended || v.currentTime >= duration - 0.02) return resolve();
          requestAnimationFrame(draw);
        };
        draw();
        v.onended = () => resolve();
      });
    }
  } finally {
    if (rec.state !== 'inactive') rec.stop();
    await stopped;
    v.pause();
    URL.revokeObjectURL(url);
    void actx.close();
  }
  onProgress?.(1);
  return new Blob(chunks, { type: (rec.mimeType || 'video/webm').split(';')[0] });
}

async function copyToContext(ctx: AudioContext, b: AudioBuffer): Promise<AudioBuffer> {
  const out = ctx.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
  for (let c = 0; c < b.numberOfChannels; c++) out.copyToChannel(b.getChannelData(c), c);
  return out;
}
