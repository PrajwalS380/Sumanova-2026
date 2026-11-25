import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { novaEmojiImage, type NovaEmojiId } from '@/components/emoji/novaEmoji';

/**
 * Face lens registry (original artwork drawn with Canvas 2D). Add a lens here and it
 * appears in the camera tray — no camera code changes needed.
 * Landmarks are MediaPipe Face Mesh points in normalised video coordinates.
 */
export interface Lens {
  id: string;
  name: string;
  /** Tray icon from our own Nova emoji set. */
  icon: NovaEmojiId;
  draw: (ctx: CanvasRenderingContext2D, face: NormalizedLandmark[], w: number, h: number, t: number) => void;
}

const P = (f: NormalizedLandmark[], i: number, w: number, h: number) => ({ x: f[i].x * w, y: f[i].y * h });
const geo = (f: NormalizedLandmark[], w: number, h: number) => {
  const le = P(f, 33, w, h), re = P(f, 263, w, h), top = P(f, 10, w, h), chin = P(f, 152, w, h), nose = P(f, 1, w, h);
  const lc = P(f, 234, w, h), rc = P(f, 454, w, h);
  const angle = Math.atan2(re.y - le.y, re.x - le.x);
  const faceW = Math.hypot(rc.x - lc.x, rc.y - lc.y);
  const faceH = Math.hypot(chin.x - top.x, chin.y - top.y);
  const eyeMid = { x: (le.x + re.x) / 2, y: (le.y + re.y) / 2 };
  return { le, re, top, chin, nose, lc, rc, angle, faceW, faceH, eyeMid };
};

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.45, y - s * 1.05, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s, y - s * 0.4, x, y + s * 0.35);
  ctx.fill();
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

/** Fill + bold outline in the Nova emoji style. */
function outlined(ctx: CanvasRenderingContext2D, lw: number, fill: string, path: () => void) {
  ctx.beginPath();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111';
  ctx.stroke();
}

