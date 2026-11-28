import { useEffect, useMemo, useRef } from 'react';
import { GROUPS, HairMotion, hairStill, registerHairMotion, type HeadPose } from './hairMotion';
import { saveData } from '@/lib/display';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { HeadShape } from '../sculpt';
import type { HairP, PaintT } from '../look/hair';
import { useSculpt } from '../sculpt3d/async';
import { useBakedHair } from './bakedHair';
import { HEADS } from '../look/face';
import { headFromParams } from '../sculptV2';
import { BAKE_HEAD_ID } from '../look/bakedHair';

let refHead: HeadShape | null = null;
const bakeHead = () => (refHead ??= headFromParams(HEADS[BAKE_HEAD_ID].p as never, 0 as never));

/**
 * Hair shading (on the GPU, so recolouring never rebuilds the groom):
 *  - colour: root → tip, plus the style's treatment (ombré, two-tone, split dye, highlights,
 *    lowlights, streaks), a little per-clump variation and occlusion between layers;
 *  - fine strands: striations across every clump (uv.x), varying along its length;
 *  - shine: two anisotropic (Kajiya–Kay) lobes along the real strand direction (`hairT`) —
 *    a white primary highlight and a coloured, sparkly secondary one — so the light runs
 *    across the hair like a band instead of sitting on it like plastic.
 * Vertex colour = (occlusion, t root→tip, clump random).
 */
const PAINT: Record<PaintT, number> = { none: 0, twotone: 1, ombre: 2, highlights: 3, streaks: 4, split: 5, lowlights: 6 };

const HAIR_HEAD = `
uniform vec3 uRoot; uniform vec3 uTip; uniform vec3 uHi; uniform float uPaint; uniform float uGloss; uniform float uBaked; uniform float uCard;
varying vec3 vHairT; varying vec3 vHairPos; varying vec2 vHUv;
float hHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hHash(i), hHash(i + vec2(1.0, 0.0)), f.x), mix(hHash(i + vec2(0.0, 1.0)), hHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float hiBand = 1.0;
float streakBand = 1.0;
vec3 hairBase(float t, float rnd, vec3 pos) {
  vec3 c = mix(uRoot, uTip, smoothstep(0.3, 1.0, t));
  if (uPaint > 0.5 && uPaint < 1.5) c = mix(uRoot, uTip, smoothstep(-0.02, -0.12, pos.y));            // two-tone: under-layer
  else if (uPaint > 1.5 && uPaint < 2.5) c = mix(uRoot, uTip, smoothstep(0.15, 0.85, t));             // ombré
  else if (uPaint > 2.5 && uPaint < 3.5) c = mix(c, uHi, step(rnd, 0.55) * hiBand * 0.7); // highlights: fine ribbons
  else if (uPaint > 3.5 && uPaint < 4.5) c = mix(c, uHi, step(rnd, 0.3) * streakBand * 0.95); // streaks: bold but fine ribbons, root to tip                             // streaks
  else if (uPaint > 4.5 && uPaint < 5.5) c = mix(uRoot, uTip, step(0.0, pos.x));                       // split dye
  else if (uPaint > 5.5) c = mix(c, uHi, step(rnd, 0.45) * hiBand * 0.6);                                      // lowlights
  return c * (0.9 + 0.2 * rnd);
}
`;

/** Uniforms shared by every hair material of one SculptHair (the motion solver writes them). */
interface MotionUniforms {
  uGrpRot: { value: Float32Array };
  uGrpTip: { value: Float32Array };
  uMotion: { value: number };
  uNeck: { value: THREE.Vector4 };
  uShoulder: { value: THREE.Vector4 };
  uBrow: { value: number };
}

/**
 * Vertex shader part of the hair motion (sumanova-us-108): every lock rotates about its own pivot by
 * its group's mid → tip rotation (more toward the tip), then is pushed out of the neck / shoulders
 * and never toward the face.
 */
