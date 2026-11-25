import { loadSegmenter, MaskTracker } from '@/features/camera/segment';

/**
 * Cut-out stickers: lift the person out of any photo on the phone (MediaPipe selfie
 * segmenter, ₹0), trim it, add a white sticker edge, and keep it in a small on-device library.
 * Stored in snaps as sticker items whose content is "img:<data URL>".
 */
export const CUTOUT_PREFIX = 'img:';
const KEY = 'snv-cutouts';
const MAX_SIDE = 420;

export async function makeCutout(file: Blob): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 720 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const src = document.createElement('canvas');
  src.width = w;
  src.height = h;
  src.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const mask = new MaskTracker(await loadSegmenter('selfie'), 'selfie').update(src, performance.now());
  if (!mask) throw new Error('Couldn’t find a person in that photo');

  const cut = document.createElement('canvas');
  cut.width = w;
  cut.height = h;
  const g = cut.getContext('2d')!;
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  g.imageSmoothingQuality = 'high';
  g.drawImage(mask, 0, 0, w, h);
  g.globalCompositeOperation = 'source-over';

  // Trim to the visible part.
  const data = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 40) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0 || (x1 - x0) * (y1 - y0) < w * h * 0.02) throw new Error('Couldn’t find a person in that photo');

  // White sticker edge: stamp the silhouette around itself, then the cut-out on top.
  const pad = 10;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const k = Math.min(1, (MAX_SIDE - pad * 2) / Math.max(cw, ch));
  const out = document.createElement('canvas');
  out.width = Math.round(cw * k) + pad * 2;
  out.height = Math.round(ch * k) + pad * 2;
  const o = out.getContext('2d')!;
  const sil = document.createElement('canvas');
  sil.width = out.width;
  sil.height = out.height;
  const s = sil.getContext('2d')!;
  s.drawImage(cut, x0, y0, cw, ch, pad, pad, cw * k, ch * k);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#fff';
  s.fillRect(0, 0, sil.width, sil.height);
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    o.drawImage(sil, Math.cos(ang) * 5, Math.sin(ang) * 5);
  }
  o.drawImage(cut, x0, y0, cw, ch, pad, pad, cw * k, ch * k);
  return out.toDataURL('image/webp', 0.85);
}

export const cutoutLibrary = {
  list(): string[] {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]') as string[];
    } catch {
      return [];
    }
  },
  add(dataUrl: string) {
    const next = [dataUrl, ...this.list().filter((x) => x !== dataUrl)].slice(0, 12);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage full — keep only the newest */
      try {
        localStorage.setItem(KEY, JSON.stringify(next.slice(0, 3)));
      } catch {
        /* storage blocked */
      }
    }
    return next;
  },
};