/** Draws one of our Nova emoji, centred and rotated (skips until the image has decoded). */
function sticker(ctx: CanvasRenderingContext2D, id: NovaEmojiId, x: number, y: number, size: number, angle = 0) {
  const img = novaEmojiImage(id);
  if (!img) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

/** Lip gap relative to face height (≈0 closed, >0.08 open). */
const mouthOpen = (f: NormalizedLandmark[], w: number, h: number, g: ReturnType<typeof geo>) => {
  const a = P(f, 13, w, h), b = P(f, 14, w, h);
  return Math.hypot(a.x - b.x, a.y - b.y) / g.faceH;
};
/** Mouth-corner distance relative to face width (wider when smiling). */
const smileWidth = (f: NormalizedLandmark[], w: number, h: number, g: ReturnType<typeof geo>) => {
  const a = P(f, 61, w, h), b = P(f, 291, w, h);
  return Math.hypot(a.x - b.x, a.y - b.y) / g.faceW;
};

/** Start decoding every lens sticker so the first frames already show them. */
export function preloadLensArt() {
  for (const id of ['smitten', 'wow', 'blush', 'flower', 'butterfly', 'sparkle', 'star', 'hearts', 'nova', 'crown'] as NovaEmojiId[]) novaEmojiImage(id);
}

export const LENSES: Lens[] = [
  {
    id: 'shades', name: 'Night shades', icon: 'shades',
    draw(ctx, f, w, h) {
      const g = geo(f, w, h);
      ctx.save();
      ctx.translate(g.eyeMid.x, g.eyeMid.y);
      ctx.rotate(g.angle);
      const lw = g.faceW * 0.36, lh = g.faceW * 0.2, gap = g.faceW * 0.04;
      const grad = ctx.createLinearGradient(0, -lh, 0, lh);
      grad.addColorStop(0, 'rgba(124,58,237,.92)');
      grad.addColorStop(1, 'rgba(13,15,34,.96)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#f5f3ff';
      ctx.lineWidth = g.faceW * 0.018;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.roundRect(s < 0 ? -gap / 2 - lw : gap / 2, -lh / 2, lw, lh, lh * 0.45);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-gap / 2, -lh * 0.15);
      ctx.quadraticCurveTo(0, -lh * 0.4, gap / 2, -lh * 0.15);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (const s of [-1, 1]) ctx.fillRect(s < 0 ? -gap / 2 - lw * 0.8 : gap / 2 + lw * 0.2, -lh * 0.3, lw * 0.22, lh * 0.12);
      ctx.restore();
    },
  },
  {
    id: 'crown', name: 'Royal', icon: 'crown',
    draw(ctx, f, w, h, t) {
      const g = geo(f, w, h);
      ctx.save();
      ctx.translate(g.top.x, g.top.y - g.faceH * 0.05);
      ctx.rotate(g.angle);
      const cw = g.faceW * 0.85, ch = g.faceW * 0.38;
      const grad = ctx.createLinearGradient(0, -ch, 0, 0);
      grad.addColorStop(0, '#fde68a');
      grad.addColorStop(1, '#d97706');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-cw / 2, 0);
      ctx.lineTo(-cw / 2, -ch * 0.55);
      ctx.lineTo(-cw / 4, -ch * 0.2);
      ctx.lineTo(0, -ch);
      ctx.lineTo(cw / 4, -ch * 0.2);
      ctx.lineTo(cw / 2, -ch * 0.55);
      ctx.lineTo(cw / 2, 0);
      ctx.closePath();
      ctx.fill();
      const gems = ['#fb7185', '#2dd4bf', '#a78bfa'];
      [-cw / 4, 0, cw / 4].forEach((x, i) => {
        ctx.fillStyle = gems[i];
        ctx.beginPath();
        ctx.arc(x, -ch * 0.18, ch * 0.09, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = `rgba(255,255,255,${0.5 + Math.sin(t * 4) * 0.4})`;
      sparkle(ctx, cw * 0.35, -ch * 0.9, ch * 0.12);
      ctx.restore();
    },
  },
  {
    id: 'kitty', name: 'Kitty', icon: 'kitty',
    draw(ctx, f, w, h) {
      const g = geo(f, w, h);
      ctx.save();
      ctx.translate(g.top.x, g.top.y);
      ctx.rotate(g.angle);
      for (const s of [-1, 1]) {
        const x = s * g.faceW * 0.32;
        ctx.fillStyle = '#1f1b2e';
        ctx.beginPath();
        ctx.moveTo(x - g.faceW * 0.16, 0);
        ctx.lineTo(x + s * g.faceW * 0.04, -g.faceW * 0.38);
        ctx.lineTo(x + g.faceW * 0.16, 0);
        ctx.fill();
        ctx.fillStyle = '#f9a8d4';
        ctx.beginPath();
        ctx.moveTo(x - g.faceW * 0.08, -g.faceW * 0.03);
        ctx.lineTo(x + s * g.faceW * 0.03, -g.faceW * 0.27);
        ctx.lineTo(x + g.faceW * 0.08, -g.faceW * 0.03);
        ctx.fill();
      }
      ctx.restore();
      ctx.save();
      ctx.translate(g.nose.x, g.nose.y);
      ctx.rotate(g.angle);
      ctx.fillStyle = '#f472b6';
      ctx.beginPath();
      ctx.ellipse(0, 0, g.faceW * 0.05, g.faceW * 0.035, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = g.faceW * 0.008;
      for (const s of [-1, 1]) for (const k of [-1, 0, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * g.faceW * 0.08, g.faceW * 0.03 + k * g.faceW * 0.025);
        ctx.lineTo(s * g.faceW * 0.32, g.faceW * 0.01 + k * g.faceW * 0.06);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
  {
    id: 'hearts', name: 'Smitten', icon: 'smitten',
    draw(ctx, f, w, h, t) {
      const g = geo(f, w, h);
      const pulse = 1 + Math.sin(t * 6) * 0.08;
      ctx.fillStyle = '#fb2c5a';
      ctx.shadowColor = 'rgba(251,44,90,.8)';
      ctx.shadowBlur = g.faceW * 0.08;
      for (const e of [g.le, g.re]) heart(ctx, (e.x + g.eyeMid.x * 0.6) / 1.6, e.y, g.faceW * 0.13 * pulse);
      ctx.shadowBlur = 0;
      for (let i = 0; i < 5; i++) {
        const p = (t * 0.35 + i / 5) % 1;
        ctx.fillStyle = `rgba(251,113,133,${1 - p})`;
        heart(ctx, g.top.x + Math.sin(i * 2.1 + t) * g.faceW * 0.6, g.top.y - p * g.faceH * 0.9, g.faceW * 0.06);
      }
    },
  },
  {
    id: 'aurora', name: 'Aurora paint', icon: 'sparkle',
    draw(ctx, f, w, h, t) {
      const g = geo(f, w, h);
      for (const [s, c] of [[-1, g.lc], [1, g.rc]] as const) {
        const x = c.x + (g.nose.x - c.x) * 0.35, y = g.nose.y;
        const grad = ctx.createLinearGradient(x - g.faceW * 0.12, y, x + g.faceW * 0.12, y);
        grad.addColorStop(0, 'rgba(139,92,246,.85)');
        grad.addColorStop(0.5, 'rgba(45,212,191,.85)');
        grad.addColorStop(1, 'rgba(251,113,133,.85)');
        ctx.strokeStyle = grad;
        ctx.lineCap = 'round';
        ctx.lineWidth = g.faceW * 0.03;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(x - s * g.faceW * 0.1, y - g.faceW * 0.05 + k * g.faceW * 0.045);
          ctx.lineTo(x + s * g.faceW * 0.08, y - g.faceW * 0.02 + k * g.faceW * 0.045);
          ctx.stroke();
        }
      }
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 6; i++) {
        const a = t * 0.8 + (i * Math.PI) / 3;
        const s = (Math.sin(t * 3 + i) + 1.4) * g.faceW * 0.02;
        sparkle(ctx, g.eyeMid.x + Math.cos(a) * g.faceW * 0.75, g.eyeMid.y + Math.sin(a) * g.faceH * 0.65, s);
      }
    },
  },
  {
    id: 'halo', name: 'Neon halo', icon: 'halo',
    draw(ctx, f, w, h, t) {
      const g = geo(f, w, h);
      ctx.save();
      ctx.translate(g.top.x, g.top.y - g.faceH * 0.22 + Math.sin(t * 2) * g.faceH * 0.02);
      ctx.rotate(g.angle);
      ctx.strokeStyle = '#5eead4';
      ctx.shadowColor = '#2dd4bf';
      ctx.shadowBlur = g.faceW * 0.12;
      ctx.lineWidth = g.faceW * 0.045;
      ctx.beginPath();
      ctx.ellipse(0, 0, g.faceW * 0.42, g.faceW * 0.1, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: 'emojime', name: 'Emoji me', icon: 'smitten',
    // Your face becomes a Nova emoji that reacts: open your mouth → wow, smile wide → smitten.
    draw(ctx, f, w, h) {
      const g = geo(f, w, h);
      const id: NovaEmojiId = mouthOpen(f, w, h, g) > 0.12 ? 'wow' : smileWidth(f, w, h, g) > 0.42 ? 'smitten' : 'blush';
      sticker(ctx, id, g.nose.x, (g.top.y + g.chin.y) / 2, g.faceH * 1.25, g.angle);
    },
  },
  {
    id: 'puppy', name: 'Puppy', icon: 'puppy',
    draw(ctx, f, w, h, t) {
      const g = geo(f, w, h);
      const open = mouthOpen(f, w, h, g);
      ctx.save();
      ctx.translate(g.top.x, g.top.y);
      ctx.rotate(g.angle);
      for (const s of [-1, 1]) {
        const sway = Math.sin(t * 3 + s) * 0.06;
        ctx.save();
        ctx.translate(s * g.faceW * 0.5, -g.faceH * 0.02);
        ctx.rotate(-s * (0.55 + sway));
        outlined(ctx, g.faceW * 0.02, '#8A5A3B', () => ctx.ellipse(0, g.faceH * 0.22, g.faceW * 0.15, g.faceH * 0.3, 0, 0, Math.PI * 2));
        ctx.restore();
      }
      ctx.restore();
      ctx.save();
      ctx.translate(g.nose.x, g.nose.y);
      ctx.rotate(g.angle);
      outlined(ctx, g.faceW * 0.012, '#111', () => ctx.ellipse(0, -g.faceW * 0.01, g.faceW * 0.075, g.faceW * 0.055, 0, 0, Math.PI * 2));
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath();
      ctx.ellipse(-g.faceW * 0.02, -g.faceW * 0.03, g.faceW * 0.02, g.faceW * 0.012, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (open > 0.08) {
        const lip = P(f, 14, w, h);
        ctx.save();
        ctx.translate(lip.x, lip.y);
        ctx.rotate(g.angle);
        const len = g.faceH * Math.min(0.32, open * 1.6);
        outlined(ctx, g.faceW * 0.012, '#FF6F9C', () => ctx.roundRect(-g.faceW * 0.07, -g.faceW * 0.02, g.faceW * 0.14, len, g.faceW * 0.07));
        ctx.restore();
      }
    },
  },
  {
    id: 'bunny', name: 'Bunny', icon: 'bunny',
    draw(ctx, f, w, h, t) {
      const g = geo(f, w, h);
      ctx.save();
      ctx.translate(g.top.x, g.top.y);
      ctx.rotate(g.angle);
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * g.faceW * 0.2, -g.faceH * 0.02);
        ctx.rotate(s * (0.12 + Math.sin(t * 2.4 + s * 2) * 0.05));
        const ew = g.faceW * 0.2, eh = g.faceH * 0.75;
        outlined(ctx, g.faceW * 0.018, '#fff', () => ctx.roundRect(-ew / 2, -eh, ew, eh, ew / 2));
        ctx.fillStyle = '#FFB3CF';
        ctx.beginPath();
        ctx.roundRect(-ew * 0.22, -eh * 0.88, ew * 0.44, eh * 0.7, ew * 0.22);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      ctx.save();
      ctx.translate(g.nose.x, g.nose.y);
      ctx.rotate(g.angle);
      outlined(ctx, g.faceW * 0.01, '#FF4F9A', () => {
        ctx.moveTo(-g.faceW * 0.05, -g.faceW * 0.03);
        ctx.lineTo(g.faceW * 0.05, -g.faceW * 0.03);
        ctx.lineTo(0, g.faceW * 0.025);
        ctx.closePath();
      });
      ctx.restore();
      const lip = P(f, 13, w, h);
      ctx.save();
      ctx.translate(lip.x, lip.y);
      ctx.rotate(g.angle);
      for (const s of [-1, 1]) outlined(ctx, g.faceW * 0.008, '#fff', () => ctx.roundRect(s < 0 ? -g.faceW * 0.045 : g.faceW * 0.002, -g.faceW * 0.01, g.faceW * 0.043, g.faceW * 0.06, g.faceW * 0.008));
      ctx.restore();
    },
  },
  {
    id: 'flowercrown', name: 'Flower crown', icon: 'flower',
    draw(ctx, f, w, h, t) {
      const g = geo(f, w, h);
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (i / (n - 1)) * Math.PI; // left → right along the top of the head
        const x = g.top.x + Math.cos(a + g.angle) * g.faceW * 0.55;
        const y = g.top.y + g.faceH * 0.12 + Math.sin(a + g.angle) * g.faceH * 0.32;
        const size = g.faceW * (i % 2 ? 0.2 : 0.26) * (1 + Math.sin(t * 3 + i) * 0.04);
        sticker(ctx, i % 3 === 1 ? 'butterfly' : 'flower', x, y, size, g.angle + Math.sin(t * 2 + i) * 0.15);
      }
    },
  },
  {
    id: 'butterflies', name: 'Butterflies', icon: 'butterfly',
    draw(ctx, f, w, h, t) {
      const g = geo(f, w, h);
      for (let i = 0; i < 4; i++) {
        const a = t * (0.7 + i * 0.12) + (i * Math.PI) / 2;
        const x = g.eyeMid.x + Math.cos(a) * g.faceW * 0.85;
        const y = g.eyeMid.y - g.faceH * 0.1 + Math.sin(a * 1.3) * g.faceH * 0.55;
        const flap = 0.55 + Math.abs(Math.sin(t * 9 + i)) * 0.45;
        const img = novaEmojiImage('butterfly');
        if (!img) continue;
        const s = g.faceW * 0.32;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(t + i) * 0.4);
        ctx.scale(flap, 1);
        ctx.drawImage(img, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
    },
  },
  {
    id: 'devil', name: 'Little devil', icon: 'devil',
    draw(ctx, f, w, h, t) {
      const g = geo(f, w, h);
      ctx.save();
      ctx.translate(g.top.x, g.top.y + g.faceH * 0.04);
      ctx.rotate(g.angle);
      for (const s of [-1, 1]) {
        const x = s * g.faceW * 0.27, hh = g.faceH * 0.3;
        outlined(ctx, g.faceW * 0.018, '#FF3B3B', () => {
          ctx.moveTo(x - s * g.faceW * 0.09, 0);
          ctx.quadraticCurveTo(x + s * g.faceW * 0.02, -hh * 0.5, x + s * g.faceW * 0.12, -hh);
          ctx.quadraticCurveTo(x + s * g.faceW * 0.1, -hh * 0.35, x + s * g.faceW * 0.1, 0);
          ctx.closePath();
        });
      }
      ctx.restore();
      ctx.fillStyle = `rgba(255,59,59,${0.5 + Math.sin(t * 5) * 0.3})`;
      for (let i = 0; i < 4; i++) {
        const p = (t * 0.6 + i / 4) % 1;
        sparkle(ctx, g.top.x + Math.sin(i * 2.3) * g.faceW * 0.55, g.top.y - p * g.faceH * 0.6, g.faceW * 0.03);
      }
    },
  },
  {
    id: 'alien', name: 'Space buddy', icon: 'alien',
    draw(ctx, f, w, h, t) {
      const g = geo(f, w, h);
      ctx.save();
      ctx.translate(g.top.x, g.top.y + g.faceH * 0.02);
      ctx.rotate(g.angle);
      for (const s of [-1, 1]) {
        const tipX = s * g.faceW * 0.3 + Math.sin(t * 3 + s) * g.faceW * 0.03, tipY = -g.faceH * 0.42;
        ctx.strokeStyle = '#111';
        ctx.lineWidth = g.faceW * 0.03;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s * g.faceW * 0.12, 0);
        ctx.quadraticCurveTo(s * g.faceW * 0.12, tipY * 0.6, tipX, tipY);
        ctx.stroke();
        ctx.strokeStyle = '#7BE07B';
        ctx.lineWidth = g.faceW * 0.016;
        ctx.stroke();
        const glow = 1 + Math.sin(t * 6 + s) * 0.15;
        outlined(ctx, g.faceW * 0.015, '#FF4F9A', () => ctx.arc(tipX, tipY, g.faceW * 0.055 * glow, 0, Math.PI * 2));
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(123,224,123,.22)';
      ctx.beginPath();
      ctx.ellipse(g.nose.x, (g.top.y + g.chin.y) / 2, g.faceW * 0.55, g.faceH * 0.58, g.angle, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'blush', name: 'Rosy', icon: 'blush',
    draw(ctx, f, w, h) {
      const g = geo(f, w, h);
      for (const i of [50, 280]) {
        const c = P(f, i, w, h);
        const r = g.faceW * 0.13;
        const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
        grad.addColorStop(0, 'rgba(255,79,154,.45)');
        grad.addColorStop(1, 'rgba(255,79,154,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(150,80,50,.55)';
        for (let k = 0; k < 6; k++) {
          ctx.beginPath();
          ctx.arc(c.x + Math.cos(k * 2.4) * r * 0.5, c.y - r * 0.2 + Math.sin(k * 3.1) * r * 0.3, g.faceW * 0.006, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      sticker(ctx, 'sparkle', g.re.x + g.faceW * 0.25, g.re.y - g.faceH * 0.2, g.faceW * 0.16, g.angle);
    },
  },
  {
    id: 'wow', name: 'Star burst', icon: 'wow',
    // Open your mouth and Nova stars burst out of it.
    draw(ctx, f, w, h, t) {
      const g = geo(f, w, h);
      const open = mouthOpen(f, w, h, g);
      const m = P(f, 13, w, h), m2 = P(f, 14, w, h);
      const mx = (m.x + m2.x) / 2, my = (m.y + m2.y) / 2;
      const n = open > 0.08 ? 10 : 3;
      for (let i = 0; i < n; i++) {
        const p = (t * (open > 0.08 ? 1.4 : 0.5) + i / n) % 1;
        const a = g.angle - Math.PI / 2 + (i - (n - 1) / 2) * 0.4;
        const dist = p * g.faceH * (open > 0.08 ? 1.1 : 0.5);
        const ids: NovaEmojiId[] = ['sparkle', 'star', 'hearts'];
        ctx.globalAlpha = 1 - p;
        sticker(ctx, ids[i % 3], mx + Math.cos(a) * dist, my + Math.sin(a) * dist, g.faceW * (0.16 + p * 0.18), p * 3);
        ctx.globalAlpha = 1;
      }
    },
  },
  {
    id: 'novarain', name: 'Nova rain', icon: 'nova',
    draw(ctx, f, w, h, t) {
      const g = geo(f, w, h);
      const ids: NovaEmojiId[] = ['nova', 'hearts', 'star', 'sparkle', 'flower'];
      for (let i = 0; i < 12; i++) {
        const p = (t * 0.25 + (i * 0.618) % 1) % 1;
        const x = ((i * 0.37 + 0.05) % 1) * w;
        const y = -h * 0.1 + p * h * 1.2;
        sticker(ctx, ids[i % ids.length], x, y, Math.max(g.faceW * 0.22, w * 0.07), Math.sin(t * 2 + i) * 0.5);
      }
      sticker(ctx, 'crown', g.top.x, g.top.y - g.faceH * 0.12, g.faceW * 0.5, g.angle);
    },
  },
];

let landmarker: Promise<FaceLandmarker> | null = null;

/** Loads MediaPipe FaceLandmarker on first use (wasm + ~3.7 MB model, cached by the browser). */
export function loadLandmarker(): Promise<FaceLandmarker> {
  if (!landmarker) {
    landmarker = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      // Bundled with the app (public/mediapipe — same 0.10.14 build), so face tracking works offline
      // and never depends on a third-party CDN. The public CDNs are only a fallback.
      const LOCAL = '/mediapipe';
      const sources = [
        { wasm: LOCAL, model: `${LOCAL}/face_landmarker.task` },
        { wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm', model: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' },
      ];
      let lastError: unknown;
      for (const src of sources) {
        try {
          const files = await FilesetResolver.forVisionTasks(src.wasm);
          const opts = (delegate: 'GPU' | 'CPU') => ({
            baseOptions: { modelAssetPath: src.model, delegate },
            runningMode: 'VIDEO' as const,
            numFaces: 3,
          });
          try {
            return await FaceLandmarker.createFromOptions(files, opts('GPU'));
          } catch {
            return await FaceLandmarker.createFromOptions(files, opts('CPU'));
          }
        } catch (e) {
          lastError = e;
        }
      }
      throw lastError ?? new Error('Face tracking unavailable');
    })().catch((e) => {
      landmarker = null;
      throw e;
    });
  }
  return landmarker;
}
