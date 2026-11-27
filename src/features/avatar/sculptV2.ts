import type { HeadShape } from './sculpt';
import type { HeadP } from './look/face';

/** Build a HeadShape from a v2 head variant plus the overall face-scale tune (-1 … 1). */
export function headFromParams(p: HeadP, faceTune = 0): HeadShape {
  const k = 1 + faceTune * 0.06;
  // stylised-adult face: a touch more oval, a slimmer jaw and a slightly longer chin than the
  // raw catalogue shape (every head shape keeps its own character)
  return { ...p, rx: p.rx * k * 0.98, ry: p.ry * (1 + faceTune * 0.03) * 1.03, rz: p.rz * k, jawN: Math.min(0.55, p.jawN + 0.07), chinLow: p.chinLow * 1.05 };
}