const MOTION_HEAD = `
attribute vec3 hairPivot; attribute float hairGrp;
uniform vec3 uGrpRot[${GROUPS}]; uniform vec3 uGrpTip[${GROUPS}];
uniform float uMotion; uniform vec4 uNeck; uniform vec4 uShoulder; uniform float uBrow;
vec3 hRot = vec3(0.0);
vec3 rotV(vec3 v, vec3 r) {
  float a = length(r);
  if (a < 1e-5) return v;
  vec3 k = r / a;
  float c = cos(a), s = sin(a);
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}
`;
const MOTION_ROT = `
#ifdef HAIR_MOTION
if (hairGrp > -0.5 && uMotion > 0.0) {
  int gi = int(hairGrp + 0.5);
  float tt = clamp(color.g, 0.0, 1.0);
  hRot = mix(uGrpRot[gi], uGrpTip[gi], smoothstep(0.4, 1.0, tt)) * pow(tt, 1.4) * uMotion;
}
#endif
`;
const MOTION_APPLY = `
#ifdef HAIR_MOTION
if (hairGrp > -0.5 && uMotion > 0.0) {
  vec3 rest = transformed;
  transformed = hairPivot + rotV(transformed - hairPivot, hRot);
  // neck: a cylinder under the jaw (same shape as the groom's keepOffBody)
  if (transformed.y < uNeck.z && transformed.y > uNeck.w) {
    vec2 d = vec2(transformed.x, transformed.z - uNeck.x);
    float l = length(d);
    if (l < uNeck.y) { d *= uNeck.y / max(l, 1e-4); transformed.x = d.x; transformed.z = uNeck.x + d.y; }
  }
  // shoulders: an elliptic cylinder below the sloping shoulder line; drape over the side the lock is on
  float k = uShoulder.w;
  float sTop = -0.5 * k - 0.16 * k * pow(max(0.0, abs(transformed.x) - 0.14 * k) / (0.24 * k), 2.0);
  if (transformed.y < sTop && abs(transformed.x) < uShoulder.z) {
    float ex = transformed.x / uShoulder.z, ez = (transformed.z - uShoulder.x) / uShoulder.y;
    if (ex * ex + ez * ez < 1.0) transformed.z = uShoulder.x + sign(rest.z - uShoulder.x + 1e-5) * uShoulder.y * sqrt(max(0.0, 1.0 - ex * ex));
  }
  // in front of the ears and below the brows, hair may only move away from the face
  if (rest.z > 0.0 && rest.y < uBrow) transformed.z = min(transformed.z, rest.z);
}
#endif
`;

function useHairMaterial(root: string, tip: string | null, hi: string | null, paint: PaintT, gloss: number, sway: React.MutableRefObject<{ value: THREE.Vector3 }>, normalMap: THREE.Texture | null = null, card = false, motion: MotionUniforms | null = null) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0, envMapIntensity: 0.3 });
    // strand cards: fine strands cut out of thin strips (alpha test keeps them crisp, no sorting)
    if (card) { m.alphaTest = 0.45; m.side = THREE.DoubleSide; }
    const uniforms = { uRoot: { value: new THREE.Color(root) }, uTip: { value: new THREE.Color(tip ?? root) }, uHi: { value: new THREE.Color(hi ?? '#e8c9a0') }, uPaint: { value: 0 }, uGloss: { value: 0.6 }, uBaked: { value: 0 }, uCard: { value: card ? 1 : 0 }, uSway: sway.current, ...(motion ?? {}) };
    if (motion) m.defines = { ...m.defines, HAIR_MOTION: '' };
    m.userData.uniforms = uniforms;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 hairT;\nuniform vec3 uSway;\nvarying vec3 vHairT; varying vec3 vHairPos; varying vec2 vHUv;' + (motion ? MOTION_HEAD : ''))
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + (motion ? MOTION_ROT + '\n#ifdef HAIR_MOTION\nobjectNormal = rotV(objectNormal, hRot);\n#endif' : ''))
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vHairPos = position; vHUv = uv;
#ifndef HAIR_MOTION
#ifdef USE_COLOR
  // baked assets: one spring for the whole style (tips lag behind the head, roots stay put)
  transformed += uSway * pow(color.g, 1.6) * smoothstep(0.05, -0.35, position.y);
