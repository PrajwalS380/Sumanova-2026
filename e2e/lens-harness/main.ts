import { LENSES, loadLandmarker } from '@/features/camera/lenses';
import { novaEmojiImage, NOVA_EMOJI_IDS } from '@/components/emoji/novaEmoji';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

// Visual check of every face lens.
// Default: synthetic face. ?photo=<url>: real MediaPipe landmarks from that photo (plus a mouth-open variant).
const photo = new URLSearchParams(location.search).get('photo');

function synthetic(): NormalizedLandmark[] {
  const pts: Record<number, [number, number]> = { 33: [0.4, 0.42], 263: [0.6, 0.42], 10: [0.5, 0.26], 152: [0.5, 0.74], 1: [0.5, 0.52], 234: [0.33, 0.48], 454: [0.67, 0.48], 13: [0.5, 0.62], 14: [0.5, 0.63], 61: [0.44, 0.63], 291: [0.56, 0.63], 50: [0.4, 0.55], 280: [0.6, 0.55] };
  return Array.from({ length: 478 }, (_, i) => ({ x: pts[i]?.[0] ?? 0.5, y: pts[i]?.[1] ?? 0.5, z: 0, visibility: 1 }));
}

async function main() {
  for (const id of NOVA_EMOJI_IDS) novaEmojiImage(id);
  await new Promise((r) => setTimeout(r, 300));
  let bg: HTMLImageElement | null = null;
  let face = synthetic();
  if (photo) {
    bg = new Image();
    bg.src = photo;
    await bg.decode();
    const lm = await loadLandmarker();
    lm.setOptions({ runningMode: 'IMAGE' });
    face = lm.detect(bg).faceLandmarks[0];
  }
  const W = 300, H = bg ? Math.round((300 * bg.naturalHeight) / bg.naturalWidth) : 360;
  const open = face.map((p, i) => (i === 14 ? { ...p, y: p.y + 0.06 } : p));
  for (const [lens, f] of [...LENSES.map((l) => [l, face] as const), ...LENSES.filter((l) => ['emojime', 'puppy', 'wow'].includes(l.id)).map((l) => [l, open] as const)]) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    else {
      ctx.fillStyle = '#2a2d52'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#d9a074'; ctx.beginPath(); ctx.ellipse(150, 180, 52, 70, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    lens.draw(ctx, f, W, H, 1.2);
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(lens.name + (f === open ? ' (mouth open)' : ''), 8, H - 8);
    document.body.appendChild(c);
  }
  // Canvas must stay exportable (snaps are saved with toBlob).
  (window as unknown as { exportable: boolean }).exportable = !!document.querySelector('canvas')!.toDataURL().length;
  (window as unknown as { done: boolean }).done = true;
}
void main();
