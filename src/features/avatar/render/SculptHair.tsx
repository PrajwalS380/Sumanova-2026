import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { HeadShape } from '../sculpt';
import type { HairP } from '../look/hair';
import { useSculpt } from '../sculpt3d/async';

/**
 * Strand look, on the GPU: fine strands that run from the crown outwards (darker / lighter
 * fibres across the azimuth, a little variation along the length) and a glossy highlight band
 * that slides along the strands like real hair (Kajiya–Kay style, tangent = the strand
 * direction projected on the surface).
 */
const HAIR_GLSL = `
float hHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hHash(i), hHash(i + vec2(1.0, 0.0)), f.x), mix(hHash(i + vec2(0.0, 1.0)), hHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float hairStrands(vec3 p) {
  float az = atan(p.x, p.z);
  float along = length(p.xz) * 3.0 + p.y * 2.5;
  float n = hNoise(vec2(az * 38.0, along)) * 0.6 + hNoise(vec2(az * 110.0, along * 2.3)) * 0.4;
  return 0.84 + 0.26 * n;
}
vec3 hairSheen(vec3 n, vec3 viewPos, vec3 p) {
  vec3 V = -viewPos;
  vec3 up = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  vec3 T = normalize(up - n * dot(n, up) + 1e-4);
  vec3 L = normalize(vec3(0.35, 0.75, 0.55));
  vec3 H = normalize(L + V);
  float th = dot(T, H) + (hNoise(vec2(atan(p.x, p.z) * 60.0, 0.0)) - 0.5) * 0.25 - 0.12;
  float spec = pow(max(0.0, sqrt(max(0.0, 1.0 - th * th))), 70.0);
  return vec3(spec * 0.32 * max(0.0, dot(n, L) * 0.6 + 0.4));
}
`;

/**
 * Hair material: the mesh carries (shade, root→tip) per vertex; the user's root / tip colours
 * are mixed on the GPU, so recolouring never rebuilds the sculpted mesh.
 */
function useHairMaterial(root: string, tip: string | null) {
  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.48, sheen: 0.7, sheenRoughness: 0.32, clearcoat: 0.2, clearcoatRoughness: 0.4, side: THREE.FrontSide });
    const uniforms = { uRoot: { value: new THREE.Color(root) }, uTip: { value: new THREE.Color(tip ?? root) } };
    m.userData.uniforms = uniforms;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, uniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vHairPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHairPos = position;');
      sh.fragmentShader = ('uniform vec3 uRoot;\nuniform vec3 uTip;\nvarying vec3 vHairPos;\n' + HAIR_GLSL + sh.fragmentShader)
        .replace('#include <color_fragment>', '#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )\n  diffuseColor.rgb *= mix(uRoot, uTip, vColor.g) * vColor.r * hairStrands(vHairPos);\n#endif')
        .replace('#include <opaque_fragment>', 'outgoingLight += hairSheen(normal, normalize(vViewPosition), vHairPos) * mix(vec3(1.0, 0.95, 0.88), diffuseColor.rgb * 2.2 + 0.08, 0.5);\n#include <opaque_fragment>');
    };
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const u = mat.userData.uniforms as { uRoot: { value: THREE.Color }; uTip: { value: THREE.Color } };
    u.uRoot.value.set(root);
    u.uTip.value.set(tip ?? root);
    const c = new THREE.Color(root);
    const lum = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
    // dark hair keeps its depth: less sheen so black reads black, light hair gets more gloss
    mat.sheen = 0.25 + Math.min(1, lum * 1.6) * 0.6;
    mat.sheenColor.copy(c).lerp(new THREE.Color('#ffe8d0'), 0.25);
    mat.envMapIntensity = 0.35 + Math.min(1, lum * 2) * 0.6;
  }, [mat, root, tip]);
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

export function SculptHair({ h, p, color, tip, seed, hatOn }: { h: HeadShape; p: HairP; color: string; tip: string | null; seed: number; hatOn: boolean }) {
  const res = useSculpt({ k: 'hair', h, p, seed, hatOn });
  const mat = useHairMaterial(color, tip);
  if (!res) return null;
  const g = { geo: res.find((x) => x.role === 'main')?.geo, fade: res.find((x) => x.role === 'fade')?.geo, band: res.find((x) => x.role === 'band')?.geo };
  return (
    <group>
      {g.geo && <mesh geometry={g.geo} material={mat} castShadow />}
      {g.fade && (
        <mesh geometry={g.fade}>
          <meshStandardMaterial color={color} roughness={0.95} transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
      {g.band && (
        <mesh geometry={g.band}>
          <meshStandardMaterial color="#ff7a3d" roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}
