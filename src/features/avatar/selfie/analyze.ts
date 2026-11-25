/**
 * Selfie → face traits. Runs entirely on the device: MediaPipe Face Mesh
 * landmarks (478 points incl. irises, normalised 0–1) plus the photo's pixels.
 * Nothing is uploaded. Pure functions so it can be unit-tested.
 */
export interface Pt { x: number; y: number }
export type RGB = [number, number, number];
/** Average colour of a small patch around a normalised point. */
export type Sampler = (x: number, y: number, radius: number) => RGB;

export type FaceShape = 'Oval' | 'Round' | 'Square' | 'Heart' | 'Long' | 'Wide' | 'Narrow';
export type EyeShape = 'Almond' | 'Round' | 'Hooded' | 'Upturned' | 'Downturned' | 'Monolid' | 'Doe';
export type HairLength = 'none' | 'short' | 'medium' | 'long';
export type Beard = 'none' | 'stubble' | 'beard' | 'moustache';

export interface FaceTraits {
  skin: RGB;
  hair: RGB;
  eyes: RGB;
  lips: RGB;
  brows: RGB;
  hairLength: HairLength;
  hairVolume: boolean;
  beard: Beard;
  faceShape: FaceShape;
  eyeShape: EyeShape;
  /** −1 … 1 relative to an average face */
  eyeSize: number;
  eyeGap: number;
  browThick: boolean;
  noseWidth: 'narrow' | 'average' | 'wide';
  lips_: 'thin' | 'balanced' | 'full';
  mouthWidth: 'petite' | 'average' | 'wide';
  /** 0–1 overall photo usefulness (lighting/size) */
  quality: number;
}

