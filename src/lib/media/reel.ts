import { trackBuffer } from '@/lib/music/tracks';
import { novaEmojiImage, loadNovaEmoji, type NovaEmojiId } from '@/components/emoji/novaEmoji';

/**
 * Reels made on the phone (₹0): photos → a vertical video with gentle zoom, crossfades, a
 * title card and original music. Used for birthday reels and shared-album recaps.
 */
export interface ReelOptions {
  title: string;
  subtitle?: string;
  music?: string | null;
  emoji?: NovaEmojiId;
  perPhoto?: number; // seconds
  accent?: string;
}

const W = 720, H = 1280;

function pickMime() {
  const opts = ['video/mp4;codecs=avc1,mp4a', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return opts.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? '';
}

function cover(g: CanvasRenderingContext2D, img: ImageBitmap, zoom: number, alpha: number, dx: number) {
  const s = Math.max(W / img.width, H / img.height) * zoom;
  const w = img.width * s, h = img.height * s;
  g.globalAlpha = alpha;
  g.drawImage(img, (W - w) / 2 + dx, (H - h) / 2, w, h);
  g.globalAlpha = 1;
}

export async function makeReel(photos: Blob[], o: ReelOptions, onProgress?: (p: number) => void): Promise<Blob> {
  if (!photos.length) throw new Error('Pick at least one photo');
  const imgs = await Promise.all(photos.slice(0, 20).map((b) => createImageBitmap(b)));
  if (o.emoji) await loadNovaEmoji(o.emoji);
  const per = o.perPhoto ?? 1.8;
  const titleSec = 1.8;
  const total = titleSec + imgs.length * per + 0.6;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new AC();
  const dest = ac.createMediaStreamDestination();
  if (o.music) {
    const buf = await trackBuffer(o.music, Math.ceil(total) + 1);
    const src = ac.createBufferSource();
    const copy = ac.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) copy.copyToChannel(buf.getChannelData(c), c);
    src.buffer = copy;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.9, ac.currentTime);
    gain.gain.linearRampToValueAtTime(0, ac.currentTime + total);
    src.connect(gain).connect(dest);
    src.start();
  }
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = pickMime();
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 3_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start(250);
  const accent = o.accent ?? '#FF4F9A';
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const frame = () => {
      const t = (performance.now() - start) / 1000;
      onProgress?.(Math.min(1, t / total));
      g.fillStyle = '#111';
      g.fillRect(0, 0, W, H);
      if (t < titleSec) {
        // Title card
        g.fillStyle = accent;
        g.fillRect(0, 0, W, H);
        const em = o.emoji ? novaEmojiImage(o.emoji) : null;
        const bounce = 1 + Math.sin(t * 6) * 0.04;
        if (em) g.drawImage(em, W / 2 - 150 * bounce, H * 0.27 - 150 * bounce, 300 * bounce, 300 * bounce);
        g.fillStyle = '#fff';
        g.textAlign = 'center';
        g.font = '900 72px "Inter Variable", system-ui, sans-serif';
        wrap(g, o.title, W / 2, H * 0.6, W - 100, 82);
        if (o.subtitle) {
          g.font = '700 34px "Inter Variable", system-ui, sans-serif';
          g.globalAlpha = 0.85;
          g.fillText(o.subtitle, W / 2, H * 0.82);
          g.globalAlpha = 1;
        }
      } else {
        const k = (t - titleSec) / per;
        const i = Math.min(imgs.length - 1, Math.floor(k));
        const f = k - Math.floor(k);
        cover(g, imgs[i], 1.04 + f * 0.08, 1, (i % 2 ? -1 : 1) * f * 20);
        // crossfade into the next photo over the last 25%
        if (f > 0.75 && i + 1 < imgs.length) cover(g, imgs[i + 1], 1.04, (f - 0.75) / 0.25, 0);
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.fillRect(0, H - 150, W, 150);
        g.fillStyle = '#fff';
        g.textAlign = 'left';
        g.font = '900 40px "Inter Variable", system-ui, sans-serif';
        g.fillText(o.title, 40, H - 62);
      }
      if (t >= total) return resolve();
      requestAnimationFrame(frame);
    };
    frame();
  });
  rec.stop();
  await done;
  void ac.close();
  imgs.forEach((b) => b.close());
  return new Blob(chunks, { type: (rec.mimeType || 'video/webm').split(';')[0] });
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  lines.forEach((l, i) => g.fillText(l, x, y + (i - (lines.length - 1) / 2) * lh));
}
