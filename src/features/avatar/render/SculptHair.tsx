import { useEffect, useMemo, useRef } from 'react';
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
uniform vec3 uRoot; uniform vec3 uTip; uniform vec3 uHi; uniform float uPaint; uniform float uGloss; uniform float uBaked;
varying vec3 vHairT; varying vec3 vHairPos; varying vec2 vHUv;
float hHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hHash(i), hHash(i + vec2(1.0, 0.0)), f.x), mix(hHash(i + vec2(0.0, 1.0)), hHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float hiBand = 1.0;
vec3 hairBase(float t, float rnd, vec3 pos) {
  vec3 c = mix(uRoot, uTip, smoothstep(0.3, 1.0, t));
  if (uPaint > 0.5 && uPaint < 1.5) c = mix(uRoot, uTip, smoothstep(-0.02, -0.12, pos.y));            // two-tone: under-layer
  else if (uPaint > 1.5 && uPaint < 2.5) c = mix(uRoot, uTip, smoothstep(0.15, 0.85, t));             // ombré
  else if (uPaint > 2.5 && uPaint < 3.5) c = mix(c, uHi, step(rnd, 0.55) * hiBand * 0.7); // highlights: fine ribbons
  else if (uPaint > 3.5 && uPaint < 4.5) c = mix(c, uHi, step(rnd, 0.14) * (0.55 + 0.45 * hiBand));                             // streaks
  else if (uPaint > 4.5 && uPaint < 5.5) c = mix(uRoot, uTip, step(0.0, pos.x));                       // split dye
  else if (uPaint > 5.5) c = mix(c, uHi, step(rnd, 0.45) * hiBand * 0.6);                                      // lowlights
  return c * (0.9 + 0.2 * rnd);
}
`;

function useHairMaterial(root: string, tip: string | null, hi: string | null, paint: PaintT, gloss: number, sway: React.MutableRefObject<{ value: THREE.Vector3 }>, normalMap: THREE.Texture | null = null) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, envMapIntensity: 0.55 });
    const uniforms = { uRoot: { value: new THREE.Color(root) }, uTip: { value: new THREE.Color(tip ?? root) }, uHi: { value: new THREE.Color(hi ?? '#e8c9a0') }, uPaint: { value: 0 }, uGloss: { value: 0.6 }, uBaked: { value: 0 }, uSway: sway.current };
    m.userData.uniforms = uniforms;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 hairT;\nuniform vec3 uSway;\nvarying vec3 vHairT; varying vec3 vHairPos; varying vec2 vHUv;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vHairPos = position; vHUv = uv;
#ifdef USE_COLOR
  // secondary motion: tips lag behind the head (long hair, tails), roots stay put
  transformed += uSway * pow(color.g, 1.6) * smoothstep(0.05, -0.35, position.y);
#endif
vHairT = normalize(normalMatrix * hairT);`,
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
  vec3 hc = hairBase(hT, hR, vHairPos);
  // fine strands across the clump, varying slowly along it
  float st = hNoise(vec2(vHUv.x * 9.0 + hR * 57.0, hT * 3.0 + hR * 11.0)) * 0.6 + hNoise(vec2(vHUv.x * 23.0 + hR * 13.0, hT * 7.0)) * 0.4;
  // clump separation: the top of each ribbon catches light, its edges and underside fall into shadow
  // sculpted locks: the crown of each lock catches light, deep grooves between locks
  // (roots melt into one smooth mass; the locks separate toward their tips)
  float side = mix(1.0, 0.5 + 0.5 * smoothstep(-0.35, 0.75, sin(vHUv.x * 6.2832)), mix(0.35, 1.0, smoothstep(0.1, 0.6, vColor.g)));
  // baked sculpts carry their grooves in the normal map and occlusion in vColor.r
  if (uBaked > 0.5) { side = 1.0; st = 0.6; }
  diffuseColor.rgb = hc * vColor.r * side * (0.9 + 0.14 * st);
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
  float slope = sin(ph) * 0.6 + sin(across * 26.0 + vColor.b * 13.0 + vColor.g * 4.0) * 0.14;
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
  }, []);
  useEffect(() => {
    const u = mat.userData.uniforms as { uRoot: { value: THREE.Color }; uTip: { value: THREE.Color }; uHi: { value: THREE.Color }; uPaint: { value: number }; uGloss: { value: number } };
    u.uRoot.value.set(root);
    u.uTip.value.set(tip ?? (paint === 'none' ? root : shift(root, 0.35)));
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
  const mat = useHairMaterial(color, tip, hi, p.paint, gloss, sway);
  const bakedMat = useHairMaterial(color, tip, hi, p.paint, gloss, sway, baked?.normalMap ?? null);
  // the asset was sculpted on the reference head: fit it to this head's proportions
  const fit = useMemo(() => {
    const r = bakeHead();
    return [h.rx / r.rx, h.ry / r.ry, h.rz / r.rz] as [number, number, number];
  }, [h]);
  const stubble = useStubbleMaterial(color);
  const group = useRef<THREE.Group>(null);
  const spring = useRef({ prev: null as THREE.Vector3 | null, vel: new THREE.Vector3(), off: new THREE.Vector3() });
  // how much this style can swing: long hair and tails, not crops
  const swing = Math.min(1, Math.max(0, Math.max(p.side, p.back, p.tie !== 'none' || p.braid !== 'none' ? p.tail : 0) - 0.5) / 1.2);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g || !animate || swing <= 0) return;
    const s = spring.current;
    const w = g.getWorldPosition(new THREE.Vector3());
    if (!s.prev) s.prev = w.clone();
    const dtc = Math.min(0.05, Math.max(1e-3, dt));
    // head motion in the head's own frame → the hair lags behind it (a damped spring)
    const v = w.clone().sub(s.prev).divideScalar(dtc);
    s.prev.copy(w);
    const q = g.getWorldQuaternion(new THREE.Quaternion()).invert();
    v.applyQuaternion(q);
    const target = v.multiplyScalar(-0.045 * swing).clampLength(0, 0.09);
    s.vel.addScaledVector(target.sub(s.off), 60 * dtc).multiplyScalar(Math.exp(-9 * dtc));
    s.off.addScaledVector(s.vel, dtc);
    sway.current.value.copy(s.off);
  });

  if (!res) return null;
  const g = { geo: res.find((x) => x.role === 'main')?.geo, base: res.find((x) => x.role === 'base')?.geo, fade: res.find((x) => x.role === 'fade')?.geo, band: res.find((x) => x.role === 'band')?.geo };
  return (
    <group ref={group}>
      {baked ? (
        <mesh geometry={baked.geo} material={bakedMat} scale={fit} castShadow />
      ) : (
        <>
          {g.base && <mesh geometry={g.base} material={mat} />}
          {g.geo && <mesh geometry={g.geo} material={mat} castShadow />}
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
