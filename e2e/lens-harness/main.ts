import { LENSES } from '@/features/camera/lenses';
// Synthetic face: only the landmark indices the lenses use, placed like a centred frontal face.
const pts: Record<number, [number, number]> = { 33: [0.4, 0.42], 263: [0.6, 0.42], 10: [0.5, 0.26], 152: [0.5, 0.74], 1: [0.5, 0.52], 234: [0.33, 0.48], 454: [0.67, 0.48] };
const face = Array.from({ length: 478 }, (_, i) => ({ x: pts[i]?.[0] ?? 0.5, y: pts[i]?.[1] ?? 0.5, z: 0 }));
for (const lens of LENSES) {
  const c = document.createElement('canvas');
  c.width = 300; c.height = 360;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2a2d52'; ctx.fillRect(0, 0, 300, 360);
  ctx.fillStyle = '#d9a074'; ctx.beginPath(); ctx.ellipse(150, 180, 52, 70, 0, 0, Math.PI * 2); ctx.fill();
  lens.draw(ctx, face, 300, 360, 1.2);
  ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(lens.name, 8, 352);
  document.body.appendChild(c);
}
(window as unknown as { done: boolean }).done = true;
