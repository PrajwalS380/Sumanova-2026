import { describe, expect, it } from 'vitest';
import { analyzeFace, colorDist, frameHint, nearest, type Pt, type RGB } from './analyze';
import { looksFromTraits, skinForAvatar } from './generate';
import { normalizeLook } from '../look/config';
import { SKIN } from '../look/palettes';

/** A synthetic, front-facing face: 478 landmarks placed like a real face mesh's key points. */
function face(opts: { w?: number; h?: number; jaw?: number } = {}): Pt[] {
  const w = opts.w ?? 0.4, h = opts.h ?? 0.52, jaw = opts.jaw ?? 0.8;
  const cx = 0.5, cy = 0.5;
  const pts: Pt[] = Array.from({ length: 478 }, () => ({ x: cx, y: cy }));
  const set = (i: number, x: number, y: number) => { pts[i] = { x: cx + x * w, y: cy + y * h }; };
  set(10, 0, -0.5); set(152, 0, 0.5); set(234, -0.5, -0.05); set(454, 0.5, -0.05);
  set(172, -0.5 * jaw, 0.25); set(397, 0.5 * jaw, 0.25); set(136, -0.4 * jaw, 0.33); set(365, 0.4 * jaw, 0.33);
  set(50, -0.28, 0.08); set(280, 0.28, 0.08); set(151, 0, -0.38); set(1, 0, 0.1); set(2, 0, 0.16);
  set(33, -0.3, -0.08); set(133, -0.1, -0.08); set(159, -0.2, -0.11); set(145, -0.2, -0.05);
  set(263, 0.3, -0.08); set(362, 0.1, -0.08); set(386, 0.2, -0.11); set(374, 0.2, -0.05);
  set(468, -0.2, -0.08); set(469, -0.17, -0.08); set(473, 0.2, -0.08); set(474, 0.23, -0.08);
  set(105, -0.2, -0.2); set(52, -0.2, -0.16); set(334, 0.2, -0.2); set(282, 0.2, -0.16);
  set(129, -0.1, 0.12); set(358, 0.1, 0.12); set(61, -0.18, 0.27); set(291, 0.18, 0.27);
  set(0, 0, 0.22); set(13, 0, 0.25); set(14, 0, 0.27); set(17, 0, 0.31);
  return pts;
}

const SKIN_C: RGB = [205, 160, 125], HAIR_C: RGB = [30, 22, 18], BG: RGB = [235, 238, 242], BEARD: RGB = [70, 50, 40];
/** Paints: face oval = skin; above/around head = hair or background; optional beard on chin. */
function painter(f: Pt[], o: { hair?: 'none' | 'short' | 'long'; beard?: boolean } = {}) {
  const top = f[10], chin = f[152], cl = f[234], cr = f[454];
  const cx = (cl.x + cr.x) / 2, cy = (top.y + chin.y) / 2, rx = (cr.x - cl.x) / 2, ry = (chin.y - top.y) / 2;
  return (x: number, y: number): RGB => {
    const inFace = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
    if (inFace) {
      if (o.beard && y > chin.y - ry * 0.45 && Math.abs(x - cx) < rx * 0.9) return BEARD;
      return SKIN_C;
    }
    if (o.hair === 'none' || !o.hair) return BG;
    const above = y < top.y + ry * 0.35;
    if (o.hair === 'short') return above && Math.abs(x - cx) < rx * 1.1 ? HAIR_C : BG;
    return Math.abs(x - cx) < rx * 1.7 && y < chin.y + ry * 0.5 ? HAIR_C : BG; // long
  };
}

describe('selfie → avatar', () => {
  it('reads skin, hair colour and length, and beard from the photo', () => {
    const f = face();
    const t = analyzeFace(f, painter(f, { hair: 'long' }));
    expect(colorDist(t.skin, SKIN_C)).toBeLessThan(2);
    expect(colorDist(t.hair, HAIR_C)).toBeLessThan(2);
    expect(t.hairLength).toBe('long');
    expect(t.beard).toBe('none');
    const s = analyzeFace(f, painter(f, { hair: 'short', beard: true }));
    expect(s.hairLength).toBe('short');
    expect(s.beard).toBe('beard');
    expect(analyzeFace(f, painter(f, { hair: 'none' })).hairLength).toBe('none');
  });
  it('tells face shapes apart', () => {
    expect(analyzeFace(face({ h: 0.62, w: 0.4 }), () => SKIN_C).faceShape).toBe('Long');
    expect(analyzeFace(face({ jaw: 0.95 }), () => SKIN_C).faceShape).toBe('Square');
    expect(analyzeFace(face({ jaw: 0.6 }), () => SKIN_C).faceShape).toBe('Heart');
  });
  it('builds six valid, editable avatars that share the detected skin', () => {
    const f = face();
    const looks = looksFromTraits(analyzeFace(f, painter(f, { hair: 'short' })));
    expect(looks).toHaveLength(6);
    const skin = SKIN[nearest(skinForAvatar(SKIN_C), SKIN, 0.9)];
    for (const { look } of looks) {
      expect(look.skin).toBe(skin);
      expect(normalizeLook(JSON.parse(JSON.stringify(look)))).toEqual(look); // survives a save round-trip
    }
    expect(new Set(looks.map((l) => l.look.pick.hair)).size).toBeGreaterThan(3); // real variety
  });
  it('guides framing live', () => {
    expect(frameHint([], null)).toBe('no-face');
    expect(frameHint([face(), face()], null)).toBe('many');
    expect(frameHint([face({ w: 0.2 })], null)).toBe('closer');
    expect(frameHint([face()], () => SKIN_C)).toBe('ok');
    expect(frameHint([face()], () => [20, 15, 12])).toBe('light');
  });
});
