import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { NovaEmojiId } from '@/components/emoji/novaEmoji';

/**
 * "Frame" lenses repaint the whole picture (not just stickers on top): background blur/replace,
 * hair colour, makeup and face warps. They receive the camera frame, face landmarks and masks.
 * All artwork is drawn here (original, ₹0).
 */
export interface FrameInput {
  ctx: CanvasRenderingContext2D;
  video: CanvasImageSource;
  w: number;
  h: number;
  t: number;
  faces: NormalizedLandmark[][];
  person: HTMLCanvasElement | null;
  hair: HTMLCanvasElement | null;
}
export type LensCategory = 'Fun' | 'Faces' | 'Beauty' | 'Background' | 'Hair' | 'Warp' | 'World';
export interface FrameLens {
  id: string;
  name: string;
  icon: NovaEmojiId;
  category: LensCategory;
  needs: ('face' | 'selfie' | 'hair')[];
  frame: (i: FrameInput) => void;
}

const P = (f: NormalizedLandmark[], i: number, w: number, h: number) => ({ x: f[i].x * w, y: f[i].y * h });
function faceGeo(f: NormalizedLandmark[], w: number, h: number) {
  const top = P(f, 10, w, h), chin = P(f, 152, w, h), lc = P(f, 234, w, h), rc = P(f, 454, w, h);
  return { top, chin, faceW: Math.hypot(rc.x - lc.x, rc.y - lc.y), faceH: Math.hypot(chin.x - top.x, chin.y - top.y), cx: (lc.x + rc.x) / 2, cy: (top.y + chin.y) / 2, angle: Math.atan2(rc.y - lc.y, rc.x - lc.x) };
}
const centre = (f: NormalizedLandmark[], idx: number[], w: number, h: number) => {
  let x = 0, y = 0;
  for (const i of idx) { x += f[i].x; y += f[i].y; }
  return { x: (x / idx.length) * w, y: (y / idx.length) * h };
};

// ---------- reusable scratch canvases ----------
const scratch: Record<string, HTMLCanvasElement> = {};
function canvas(key: string, w: number, h: number) {
  let c = scratch[key];
  if (!c) c = scratch[key] = document.createElement('canvas');
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}

/** The person cut out of the frame using the (small, smoothed) mask. */
function personLayer(video: CanvasImageSource, mask: HTMLCanvasElement, w: number, h: number) {
  const c = canvas('person', w, h);
  const x = c.getContext('2d')!;
  x.globalCompositeOperation = 'copy';
  x.drawImage(video, 0, 0, w, h);
  x.globalCompositeOperation = 'destination-in';
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(mask, 0, 0, w, h);
  x.globalCompositeOperation = 'source-over';
  return c;
}