#endif
vHairT = normalize(normalMatrix * hairT);
#else
vHairT = normalize(normalMatrix * rotV(hairT, hRot));
#endif
` + (motion ? MOTION_APPLY : ''),
        );
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + HAIR_HEAD)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
#ifdef USE_COLOR
  float hT = vColor.g, hR = vColor.b;
  // highlight ribbons: 1–2 narrow stripes along a lock, not the whole lock
  // one or two thin, soft-edged ribbons per lock, fading in from the root
  hiBand = smoothstep(0.7, 0.95, sin(vHUv.x * 6.2832 * 2.0 + hR * 9.0) * 0.5 + 0.5) * smoothstep(0.05, 0.35, hT);
  // colour streaks: one narrow, crisp ribbon down the middle of a lock
  streakBand = smoothstep(0.88, 0.96, sin(vHUv.x * 6.2832 + hR * 5.0) * 0.5 + 0.5) * smoothstep(0.04, 0.2, hT);
  vec3 hc = hairBase(hT, hR, vHairPos);
  // fine strands across the clump, varying slowly along it
  float st = hNoise(vec2(vHUv.x * 9.0 + hR * 57.0, hT * 3.0 + hR * 11.0)) * 0.6 + hNoise(vec2(vHUv.x * 23.0 + hR * 13.0, hT * 7.0)) * 0.4;
  // clump separation: the top of each ribbon catches light, its edges and underside fall into shadow
  // sculpted locks: the crown of each lock catches light, deep grooves between locks
  // (roots melt into one smooth mass; the locks separate toward their tips)
  float side = mix(1.0, 0.7 + 0.3 * smoothstep(-0.35, 0.75, sin(vHUv.x * 6.2832)), mix(0.25, 1.0, smoothstep(0.15, 0.7, vColor.g)));
  // baked sculpts carry their grooves in the normal map and occlusion in vColor.r
  if (uBaked > 0.5) { side = 1.0; st = 0.6; }
  // each lock its own very slightly different tint (no two locks the same flat colour)
  hc *= mix(vec3(1.03, 0.99, 0.95), vec3(0.96, 0.99, 1.04), hR) * (0.95 + 0.1 * hHash(vec2(hR * 91.0, 3.1)));
  // roots sit in the shade of the hair above them
  float rootShade = mix(0.72, 1.0, smoothstep(0.0, 0.22, hT));
  // fine strand striations, strong enough to read in a small thumbnail
  float fine = hNoise(vec2(vHUv.x * 38.0 + hR * 17.0, hT * 2.0)) * 0.55 + hNoise(vec2(vHUv.x * 85.0 + hR * 5.0, hT * 4.0 + hR)) * 0.45;
  diffuseColor.rgb = hc * vColor.r * side * rootShade * (0.8 + 0.18 * st + 0.22 * fine);
  if (uCard > 0.5) {
    // strand cards: 5–7 thin tapered strands across the strip, fading in from the root and thinning at the tip
    float across = vHUv.x * (3.0 + floor(hR * 2.0));
    float k = fract(across + hHash(vec2(floor(across), hR * 31.0)) * 0.25);
    float wid = 0.42 * (1.0 - 0.7 * smoothstep(0.55, 1.05, hT)) * (0.75 + 0.5 * hHash(vec2(floor(across), hR * 7.0)));
    float strand = 1.0 - smoothstep(wid * 0.45, wid, abs(k - 0.5));
    float len = 1.0 - smoothstep(0.98 - 0.12 * hHash(vec2(floor(across), hR * 13.0)), 1.06, hT);
    diffuseColor.a = strand * len * smoothstep(0.02, 0.12, hT) * smoothstep(0.0, 0.12, vHUv.x) * smoothstep(1.0, 0.88, vHUv.x);
    // a strand lying on top of the lock catches a little more light than the lock under it
    diffuseColor.rgb = hc * rootShade * (1.04 + 0.12 * fine);
  }
#endif`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
#ifdef USE_COLOR
if (uBaked < 0.5) {
  // sculpted grooves running along every lock: the shading normal tilts across the lock in
  // bundles (3 per lock) plus a fine comb texture, so light catches each groove like a sculpt
  vec3 Tg = normalize(vHairT);
  vec3 Bg = normalize(cross(Tg, normal));
  float ang = vHUv.x * 6.2832;
  float across = cos(ang);
  float topSide = smoothstep(-0.2, 0.45, sin(ang));
  float ph = across * 3.14159 * 3.0 + vColor.b * 7.0;
  float slope = sin(ph) * 0.42 + sin(across * 26.0 + vColor.b * 13.0 + vColor.g * 4.0) * 0.14;
  float k = topSide * mix(0.3, 1.0, smoothstep(0.05, 0.5, vColor.g));
  normal = normalize(normal + Bg * slope * k);
}
#endif`,
        )
        .replace(
          '#include <opaque_fragment>',
          `#ifdef USE_COLOR
{
  vec3 Nn = normalize(normal);
  vec3 Vv = normalize(vViewPosition);
  vec3 Ll = normalize(vec3(0.35, 0.75, 0.6));
  vec3 Hh = normalize(Ll + Vv);
  vec3 Tt = normalize(vHairT);
  float jitter = hNoise(vec2(vHUv.x * 17.0 + vColor.b * 40.0, vColor.g * 5.0)) - 0.5;
  vec3 T1 = normalize(Tt + Nn * (-0.08 + jitter * 0.25));
  vec3 T2 = normalize(Tt + Nn * (0.18 + jitter * 0.35));
  float th1 = dot(T1, Hh), th2 = dot(T2, Hh);
  float s1 = pow(sqrt(max(0.0, 1.0 - th1 * th1)), 90.0);
  float s2 = pow(sqrt(max(0.0, 1.0 - th2 * th2)), 22.0) * smoothstep(0.35, 0.75, hNoise(vec2(vHUv.x * 31.0, vColor.g * 19.0 + vColor.b * 7.0)));
  // thin tips seen edge-on would flare: the shine fades out over the last part of a lock
  float lit = clamp(dot(Nn, Ll) * 0.5 + 0.55, 0.0, 1.0) * vColor.r * (1.0 - 0.75 * smoothstep(0.7, 1.0, vColor.g));
  vec3 base = hairBase(vColor.g, vColor.b, vHairPos);
  outgoingLight += (s1 * mix(vec3(1.0, 0.96, 0.9), base * 2.0 + 0.1, 0.45) * 0.2 + s2 * (base * 1.6 + 0.04) * 0.3) * uGloss * lit;
}
#endif
#include <opaque_fragment>`,
        );
    };
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, motion]);
  useEffect(() => {
    const u = mat.userData.uniforms as { uRoot: { value: THREE.Color }; uTip: { value: THREE.Color }; uHi: { value: THREE.Color }; uPaint: { value: number }; uGloss: { value: number } };
    u.uRoot.value.set(root);
    u.uTip.value.set(tip ?? (paint === 'ombre' || paint === 'twotone' || paint === 'split' ? shift(root, 0.35) : root));
    u.uHi.value.set(hi ?? (paint === 'lowlights' ? shift(root, -0.4) : shift(root, 0.55)));
    u.uPaint.value = PAINT[paint];
    const c = new THREE.Color(root);
    const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
    // very dark hair needs a stronger highlight to read as glossy instead of a black blob
    u.uGloss.value = gloss * (lum < 0.12 ? 1.35 : 1);
  }, [mat, root, tip, hi, paint, gloss]);
  useEffect(() => {
    mat.normalMap = normalMap;
    (mat.userData.uniforms as { uBaked: { value: number } }).uBaked.value = normalMap ? 1 : 0;
    mat.needsUpdate = true;
  }, [mat, normalMap]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

/**
 * Clipper stubble for fades, undercuts and buzz cuts: fine dots of hair colour whose density
 * follows the fade (vertex colour .r), so the hair melts into skin instead of ending in a line.
 */
function useStubbleMaterial(color: string) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, transparent: true, depthWrite: false });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSPos;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSPos = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSPos;\nfloat sHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }')
        .replace(
          '#include <color_fragment>',
          `float dens = vColor.r;
vec3 cell = floor(vSPos * 260.0);
float dots = step(1.0 - dens * 0.85, sHash(cell));
diffuseColor.rgb = diffuse;
diffuseColor.a = clamp(dens * 0.55 + dots * 0.4 * dens, 0.0, 0.92);`,
        );
    };
    return m;
  }, []);
  useEffect(() => { mat.color.set(color); }, [mat, color]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

/** lighten (k > 0) or darken (k < 0) a colour toward a warm tone */
function shift(hex: string, k: number) {
  const c = new THREE.Color(hex);
  return '#' + (k > 0 ? c.lerp(new THREE.Color('#f3d7a6'), k) : c.multiplyScalar(1 + k)).getHexString();
}

export function SculptHair({ h, p, color, tip, hi = null, gloss = 0.6, seed, hatOn, animate = true, bakedId = null }: { h: HeadShape; p: HairP; color: string; tip: string | null; hi?: string | null; gloss?: number; seed: number; hatOn: boolean; animate?: boolean; /** finished offline-sculpted asset for this style (see render/bakedHair) */ bakedId?: number | null }) {
  const res = useSculpt({ k: 'hair', h, p, seed, hatOn });
  const baked = useBakedHair(bakedId);
  const sway = useRef({ value: new THREE.Vector3() });
  // per-lock secondary motion (sumanova-us-108): one solver per hairstyle, written into shared uniforms
  const solver = useMemo(() => new HairMotion(), []);
  const mu = useMemo<MotionUniforms>(() => ({
    uGrpRot: { value: solver.mid },
    uGrpTip: { value: solver.tip },
    uMotion: { value: 0 },
    uNeck: { value: new THREE.Vector4() },
    uShoulder: { value: new THREE.Vector4() },
    uBrow: { value: 0 },
  }), [solver]);
  useEffect(() => {
    const off = registerHairMotion(mu.uMotion);
    return () => void off();
  }, [mu]);
  // body shapes the hair keeps out of (head-local, same as the groom's keepOffBody)
  useEffect(() => {
    const k = h.rx / 0.35, R = h.rx;
    mu.uNeck.value.set(-0.03 * k, 0.15 * k + 0.01 * R, -h.ry * 0.55, -0.62 * k);
    mu.uShoulder.value.set(-0.02 * k, 0.19 * k + 0.01 * R, 0.42 * k + 0.01 * R, k);
    mu.uBrow.value = 0.075 * (h.ry / 0.39);
  }, [h, mu]);
  // how much each group can swing: crops stay still, long hair swings, tails and plaits always do
  useEffect(() => {
    const longest = Math.max(p.top, p.side, p.back);
    const loose = Math.min(1, Math.max(0, (longest - 0.45) / 1.0));
    for (let k = 0; k < GROUPS; k++) solver.weights[k] = k <= 4 ? loose : 1;
    solver.weights[0] = Math.max(loose, p.fringe !== 'none' ? Math.min(1, Math.max(0, (p.fringeLen - 0.3) / 0.6)) : 0);
  }, [p, solver]);
  const mat = useHairMaterial(color, tip, hi, p.paint, gloss, sway, null, false, mu);
  const baseMat = useHairMaterial(color, tip, hi, p.paint, gloss, sway);
  const bakedMat = useHairMaterial(color, tip, hi, p.paint, gloss, sway, baked?.normalMap ?? null);
  const cardMat = useHairMaterial(color, tip, hi, p.paint, gloss, sway, null, true, mu);
  // the asset was sculpted on the reference head: fit it to this head's proportions
  const fit = useMemo(() => {
    const r = bakeHead();
    return [h.rx / r.rx, h.ry / r.ry, h.rz / r.rz] as [number, number, number];
  }, [h]);
  const stubble = useStubbleMaterial(color);
  const group = useRef<THREE.Group>(null);
  const spring = useRef({ prev: null as THREE.Vector3 | null, vel: new THREE.Vector3(), off: new THREE.Vector3() });
  // how much this style can swing: long hair and tails, not crops (baked assets' single spring)
  const swing = Math.min(1, Math.max(0, Math.max(p.side, p.back, p.tie !== 'none' || p.braid !== 'none' ? p.tail : 0) - 0.5) / 1.2);
  // scratch objects (no per-frame allocations)
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), w: new THREE.Vector3(), pose: { px: 0, py: 0, pz: 0, qx: 0, qy: 0, qz: 0, qw: 1, radius: 1 } as HeadPose }), []);
  // reduce motion (Settings or the OS) stops the hair at once
  const reduced = useRef(false);
  useEffect(() => {
    const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    const upd = () => (reduced.current = !!mq?.matches || document.documentElement.classList.contains('reduce-motion'));
    upd();
    mq?.addEventListener?.('change', upd);
    const mo = new MutationObserver(upd);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    solver.breeze = !saveData();
    return () => {
      mq?.removeEventListener?.('change', upd);
      mo.disconnect();
    };
  }, [solver]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (!animate || reduced.current || document.hidden || hairStill()) {
      if (mu.uMotion.value !== 0 || !animate) {
        mu.uMotion.value = 0;
        solver.reset();
      }
      return;
    }
    g.getWorldPosition(tmp.v);
    g.getWorldQuaternion(tmp.q);
    g.getWorldScale(tmp.s);
    const P = tmp.pose;
    P.px = tmp.v.x; P.py = tmp.v.y; P.pz = tmp.v.z;
    P.qx = tmp.q.x; P.qy = tmp.q.y; P.qz = tmp.q.z; P.qw = tmp.q.w;
    P.radius = h.rx * tmp.s.y;
    solver.step(dt, P);
    mu.uMotion.value = 1;
    // baked assets (no per-lock data) keep the single spring
    if (!baked || swing <= 0) return;
    const s = spring.current;
    if (!s.prev) s.prev = tmp.v.clone();
    const dtc = Math.min(0.05, Math.max(1e-3, dt));
    tmp.w.copy(tmp.v).sub(s.prev).divideScalar(dtc);
    s.prev.copy(tmp.v);
    tmp.w.applyQuaternion(tmp.q.invert());
    tmp.w.multiplyScalar(-0.045 * swing).clampLength(0, 0.09).sub(s.off);
    s.vel.addScaledVector(tmp.w, 60 * dtc).multiplyScalar(Math.exp(-9 * dtc));
    s.off.addScaledVector(s.vel, dtc);
    sway.current.value.copy(s.off);
  });

  if (!res) return null;
  const g = { cards: res.find((x) => x.role === 'cards')?.geo, geo: res.find((x) => x.role === 'main')?.geo, base: res.find((x) => x.role === 'base')?.geo, fade: res.find((x) => x.role === 'fade')?.geo, band: res.find((x) => x.role === 'band')?.geo };
  return (
    <group ref={group}>
      {baked ? (
        <mesh geometry={baked.geo} material={bakedMat} scale={fit} castShadow />
      ) : (
        <>
          {g.base && <mesh geometry={g.base} material={baseMat} />}
          {g.geo && <mesh geometry={g.geo} material={mat} castShadow />}
          {g.cards && <mesh geometry={g.cards} material={cardMat} />}
        </>
      )}
      {g.fade && <mesh geometry={g.fade} material={stubble} />}
      {g.band && (
        <mesh geometry={g.band}>
          <meshStandardMaterial color="#ff6f61" roughness={0.55} />
        </mesh>
      )}
    </group>
  );
}
