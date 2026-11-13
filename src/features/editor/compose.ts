import { filterById, paintTint } from '@/lib/snaps/filters';

export interface OverlayItem {
  id: string;
  type: 'text' | 'sticker';
  content: string;
  x: number; // 0..1 centre
  y: number;
  size: number; // font size as a fraction of stage width
  color: string;
  style: 'plain' | 'pill' | 'glow';
}

export interface Stroke {
  color: string;
  width: number; // fraction of stage width
  points: { x: number; y: number }[]; // fractions
}

export const TEXT_FONT = '"Plus Jakarta Sans Variable", system-ui, sans-serif';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], w: number, h: number) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (s.points.length < 1) continue;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width * w;
    ctx.beginPath();
    ctx.moveTo(s.points[0].x * w, s.points[0].y * h);
    for (const p of s.points.slice(1)) ctx.lineTo(p.x * w, p.y * h);
    if (s.points.length === 1) ctx.lineTo(s.points[0].x * w + 0.1, s.points[0].y * h);
    ctx.stroke();
  }
}

function drawItems(ctx: CanvasRenderingContext2D, items: OverlayItem[], w: number, h: number) {
  for (const it of items) {
    const px = it.size * w;
    const cx = it.x * w;
    const cy = it.y * h;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (it.type === 'sticker') {
      ctx.font = `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(it.content, cx, cy);
    } else {
      ctx.font = `700 ${px}px ${TEXT_FONT}`;
      const lines = it.content.split('\n');
      const lh = px * 1.2;
      const widths = lines.map((l) => ctx.measureText(l).width);
      const boxW = Math.max(...widths) + px * 0.9;
      const boxH = lh * lines.length + px * 0.5;
      if (it.style === 'pill') {
        ctx.fillStyle = it.color === '#ffffff' ? 'rgba(7,8,20,.72)' : it.color;
        const r = Math.min(boxH / 2, px * 0.8);
        ctx.beginPath();
        ctx.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, r);
        ctx.fill();
      }
      if (it.style === 'glow') {
        ctx.shadowColor = it.color;
        ctx.shadowBlur = px * 0.6;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,.45)';
        ctx.shadowBlur = px * 0.15;
      }
      ctx.fillStyle = it.style === 'pill' ? (it.color === '#ffffff' ? '#ffffff' : '#0b0b14') : it.color;
      lines.forEach((l, i) => ctx.fillText(l, cx, cy - ((lines.length - 1) * lh) / 2 + i * lh));
    }
    ctx.restore();
  }
}

/** Bake filter + tint + drawing + text/stickers into a final photo. */
export async function exportImage(src: string, filterId: string, strokes: Stroke[], items: OverlayItem[], maxSide = 2048): Promise<Blob> {
  const img = await loadImage(src);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const f = filterById(filterId);
  if (f.css !== 'none') ctx.filter = f.css;
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = 'none';
  paintTint(ctx, f, w, h);
  drawStrokes(ctx, strokes, w, h);
  drawItems(ctx, items, w, h);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export failed'))), 'image/webp', 0.9));
}

/** Transparent PNG with drawing + text/stickers, laid over a video at playback. */
export async function exportOverlay(strokes: Stroke[], items: OverlayItem[], w: number, h: number): Promise<Blob | null> {
  if (!strokes.length && !items.length) return null;
  const scale = Math.min(1, 1280 / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  drawStrokes(ctx, strokes, cw, ch);
  drawItems(ctx, items, cw, ch);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** Rotate (multiples of 90°) and centre-crop to an aspect ratio. */
export async function cropRotate(src: string, rotation: number, aspect: number | null): Promise<Blob> {
  const img = await loadImage(src);
  const rot = ((rotation % 360) + 360) % 360;
  const sw = rot % 180 === 0 ? img.naturalWidth : img.naturalHeight;
  const sh = rot % 180 === 0 ? img.naturalHeight : img.naturalWidth;
  const rc = document.createElement('canvas');
  rc.width = sw;
  rc.height = sh;
  const rctx = rc.getContext('2d')!;
  rctx.translate(sw / 2, sh / 2);
  rctx.rotate((rot * Math.PI) / 180);
  rctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  let cw = sw;
  let ch = sh;
  if (aspect) {
    if (sw / sh > aspect) cw = Math.round(sh * aspect);
    else ch = Math.round(sw / aspect);
  }
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d')!.drawImage(rc, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, cw, ch);
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('Crop failed'))), 'image/webp', 0.92));
}