// --- colour helpers ---------------------------------------------------------
export function hexToRgb(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toLab([r, g, b]: RGB): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255;
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
  };
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
/** Perceptual colour distance (CIE76, lightness down-weighted for lighting). */
export function colorDist(a: RGB, b: RGB, lightWeight = 1): number {
  const A = toLab(a), B = toLab(b);
  return Math.hypot((A[0] - B[0]) * lightWeight, A[1] - B[1], A[2] - B[2]);
}
export const lightness = (c: RGB) => toLab(c)[0];
/** Closest palette entry index. */
export function nearest(c: RGB, palette: string[], lightWeight = 1): number {
  let best = 0, bd = Infinity;
  palette.forEach((h, i) => {
    const d = colorDist(c, hexToRgb(h), lightWeight);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
/** Median of the 20–60th percentile (by lightness) — robust to highlights and deep shadows. */
function shadedTone(cs: RGB[]): RGB {
  const sorted = [...cs].sort((a, b) => lightness(a) - lightness(b));
  const lo = Math.floor(sorted.length * 0.2), hi = Math.max(lo + 1, Math.ceil(sorted.length * 0.6));
  return median(sorted.slice(lo, hi));
}
function median(cs: RGB[]): RGB {
  const m = (k: 0 | 1 | 2) => {
    const v = cs.map((c) => c[k]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  return [m(0), m(1), m(2)];
}

// --- geometry helpers ---------------------------------------------------------
const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));

/** Landmark indices (MediaPipe Face Mesh). */
const L = {
  top: 10, chin: 152, cheekL: 234, cheekR: 454, jawL: 172, jawR: 397, jawLowL: 136, jawLowR: 365,
  skinL: 50, skinR: 280, forehead: 151, noseTip: 1, subnasal: 2,
  eyeLOut: 33, eyeLIn: 133, eyeLUp: 159, eyeLDown: 145, eyeROut: 263, eyeRIn: 362, eyeRUp: 386, eyeRDown: 374,
  irisL: 468, irisR: 473, irisLEdge: 469, irisREdge: 474,
  browLUp: 105, browLDown: 52, browRUp: 334, browRDown: 282,
  alarL: 129, alarR: 358, mouthL: 61, mouthR: 291, lipTop: 0, lipUpIn: 13, lipLowIn: 14, lipBottom: 17,
};

/**
 * Work out face traits from landmarks + pixel sampler. `aspect` = image width / height
 * (landmarks are normalised separately on each axis).
 */
export function analyzeFace(lm: Pt[], sample: Sampler, aspect = 1): FaceTraits {
  // Work in an isotropic space so ratios are true to life.
  const P = (i: number): Pt => ({ x: lm[i].x * aspect, y: lm[i].y });
  const S = (p: Pt, r: number) => sample(p.x / aspect, p.y, r);

  const top = P(L.top), chin = P(L.chin), cl = P(L.cheekL), cr = P(L.cheekR);
  const faceW = d(cl, cr), faceH = d(top, chin);
  const up = { x: (top.x - chin.x) / faceH, y: (top.y - chin.y) / faceH }; // unit vector chin→top
  const along = (p: Pt, k: number): Pt => ({ x: p.x + up.x * faceH * k, y: p.y + up.y * faceH * k });
  const center = lerp(cl, cr, 0.5);
  const out = (p: Pt, k: number): Pt => ({ x: p.x + (p.x - center.x) * k, y: p.y + (p.y - center.y) * k });
  const r = faceW * 0.035;

  // Skin: many patches (cheeks, under the eyes, jaw sides, forehead). Studio light and phone
  // HDR blow out highlights, so we use the shaded side of the distribution, not the bright side.
  const skin = shadedTone([
    S(P(L.skinL), r), S(P(L.skinR), r), S(lerp(P(L.forehead), top, 0.45), r),
    S(lerp(P(L.skinL), P(L.noseTip), 0.25), r), S(lerp(P(L.skinR), P(L.noseTip), 0.25), r),
    S(lerp(P(L.eyeLDown), P(L.skinL), 0.5), r * 0.7), S(lerp(P(L.eyeRDown), P(L.skinR), 0.5), r * 0.7),
    S(lerp(P(L.skinL), P(L.jawLowL), 0.5), r), S(lerp(P(L.skinR), P(L.jawLowR), 0.5), r),
  ]);
  const skinL = lightness(skin);

  // Background reference: well outside the face at eye height.
  const bg = median([S(out(cl, 0.9), r * 1.5), S(out(cr, 0.9), r * 1.5)]);

  // Hair: just above the hairline, temples, and further up for volume.
  const crown = S(along(top, 0.1), r * 1.3);
  // Temples: just outside the forehead contour, where hair usually frames the face.
  const templeL = S(out(lerp(cl, top, 0.5), 0.14), r);
  const templeR = S(out(lerp(cr, top, 0.5), 0.14), r);
  const isHair = (c: RGB) => colorDist(c, skin, 0.7) > 16 && (colorDist(c, bg, 0.8) > 14 || lightness(c) < 30);
  const hairCands = [crown, templeL, templeR].filter(isHair);
  const hasHair = isHair(crown) || hairCands.length >= 2;
  // Very short / cropped hair often reads like scalp: still take the darkest top sample as its colour.
  const darkest = [crown, templeL, templeR].sort((a, b) => lightness(a) - lightness(b))[0];
  const hair = hasHair ? median(hairCands) : lightness(darkest) < skinL - 10 ? darkest : ([42, 29, 22] as RGB);
  const likeHair = (c: RGB) => hasHair && colorDist(c, hair, 0.6) < 18 && colorDist(c, skin, 0.7) > 14;

  // Length: beside the jaw (shoulder-length+) and beside the ears (medium).
  const sideJaw = [S(out(P(L.jawLowL), 0.32), r), S(out(P(L.jawLowR), 0.32), r)];
  const sideEar = [S(out(P(L.cheekL), 0.14), r), S(out(P(L.cheekR), 0.14), r)];
  const hairLength: HairLength = !hasHair ? 'none' : sideJaw.some(likeHair) ? 'long' : sideEar.filter(likeHair).length === 2 ? 'medium' : 'short';
  const hairVolume = hasHair && likeHair(S(along(top, 0.28), r * 1.4));

  // Beard: chin, jaw sides and upper lip vs cheek skin lightness.
  const drop = (c: RGB) => skinL - lightness(c);
  const chinD = drop(S(lerp(P(L.chin), P(L.lipBottom), 0.4), r));
  const jawD = (drop(S(lerp(P(L.jawLowL), P(L.mouthL), 0.3), r)) + drop(S(lerp(P(L.jawLowR), P(L.mouthR), 0.3), r))) / 2;
  const lipD = drop(S(lerp(P(L.subnasal), P(L.lipTop), 0.5), r * 0.8));
  const beard: Beard = chinD > 24 && jawD > 18 ? 'beard' : chinD > 13 && jawD > 10 ? 'stubble' : lipD > 22 && chinD < 13 ? 'moustache' : 'none';

  // Colours of eyes, lips, brows.
  const irisR = Math.max(d(P(L.irisL), P(L.irisLEdge)), faceW * 0.015);
  const eyes = median([S(lerp(P(L.irisL), P(L.irisLEdge), 0.45), irisR * 0.35), S(lerp(P(L.irisR), P(L.irisREdge), 0.45), irisR * 0.35), S(P(L.irisL), irisR * 0.3), S(P(L.irisR), irisR * 0.3)]);
  const lips = median([S(lerp(P(L.lipUpIn), P(L.lipTop), 0.5), r * 0.6), S(lerp(P(L.lipLowIn), P(L.lipBottom), 0.5), r * 0.7), S(lerp(P(L.mouthL), P(L.lipLowIn), 0.35), r * 0.5)]);
  const browMidL = lerp(P(L.browLUp), P(L.browLDown), 0.5), browMidR = lerp(P(L.browRUp), P(L.browRDown), 0.5);
  const brows = median([S(browMidL, r * 0.6), S(browMidR, r * 0.6)]);
  const browThick = (d(P(L.browLUp), P(L.browLDown)) + d(P(L.browRUp), P(L.browRDown))) / 2 / faceH > 0.052;

  // Face shape.
  const ratio = faceH / faceW;
  const jaw = d(P(L.jawL), P(L.jawR)) / faceW;
  const faceShape: FaceShape = ratio > 1.42 ? 'Long' : jaw > 0.86 ? 'Square' : jaw < 0.72 ? 'Heart' : ratio < 1.12 ? 'Wide' : ratio < 1.2 ? 'Round' : ratio > 1.34 ? 'Narrow' : 'Oval';

  // Eyes.
  const eyeW = (d(P(L.eyeLOut), P(L.eyeLIn)) + d(P(L.eyeROut), P(L.eyeRIn))) / 2;
  const open = (d(P(L.eyeLUp), P(L.eyeLDown)) + d(P(L.eyeRUp), P(L.eyeRDown))) / 2 / eyeW;
  // Tilt: outer corner higher than inner → positive (y grows downwards).
  const tilt = ((P(L.eyeLIn).y - P(L.eyeLOut).y) + (P(L.eyeRIn).y - P(L.eyeROut).y)) / 2 / eyeW;
  const eyeShape: EyeShape = open < 0.17 ? 'Monolid' : open < 0.24 ? 'Hooded' : tilt > 0.09 ? 'Upturned' : tilt < -0.05 ? 'Downturned' : open > 0.42 ? 'Doe' : open > 0.35 ? 'Round' : 'Almond';
  const eyeSize = clamp((eyeW / faceW - 0.205) / 0.035) * 0.6;
  const eyeGap = clamp((d(P(L.eyeLIn), P(L.eyeRIn)) / faceW - 0.245) / 0.04) * 0.6;

  // Nose and mouth.
  const nw = d(P(L.alarL), P(L.alarR)) / faceW;
  const noseWidth = nw > 0.29 ? 'wide' : nw < 0.22 ? 'narrow' : 'average';
  const mw = d(P(L.mouthL), P(L.mouthR)) / faceW;
  const mouthWidth = mw > 0.44 ? 'wide' : mw < 0.34 ? 'petite' : 'average';
  const lt = (d(P(L.lipTop), P(L.lipUpIn)) + d(P(L.lipLowIn), P(L.lipBottom))) / faceH;
  const lips_ = lt > 0.115 ? 'full' : lt < 0.07 ? 'thin' : 'balanced';

  // Quality: big enough and lit well enough.
  const quality = Math.max(0, Math.min(1, (faceW / aspect / 0.35) * 0.5 + (Math.min(skinL, 70) / 70) * 0.5));

  return { skin, hair, eyes, lips, brows, hairLength, hairVolume, beard, faceShape, eyeShape, eyeSize, eyeGap, browThick, noseWidth, lips_, mouthWidth, quality };
}

/** Live framing check for the camera guide (fast — geometry + one brightness sample). */
export type FrameHint = 'ok' | 'no-face' | 'many' | 'closer' | 'farther' | 'center' | 'straight' | 'light';
export function frameHint(faces: Pt[][], sample: Sampler | null): FrameHint {
  if (faces.length === 0) return 'no-face';
  if (faces.length > 1) return 'many';
  const f = faces[0];
  const w = d(f[L.cheekL], f[L.cheekR]);
  if (w < 0.3) return 'closer';
  if (w > 0.8) return 'farther';
  const cx = (f[L.cheekL].x + f[L.cheekR].x) / 2, cy = (f[L.top].y + f[L.chin].y) / 2;
  if (Math.abs(cx - 0.5) > 0.14 || Math.abs(cy - 0.5) > 0.18) return 'center';
  const yaw = (f[L.noseTip].x - f[L.cheekL].x) / (f[L.cheekR].x - f[L.cheekL].x);
  if (yaw < 0.38 || yaw > 0.62) return 'straight';
  if (sample && lightness(sample(f[L.skinL].x, f[L.skinL].y, 0.02)) < 28) return 'light';
  return 'ok';
}
