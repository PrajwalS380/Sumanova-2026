import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { HeadShape } from '../sculpt';
import type { HairP } from '../look/hair';
import { useSculpt } from '../sculpt3d/async';

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
      sh.fragmentShader = 'uniform vec3 uRoot;\nuniform vec3 uTip;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )\n  diffuseColor.rgb *= mix(uRoot, uTip, vColor.g) * vColor.r;\n#endif');
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