// ---------- original backdrops (drawn once per size) ----------
type Backdrop = (x: CanvasRenderingContext2D, w: number, h: number, t: number) => void;
const BACKDROPS: Record<string, Backdrop> = {
  beach(x, w, h) {
    const sky = x.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, '#FF8FB1'); sky.addColorStop(0.55, '#FFC48C'); sky.addColorStop(1, '#FFE2A8');
    x.fillStyle = sky; x.fillRect(0, 0, w, h);
    x.fillStyle = '#FFF4D6'; x.beginPath(); x.arc(w * 0.68, h * 0.5, w * 0.13, 0, Math.PI * 2); x.fill();
    const sea = x.createLinearGradient(0, h * 0.58, 0, h * 0.8);
    sea.addColorStop(0, '#3D7BFF'); sea.addColorStop(1, '#2AC3D6');
    x.fillStyle = sea; x.fillRect(0, h * 0.58, w, h * 0.24);
    x.fillStyle = '#F7D9A8'; x.fillRect(0, h * 0.8, w, h * 0.2);
  },
  neon(x, w, h) {
    x.fillStyle = '#120B2E'; x.fillRect(0, 0, w, h);
    const cols = ['#FF4F9A', '#3D7BFF', '#18C48C', '#8C6BFF', '#FFB020'];
    for (let i = 0; i < 9; i++) {
      const bw = w * (0.08 + ((i * 37) % 5) * 0.02), bh = h * (0.25 + ((i * 53) % 7) * 0.06);
      const bx = (i / 9) * w, by = h - bh;
      x.fillStyle = '#1D1446'; x.fillRect(bx, by, bw, bh);
      x.fillStyle = cols[i % cols.length];
      for (let k = 0; k < 6; k++) x.fillRect(bx + bw * 0.2, by + bh * (0.1 + k * 0.13), bw * 0.15, bh * 0.04);
    }
  },
  space(x, w, h) {
    const g = x.createRadialGradient(w * 0.3, h * 0.3, 0, w * 0.5, h * 0.5, Math.max(w, h));
    g.addColorStop(0, '#3A1D6E'); g.addColorStop(1, '#05030F');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      x.fillStyle = `rgba(255,255,255,${0.3 + ((i * 7) % 10) / 14})`;
      x.beginPath(); x.arc(((i * 97) % 1000) / 1000 * w, ((i * 389) % 1000) / 1000 * h, 0.6 + (i % 3) * 0.6, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = '#FF8FC0'; x.beginPath(); x.arc(w * 0.78, h * 0.22, w * 0.09, 0, Math.PI * 2); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = w * 0.01; x.beginPath(); x.ellipse(w * 0.78, h * 0.22, w * 0.15, w * 0.035, -0.3, 0, Math.PI * 2); x.stroke();
  },
  studio(x, w, h) {
    x.fillStyle = '#FF4F9A'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(255,255,255,.95)';
    for (let i = 0; i < 14; i++) {
      const s = w * (0.02 + (i % 3) * 0.015), cx = ((i * 137) % 100) / 100 * w, cy = ((i * 61) % 100) / 100 * h;
      x.beginPath();
      x.moveTo(cx, cy - s); x.quadraticCurveTo(cx, cy, cx + s, cy); x.quadraticCurveTo(cx, cy, cx, cy + s); x.quadraticCurveTo(cx, cy, cx - s, cy); x.quadraticCurveTo(cx, cy, cx, cy - s);
      x.fill();
    }
  },
  mono(x, w, h) {
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#F1F1F4'); g.addColorStop(1, '#C9C9D2');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  },
};
function backdrop(id: string, w: number, h: number) {
  const key = `bg-${id}`;
  const c = scratch[key];
  if (c && c.width === w && c.height === h) return c;
  const nc = canvas(key, w, h);
  BACKDROPS[id](nc.getContext('2d')!, w, h, 0);
  return nc;
}

// ---------- your own photo as the background ----------
let customBg: ImageBitmap | null = null;
/** Set (or clear) the picture behind you for the "My photo" background lens. */
export async function setCustomBackdrop(file: Blob | null) {
  customBg?.close();
  customBg = file ? await createImageBitmap(file) : null;
  delete scratch['bg-custom'];
}
export const hasCustomBackdrop = () => !!customBg;
function customBackdrop(w: number, h: number) {
  const c = scratch['bg-custom'];
  if (c && c.width === w && c.height === h) return c;
  const nc = canvas('bg-custom', w, h);
  const x = nc.getContext('2d')!;
  if (customBg) {
    // cover-fit
    const s = Math.max(w / customBg.width, h / customBg.height);
    const dw = customBg.width * s, dh = customBg.height * s;
    x.drawImage(customBg, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  return nc;
}

function bgLens(id: string, name: string, icon: NovaEmojiId): FrameLens {
  return {
    id: `bg-${id}`, name, icon, category: 'Background', needs: ['selfie'],
    frame({ ctx, video, w, h, person }) {
      if (!person) return void ctx.drawImage(video, 0, 0, w, h);
      ctx.drawImage(backdrop(id, w, h), 0, 0);
      ctx.drawImage(personLayer(video, person, w, h), 0, 0);
    },
  };
}

// ---------- hair colour ----------
function hairLens(id: string, name: string, color: string, icon: NovaEmojiId): FrameLens {
  return {
    id: `hair-${id}`, name, icon, category: 'Hair', needs: ['hair'],
    frame({ ctx, video, w, h, hair }) {
      ctx.drawImage(video, 0, 0, w, h);
      if (!hair) return;
      const c = canvas('hair', w, h);
      const x = c.getContext('2d')!;
      x.globalCompositeOperation = 'copy';
      x.fillStyle = color;
      x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = 'destination-in';
      x.imageSmoothingQuality = 'high';
      x.drawImage(hair, 0, 0, w, h);
      x.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.globalCompositeOperation = 'color';
      ctx.globalAlpha = 0.85;
      ctx.drawImage(c, 0, 0);
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = 0.6;
      ctx.drawImage(c, 0, 0);
      ctx.restore();
    },
  };
}

// ---------- makeup ----------
const LIP_OUT = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
const LIP_IN = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
const LID_L = [33, 246, 161, 160, 159, 158, 157, 173, 133];
const LID_R = [263, 466, 388, 387, 386, 385, 384, 398, 362];
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const EYE_L = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const EYE_R = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
const BROW_L = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
const BROW_R = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];
function path(ctx: CanvasRenderingContext2D, f: NormalizedLandmark[], idx: number[], w: number, h: number, close = true) {
  idx.forEach((i, k) => (k ? ctx.lineTo(f[i].x * w, f[i].y * h) : ctx.moveTo(f[i].x * w, f[i].y * h)));
  if (close) ctx.closePath();
}
function makeupLens(id: string, name: string, icon: NovaEmojiId, o: { lip?: string; blush?: string; liner?: boolean; gloss?: boolean }): FrameLens {
  return {
    id: `mu-${id}`, name, icon, category: 'Beauty', needs: ['face'],
    frame({ ctx, video, w, h, faces }) {
      ctx.drawImage(video, 0, 0, w, h);
      for (const f of faces) {
        const g = faceGeo(f, w, h);
        if (o.blush) {
          for (const i of [50, 280]) {
            const c = P(f, i, w, h), r = g.faceW * 0.14;
            const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
            grad.addColorStop(0, o.blush); grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.35; ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
          }
        }
        if (o.lip) {
          ctx.save();
          ctx.beginPath(); path(ctx, f, LIP_OUT, w, h); path(ctx, f, LIP_IN, w, h);
          ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.55; ctx.fillStyle = o.lip; ctx.fill('evenodd');
          ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.6; ctx.fill('evenodd');
          if (o.gloss) {
            const lc = P(f, 14, w, h);
            ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.45; ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.ellipse(lc.x, lc.y + g.faceW * 0.02, g.faceW * 0.05, g.faceW * 0.012, g.angle, 0, Math.PI * 2); ctx.fill();
          }
          ctx.restore();
        }
        if (o.liner) {
          ctx.save();
          ctx.strokeStyle = 'rgba(17,17,17,.85)'; ctx.lineWidth = g.faceW * 0.012; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          for (const [lid, out] of [[LID_L, 33], [LID_R, 263]] as const) {
            ctx.beginPath(); path(ctx, f, lid, w, h, false);
            const o2 = P(f, out, w, h), dir = out === 33 ? -1 : 1;
            ctx.moveTo(o2.x, o2.y);
            ctx.lineTo(o2.x + dir * Math.cos(g.angle) * g.faceW * 0.07, o2.y - g.faceW * 0.035);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    },
  };
}

// ---------- warps (feathered magnifiers) ----------
function bulge(ctx: CanvasRenderingContext2D, src: CanvasImageSource, cx: number, cy: number, r: number, kx: number, ky = kx) {
  const size = Math.max(4, Math.round(r * 2));
  const c = canvas(`bulge-${size}`, size, size);
  const x = c.getContext('2d')!;
  x.globalCompositeOperation = 'copy';
  const sx = r / kx, sy = r / ky;
  x.drawImage(src, cx - sx, cy - sy, sx * 2, sy * 2, 0, 0, size, size);
  x.globalCompositeOperation = 'destination-in';
  const g = x.createRadialGradient(size / 2, size / 2, size * 0.25, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  x.globalCompositeOperation = 'source-over';
  ctx.drawImage(c, cx - r, cy - r);
}
function warpLens(id: string, name: string, icon: NovaEmojiId, apply: (ctx: CanvasRenderingContext2D, v: CanvasImageSource, f: NormalizedLandmark[], w: number, h: number, t: number) => void): FrameLens {
  return {
    id: `warp-${id}`, name, icon, category: 'Warp', needs: ['face'],
    frame({ ctx, video, w, h, faces, t }) {
      ctx.drawImage(video, 0, 0, w, h);
      for (const f of faces) apply(ctx, video, f, w, h, t);
    },
  };
}

export const FRAME_LENSES: FrameLens[] = [
  {
    id: 'bg-blur', name: 'Blur behind me', icon: 'sparkle', category: 'Background', needs: ['selfie'],
    frame({ ctx, video, w, h, person }) {
      ctx.save();
      ctx.filter = `blur(${Math.round(Math.max(w, h) / 80)}px)`;
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
      if (person) ctx.drawImage(personLayer(video, person, w, h), 0, 0);
    },
  },
  {
    id: 'bg-photo', name: 'My photo behind me', icon: 'camera', category: 'Background', needs: ['selfie'],
    frame({ ctx, video, w, h, person }) {
      if (!person || !customBg) return void ctx.drawImage(video, 0, 0, w, h);
      ctx.drawImage(customBackdrop(w, h), 0, 0);
      ctx.drawImage(personLayer(video, person, w, h), 0, 0);
    },
  },
  {
    // Touch-up: smooths skin (soft blur blended inside the face outline, eyes / brows / lips kept
    // sharp) and adds a little warmth and glow.
    id: 'mu-touchup', name: 'Touch-up', icon: 'blush', category: 'Beauty', needs: ['face'],
    frame({ ctx, video, w, h, faces }) {
      ctx.drawImage(video, 0, 0, w, h);
      if (!faces.length) return;
      const soft = canvas('touchup', w, h);
      const sx = soft.getContext('2d')!;
      sx.globalCompositeOperation = 'copy';
      sx.filter = `blur(${Math.max(2, Math.round(Math.max(w, h) / 220))}px) brightness(1.06) saturate(1.05)`;
      sx.drawImage(video, 0, 0, w, h);
      sx.filter = 'none';
      sx.globalCompositeOperation = 'destination-in';
      sx.fillStyle = '#000';
      for (const f of faces) {
        sx.beginPath(); path(sx, f, FACE_OVAL, w, h); sx.fill();
      }
      // keep features crisp
      sx.globalCompositeOperation = 'destination-out';
      for (const f of faces) {
        for (const part of [EYE_L, EYE_R, BROW_L, BROW_R, LIP_OUT]) { sx.beginPath(); path(sx, f, part, w, h); sx.fill(); }
      }
      sx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.drawImage(soft, 0, 0);
      ctx.restore();
    },
  },
  bgLens('beach', 'Sunset beach', 'flower'),
  bgLens('neon', 'Neon city', 'shades'),
  bgLens('space', 'Outer space', 'alien'),
  bgLens('studio', 'Nova studio', 'nova'),
  bgLens('mono', 'Clean studio', 'blush'),
  hairLens('pink', 'Bubblegum hair', '#FF4F9A', 'smitten'),
  hairLens('blue', 'Ocean hair', '#3D7BFF', 'halo'),
  hairLens('violet', 'Violet hair', '#8C6BFF', 'devil'),
  hairLens('copper', 'Copper hair', '#C8642D', 'flame'),
  hairLens('silver', 'Silver hair', '#D9DDE6', 'star'),
  hairLens('mint', 'Mint hair', '#18C48C', 'sprout'),
  makeupLens('rose', 'Rose glam', 'smitten', { lip: '#D8245A', blush: '#FF6F9C', liner: true }),
  makeupLens('berry', 'Berry lips', 'hearts', { lip: '#7E1640' }),
  makeupLens('nude', 'Nude gloss', 'blush', { lip: '#B9706A', gloss: true }),
  makeupLens('soft', 'Soft blush', 'blush', { blush: '#FF5F8F' }),
  makeupLens('liner', 'Winged liner', 'shades', { liner: true }),
  warpLens('eyes', 'Big eyes', 'wow', (ctx, v, f, w, h) => {
    const g = faceGeo(f, w, h);
    for (const idx of [[33, 133, 159, 145], [263, 362, 386, 374]]) {
      const c = centre(f, idx, w, h);
      bulge(ctx, v, c.x, c.y, g.faceW * 0.17, 1.55);
    }
  }),
  warpLens('mouth', 'Big mouth', 'chat', (ctx, v, f, w, h) => {
    const g = faceGeo(f, w, h);
    const c = centre(f, [13, 14, 61, 291], w, h);
    bulge(ctx, v, c.x, c.y, g.faceW * 0.26, 1.5);
  }),
  warpLens('bobble', 'Bobblehead', 'puppy', (ctx, v, f, w, h) => {
    const g = faceGeo(f, w, h);
    bulge(ctx, v, g.cx, g.cy, g.faceH * 0.78, 1.32);
  }),
  warpLens('squish', 'Squish', 'kitty', (ctx, v, f, w, h, t) => {
    const g = faceGeo(f, w, h);
    const wob = 1 + Math.sin(t * 3) * 0.05;
    bulge(ctx, v, g.cx, g.cy, g.faceH * 0.72, 1.35 * wob, 0.95);
  }),
  warpLens('long', 'Long face', 'alien', (ctx, v, f, w, h) => {
    const g = faceGeo(f, w, h);
    bulge(ctx, v, g.cx, g.cy, g.faceH * 0.72, 0.95, 1.3);
  }),
];
