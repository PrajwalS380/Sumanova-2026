import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Face lens registry (original artwork drawn with Canvas 2D). Add a lens here and it
 * appears in the camera tray — no camera code changes needed.
 * Landmarks are MediaPipe Face Mesh points in normalised video coordinates.
 */
export interface Lens {
  id: string;
  name: string;
  emoji: string;
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

export const LENSES: Lens[] = [
  {
    id: 'shades', name: 'Night shades', emoji: '🕶️',
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
    id: 'crown', name: 'Royal', emoji: '👑',
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
    id: 'kitty', name: 'Kitty', emoji: '🐱',
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
    id: 'hearts', name: 'Smitten', emoji: '😍',
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
    id: 'aurora', name: 'Aurora paint', emoji: '✨',
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
    id: 'halo', name: 'Neon halo', emoji: '😇',
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
];

let landmarker: Promise<FaceLandmarker> | null = null;

/** Loads MediaPipe FaceLandmarker on first use (wasm + ~3.7 MB model, cached by the browser). */
export function loadLandmarker(): Promise<FaceLandmarker> {
  if (!landmarker) {
    landmarker = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      const opts = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', delegate },
        runningMode: 'VIDEO' as const,
        numFaces: 3,
      });
      try {
        return await FaceLandmarker.createFromOptions(files, opts('GPU'));
      } catch {
        return await FaceLandmarker.createFromOptions(files, opts('CPU'));
      }
    })().catch((e) => {
      landmarker = null;
      throw e;
    });
  }
  return landmarker;
}
