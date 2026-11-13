import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/image';
import type { MediaMeta, MessageKind } from './types';

export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_VOICE_SECONDS = 120;
const BUCKET = 'chat-media';

const EXT: Record<string, string> = {
  'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
  'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/aac': 'aac',
};

/** Prepare a picked/recorded file for upload: compress images, enforce size limits. */
export async function prepareMedia(file: Blob): Promise<{ blob: Blob; kind: MessageKind; meta: MediaMeta }> {
  const type = file.type || 'application/octet-stream';
  if (type.startsWith('image/') && type !== 'image/gif') {
    const blob = await compressImage(file, 1600, 'image/webp', 0.82);
    const dims = await imageSize(blob);
    return { blob, kind: 'image', meta: { ...dims, mime: 'image/webp', size: blob.size } };
  }
  if (type === 'image/gif') return { blob: file, kind: 'image', meta: { mime: type, size: file.size } };
  if (type.startsWith('video/')) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error('Videos must be under 25 MB');
    const v = await videoInfo(file);
    return { blob: file, kind: 'video', meta: { ...v, mime: type, size: file.size } };
  }
  throw new Error('That file type isn’t supported');
}

function imageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return createImageBitmap(blob).then((b) => {
    const r = { width: b.width, height: b.height };
    b.close();
    return r;
  });
}

function videoInfo(file: Blob): Promise<{ width?: number; height?: number; duration?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      resolve({ width: v.videoWidth, height: v.videoHeight, duration: v.duration });
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      resolve({});
      URL.revokeObjectURL(url);
    };
    v.src = url;
  });
}

export async function uploadMedia(conversationId: string, userId: string, clientId: string, blob: Blob): Promise<string> {
  const mime = (blob.type || 'application/octet-stream').split(';')[0];
  const path = `${conversationId}/${userId}/${clientId}.${EXT[mime] ?? 'bin'}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: mime, upsert: true, cacheControl: '3600' });
  if (error) throw new Error(error.message);
  return path;
}

export async function removeMedia(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}

// ---- Signed URL cache: private media is only reachable through short-lived links ----
const cache = new Map<string, { url: string; exp: number }>();
const inflight = new Map<string, Promise<string>>();
const TTL = 60 * 60; // 1 hour

export function signedUrl(path: string): Promise<string> {
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now() + 60_000) return Promise.resolve(hit.url);
  const pending = inflight.get(path);
  if (pending) return pending;
  const p = supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, TTL)
    .then(({ data, error }) => {
      inflight.delete(path);
      if (error || !data) throw new Error(error?.message ?? 'Media unavailable');
      cache.set(path, { url: data.signedUrl, exp: Date.now() + TTL * 1000 });
      // Keep memory bounded.
      if (cache.size > 300) cache.delete(cache.keys().next().value as string);
      return data.signedUrl;
    });
  inflight.set(path, p);
  return p;
}

// ---- Voice notes ----
export function pickVoiceMime(): string {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
  return options.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(t)) ?? '';
}

export interface VoiceRecording {
  stop: () => Promise<{ blob: Blob; duration: number; waveform: number[] } | null>;
  cancel: () => void;
  level: () => number;
}

/** Records microphone audio and samples a coarse waveform for the bubble. */
export async function startVoiceRecording(): Promise<VoiceRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mime = pickVoiceMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
  const chunks: Blob[] = [];
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Uint8Array(analyser.frequencyBinCount);
  const samples: number[] = [];
  let lastLevel = 0;
  const sampler = setInterval(() => {
    analyser.getByteTimeDomainData(buf);
    let peak = 0;
    for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
    lastLevel = peak / 128;
    samples.push(lastLevel);
  }, 100);
  const started = performance.now();
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start(250);

  const cleanup = () => {
    clearInterval(sampler);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };

  return {
    level: () => lastLevel,
    cancel: () => {
      rec.onstop = null;
      if (rec.state !== 'inactive') rec.stop();
      cleanup();
    },
    stop: () =>
      new Promise((resolve) => {
        const duration = (performance.now() - started) / 1000;
        rec.onstop = () => {
          cleanup();
          if (duration < 0.6) return resolve(null);
          const blob = new Blob(chunks, { type: (rec.mimeType || mime || 'audio/webm').split(';')[0] });
          resolve({ blob, duration, waveform: downsample(samples, 32) });
        };
        rec.stop();
      }),
  };
}

export function downsample(values: number[], n: number): number[] {
  if (!values.length) return Array(n).fill(0.1);
  const out: number[] = [];
  const step = values.length / n;
  for (let i = 0; i < n; i++) {
    const slice = values.slice(Math.floor(i * step), Math.max(Math.floor((i + 1) * step), Math.floor(i * step) + 1));
    out.push(Math.round(Math.min(1, Math.max(0.08, Math.max(...slice) * 1.6)) * 100) / 100);
  }
  return out;
}
