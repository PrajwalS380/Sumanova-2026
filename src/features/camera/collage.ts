/** Collage layouts (fractions of a 1080×1920 portrait canvas) and the dual-camera picture-in-picture. */
export interface CollageLayout { id: string; label: string; cells: [number, number, number, number][] }

export const COLLAGES: CollageLayout[] = [
  { id: 'two', label: '2 stacked', cells: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
  { id: 'side', label: '2 side by side', cells: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
  { id: 'three', label: '3 strip', cells: [[0, 0, 1, 1 / 3], [0, 1 / 3, 1, 1 / 3], [0, 2 / 3, 1, 1 / 3]] },
  { id: 'four', label: '2 × 2', cells: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  { id: 'hero', label: '1 + 2', cells: [[0, 0, 1, 0.6], [0, 0.6, 0.5, 0.4], [0.5, 0.6, 0.5, 0.4]] },
];

const W = 1080, H = 1920, GAP = 10;

function cover(x: CanvasRenderingContext2D, img: ImageBitmap, dx: number, dy: number, dw: number, dh: number) {
  const s = Math.max(dw / img.width, dh / img.height);
  const sw = dw / s, sh = dh / s;
  x.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, dx, dy, dw, dh);
}

export async function composeCollage(shots: Blob[], layout: CollageLayout, bg = '#111111'): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < layout.cells.length && i < shots.length; i++) {
    const [fx, fy, fw, fh] = layout.cells[i];
    const img = await createImageBitmap(shots[i]);
    const dx = fx * W + GAP, dy = fy * H + GAP, dw = fw * W - GAP * 2, dh = fh * H - GAP * 2;
    x.save();
    x.beginPath();
    x.roundRect(dx, dy, dw, dh, 28);
    x.clip();
    cover(x, img, dx, dy, dw, dh);
    x.restore();
    img.close();
  }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Couldn’t make the collage'))), 'image/jpeg', 0.9));
}

/** Dual camera: the back-camera photo full screen with the selfie in a rounded corner window. */
export async function composeDual(back: Blob, front: Blob): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  const b = await createImageBitmap(back);
  cover(x, b, 0, 0, W, H);
  b.close();
  const f = await createImageBitmap(front);
  const pw = W * 0.34, ph = pw * 1.33, px = W * 0.05, py = H * 0.06;
  x.save();
  x.shadowColor = 'rgba(0,0,0,.45)';
  x.shadowBlur = 30;
  x.fillStyle = '#fff';
  x.beginPath();
  x.roundRect(px - 8, py - 8, pw + 16, ph + 16, 40);
  x.fill();
  x.restore();
  x.save();
  x.beginPath();
  x.roundRect(px, py, pw, ph, 34);
  x.clip();
  cover(x, f, px, py, pw, ph);
  x.restore();
  f.close();
  return new Promise((res, rej) => c.toBlob((bl) => (bl ? res(bl) : rej(new Error('Couldn’t make the picture'))), 'image/jpeg', 0.9));
}
