import type { HeadShape } from './sculpt';
import type { HeadP } from './look/face';

/** Build a HeadShape from a v2 head variant plus the overall face-scale tune (-1 … 1). */
export function headFromParams(p: HeadP, faceTune = 0): HeadShape {
  const k = 1 + faceTune * 0.06;
  return { ...p, rx: p.rx * k, ry: p.ry * (1 + faceTune * 0.03), rz: p.rz * k };
}
