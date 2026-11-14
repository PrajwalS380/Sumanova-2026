import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shade, skinWithUndertone, type AvatarConfig } from './config';
import { AvatarHead, SkinMat } from './AvatarHead';
import { lathe, mix } from './sculpt';

/**
 * SUMANOVA's original sculpted 3D character (no external models or assets).
 * Feet at y = 0, head centre at y ≈ 1.98. Stylised "designer figure"
 * proportions: a large expressive head on a slim, smoothly lathed body.
 */

function Cloth({ color, rough = 0.78, side }: { color: string; rough?: number; side?: THREE.Side }) {
  return <meshPhysicalMaterial color={color} roughness={rough} sheen={1} sheenRoughness={0.7} sheenColor={mix(color, '#ffffff', 0.25)} side={side} />;
}

function Limb({ r, len, color, skin, ...p }: { r: number; len: number; color: string; skin?: boolean } & JSX.IntrinsicElements['mesh']) {
  return (
    <mesh castShadow {...p}>
      <capsuleGeometry args={[r, len, 8, 20]} />
      {skin ? <SkinMat color={color} /> : <Cloth color={color} />}
    </mesh>
  );
}

const HEAD_Y = 1.98;

export const AvatarFigure = memo(function AvatarFigure({ config: c, animate = true, poseOverride, mirror = false }: { config: AvatarConfig; animate?: boolean; poseOverride?: AvatarConfig['pose']; mirror?: boolean }) {
  const pose = poseOverride ?? c.pose;
  const skin = skinWithUndertone(c.skin, c.undertone);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);

  const b = { slim: 0.88, average: 1, athletic: 1.08, broad: 1.18 }[c.body.build];
  const H = c.body.height;
  const o = c.outfit;
  const top = o.topColor;
  const bottom = o.bottom === 'skirt' && o.top === 'saree' ? top : o.bottomColor;
  const longSleeve = ['shirt', 'hoodie', 'jacket', 'kurta', 'blazer'].includes(o.top);
  const seated = pose === 'sitting';
  const skirtLike = o.bottom === 'skirt' || o.bottom === 'dhoti' || o.top === 'saree';

  const base = useMemo(() => {
    const v = { armL: 0.09, armR: -0.09, foreL: 0.05, foreR: -0.05, armLx: -0.06, armRx: -0.06, foreLx: -0.22, foreRx: -0.22, legL: 0, legR: 0, knee: 0 };
    if (pose === 'waving') Object.assign(v, { armR: -2.5, foreR: -0.55, foreRx: 0 });
    if (pose === 'celebrating') Object.assign(v, { armL: 2.6, armR: -2.6, foreL: 0.2, foreR: -0.2, foreLx: 0, foreRx: 0 });
    if (pose === 'thumbsup') Object.assign(v, { armR: -0.2, armRx: -0.5, foreRx: -1.35, foreR: 0 });
    if (pose === 'sitting') Object.assign(v, { legL: -1.45, legR: -1.45, knee: 1.45, armL: 0.18, armR: -0.18, armLx: -0.35, armRx: -0.35, foreLx: -0.5, foreRx: -0.5 });
    if (c.body.posture === 'proud' && pose === 'standing') Object.assign(v, { armL: 0.18, armR: -0.18, foreL: 0.3, foreR: -0.3 });
    return v;
  }, [pose, c.body.posture]);

  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.getElapsedTime();
    const s = (f: number, a: number, ph = 0) => Math.sin(t * f + ph) * a;
    const swing = pose === 'walking' ? s(4, 0.45) : pose === 'dancing' ? s(5, 0.55) : 0;
    if (body.current) {
      body.current.position.y = (pose === 'dancing' ? Math.abs(s(5, 0.05)) : s(1.5, 0.006)) + (seated ? -0.4 : 0);
      body.current.rotation.z = pose === 'dancing' ? s(2.5, 0.07) : 0;
      body.current.rotation.y = pose === 'dancing' ? s(1.25, 0.25) : 0;
      body.current.scale.y = 1 + s(1.5, 0.004); // breathing
    }
    if (head.current) {
      head.current.rotation.y = pose === 'standing' || pose === 'sitting' ? s(0.45, 0.16) + s(0.23, 0.08) : pose === 'waving' ? 0.12 : 0;
      head.current.rotation.z = pose === 'dancing' ? s(2.5, -0.1) : s(0.6, 0.035);
      head.current.rotation.x = c.expression === 'sad' || c.expression === 'crying' ? 0.14 : c.expression === 'sleeping' ? 0.2 : s(0.5, 0.025) - 0.02;
    }
    if (armL.current) {
      armL.current.rotation.z = -(base.armL + (pose === 'celebrating' ? s(6, 0.15) : pose === 'dancing' ? 0.9 + s(5, 0.4) : s(1.5, 0.015)));
      armL.current.rotation.x = base.armLx + (pose === 'walking' ? swing : 0);
    }
    if (armR.current) {
      armR.current.rotation.z = -(base.armR + (pose === 'waving' ? s(6, 0.22) : pose === 'celebrating' ? s(6, -0.15, 1) : pose === 'dancing' ? -0.9 + s(5, 0.4, Math.PI) : s(1.5, -0.015)));
      armR.current.rotation.x = base.armRx + (pose === 'walking' ? -swing : 0);
    }
    if (foreR.current) {
      foreR.current.rotation.z = -(base.foreR + (pose === 'waving' ? s(6, 0.35, 1) : 0));
      foreR.current.rotation.x = base.foreRx;
    }
    if (foreL.current) {
      foreL.current.rotation.z = -(base.foreL);
      foreL.current.rotation.x = base.foreLx;
    }
    if (legL.current) legL.current.rotation.x = base.legL + (pose === 'walking' ? -swing * 0.8 : pose === 'dancing' ? s(5, 0.15) : 0);
    if (legR.current) legR.current.rotation.x = base.legR + (pose === 'walking' ? swing * 0.8 : pose === 'dancing' ? s(5, -0.15) : 0);
    const kneeWalk = pose === 'walking' ? Math.max(0, s(4, 0.5)) : 0;
    if (kneeL.current) kneeL.current.rotation.x = base.knee + kneeWalk;
    if (kneeR.current) kneeR.current.rotation.x = base.knee + (pose === 'walking' ? Math.max(0, s(4, -0.5)) : 0);
    if (root.current) root.current.position.y = pose === 'walking' ? Math.abs(s(8, 0.025)) : 0;
  });

  // Torso silhouette (radius, y) bottom → top. Elliptical via z-scale.
  const torsoGeo = useMemo(() => {
    const long = o.top === 'kurta';
    const pts: [number, number][] = long
      ? [[0.3, 0.5], [0.285, 0.7], [0.262, 0.92], [0.236, 1.12], [0.248, 1.3], [0.27, 1.44], [0.262, 1.53], [0.21, 1.6], [0.13, 1.645], [0.0, 1.655]]
      : [[0.0, 0.955], [0.262, 0.96], [0.266, 1.0], [0.236, 1.12], [0.248, 1.3], [0.27, 1.44], [0.262, 1.53], [0.21, 1.6], [0.13, 1.645], [0.0, 1.655]];
    return lathe(pts, 48);
  }, [o.top]);
  const hipsGeo = useMemo(() => lathe([[0.0, 0.8], [0.17, 0.81], [0.232, 0.88], [0.248, 0.96], [0.24, 1.04], [0.0, 1.05]], 40), []);
  const skirtGeo = useMemo(() => {
    if (!skirtLike) return null;
    const folds = (g: THREE.LatheGeometry, n: number, amp: number) => {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const r = Math.hypot(x, z);
        if (r < 1e-4) continue;
        const k = 1 + amp * Math.sin(Math.atan2(x, z) * n) * Math.max(0, 1 - y);
        p.setXYZ(i, x * k, y, z * k);
      }
      g.computeVertexNormals();
      return g;
    };
    if (o.top === 'saree') return folds(lathe([[0.3, 0.06], [0.29, 0.3], [0.27, 0.6], [0.25, 0.85], [0.245, 1.0], [0.0, 1.02]], 96), 22, 0.03);
    if (o.bottom === 'skirt') return folds(lathe([[0.37, 0.48], [0.33, 0.62], [0.28, 0.82], [0.25, 0.97], [0.0, 1.0]], 96), 14, 0.06);
    if (o.bottom === 'dhoti') return lathe([[0.25, 0.22], [0.27, 0.4], [0.27, 0.65], [0.255, 0.9], [0.245, 1.0], [0.0, 1.02]], 40);
    return lathe([[0.37, 0.48], [0.33, 0.62], [0.28, 0.82], [0.25, 0.97], [0.0, 1.0]], 48);
  }, [skirtLike, o.top, o.bottom]);
  const innerGeo = useMemo(() => (o.top === 'jacket' || o.top === 'blazer' ? lathe([[0.24, 1.0], [0.24, 1.12], [0.252, 1.3], [0.274, 1.44], [0.266, 1.53], [0.214, 1.6], [0.13, 1.648]], 20, -0.36, 0.72) : null), [o.top]);
  const lapels = useMemo(() => {
    if (o.top !== 'jacket' && o.top !== 'blazer') return null;
    return [-1, 1].map((s) => {
      const curve = new THREE.CatmullRomCurve3([[s * 0.05, 1.63, 0.1], [s * 0.1, 1.5, 0.165], [s * 0.088, 1.3, 0.17], [s * 0.084, 1.0, 0.162]].map((p) => new THREE.Vector3(...p)));
      return new THREE.TubeGeometry(curve, 24, 0.016, 6, false);
    });
  }, [o.top]);
  const sash = useMemo(() => {
    if (o.top !== 'saree') return null;
    const curve = new THREE.CatmullRomCurve3([[0.2, 0.95, 0.17], [0.06, 1.2, 0.19], [-0.12, 1.46, 0.15], [-0.24, 1.6, 0.0], [-0.2, 1.42, -0.18], [-0.1, 1.0, -0.2], [-0.04, 0.7, -0.24]].map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, 48, 0.06, 10, false);
    g.scale(1, 1, 1);
    return g;
  }, [o.top]);
  const strap = useMemo(() => {
    if (!c.accessories.bag) return null;
    const curve = new THREE.CatmullRomCurve3([[0.2, 1.56, 0.08], [0.0, 1.32, 0.19], [-0.24, 1.0, 0.16], [-0.3, 0.95, 0.0]].map((p) => new THREE.Vector3(...p)));
    return new THREE.TubeGeometry(curve, 32, 0.012, 6, false);
  }, [c.accessories.bag]);

  const shirtDark = shade(top, -0.07);

  return (
    <group ref={root} scale={[mirror ? -H : H, H, H]}>
      {seated && (
        <mesh position={[0, 0.28, -0.06]} receiveShadow castShadow>
          <cylinderGeometry args={[0.36, 0.32, 0.56, 40]} />
          <meshPhysicalMaterial color="#2a211c" roughness={0.6} sheen={1} sheenColor="#5a4636" />
        </mesh>
      )}
      <group ref={body}>
        {/* Legs: hip → knee → ankle */}
        {[-1, 1].map((side) => {
          const shorts = o.bottom === 'shorts';
          const legCol = skirtLike ? skin : bottom;
          return (
            <group key={side} ref={side < 0 ? legL : legR} position={[side * 0.115 * b, 0.88, 0]}>
              <Limb r={0.098 * Math.min(b, 1.1)} len={0.26} color={legCol} skin={skirtLike} position={[0, -0.19, 0]} />
              {shorts && (
                <mesh position={[0, -0.27, 0]}>
                  <cylinderGeometry args={[0.112, 0.118, 0.1, 24, 1, true]} />
                  <Cloth color={shade(bottom, -0.05)} side={THREE.DoubleSide} />
                </mesh>
              )}
              <group ref={side < 0 ? kneeL : kneeR} position={[0, -0.4, 0]}>
                <Limb r={0.082} len={0.3} color={shorts || skirtLike ? skin : bottom} skin={shorts || skirtLike} position={[0, -0.2, 0]} />
                {!shorts && !skirtLike && o.bottom === 'jeans' && (
                  <mesh position={[0, -0.36, 0]}>
                    <cylinderGeometry args={[0.092, 0.092, 0.04, 24]} />
                    <Cloth color={shade(bottom, 0.06)} />
                  </mesh>
                )}
                <Shoe kind={o.shoes} color={o.shoeColor} skin={skin} />
              </group>
            </group>
          );
        })}

        {/* Pants / hips */}
        <mesh geometry={hipsGeo} scale={[b, 1, 0.7]} castShadow>
          <Cloth color={skirtLike ? (o.top === 'saree' ? top : bottom) : bottom} />
        </mesh>
        {skirtGeo && (
          <mesh geometry={skirtGeo} scale={[b, 1, 0.78]} castShadow>
            <Cloth color={o.top === 'saree' ? top : bottom} side={THREE.DoubleSide} />
          </mesh>
        )}

        {/* Torso / top */}
        <mesh geometry={torsoGeo} scale={[b, 1, 0.66]} castShadow>
          <Cloth color={top} rough={o.top === 'blazer' ? 0.55 : 0.8} side={o.top === 'kurta' ? THREE.DoubleSide : undefined} />
        </mesh>
        {innerGeo && (
          <mesh geometry={innerGeo} scale={[b * 1.012, 1, 0.672]}>
            <Cloth color={o.top === 'blazer' ? '#f4ede4' : '#231c18'} />
          </mesh>
        )}
        {lapels?.map((g, i) => (
          <mesh key={i} geometry={g} scale={[b, 1, 1]}>
            <Cloth color={shade(top, -0.12)} />
          </mesh>
        ))}
        {o.top === 'blazer' && (
          <mesh position={[0, 1.36, 0.19]} rotation={[-0.1, 0, 0]} scale={[1, 1, 0.4]}>
            <capsuleGeometry args={[0.022, 0.2, 4, 10]} />
            <meshStandardMaterial color="#8a2a2a" roughness={0.45} />
          </mesh>
        )}
        {o.top === 'hoodie' && (
          <>
            <mesh position={[0, 1.6, -0.07]} rotation={[1.1, 0, 0]} scale={[b, 1, 0.9]}>
              <torusGeometry args={[0.15, 0.06, 14, 36]} />
              <Cloth color={shirtDark} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.045, 1.46, 0.172]} rotation={[0.1, 0, 0]}>
                <capsuleGeometry args={[0.006, 0.12, 3, 6]} />
                <meshStandardMaterial color="#f4ede4" roughness={0.6} />
              </mesh>
            ))}
            <mesh position={[0, 1.08, 0.152]} rotation={[0, 0, Math.PI / 2]} scale={[0.55, b, 0.1]}>
              <capsuleGeometry args={[0.1, 0.18, 6, 16]} />
              <Cloth color={shirtDark} />
            </mesh>
          </>
        )}
        {(o.top === 'tshirt' || o.top === 'saree') && (
          <mesh position={[0, 1.635, 0.02]} rotation={[Math.PI / 2 + 0.25, 0, 0]} scale={[b, 0.75, 1]}>
            <torusGeometry args={[0.105, 0.014, 8, 32]} />
            <Cloth color={shirtDark} />
          </mesh>
        )}
        {o.top === 'shirt' && (
          <>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.06, 1.615, 0.1]} rotation={[0.5, s * 0.5, s * 0.9]} scale={[1, 1, 0.25]}>
                <coneGeometry args={[0.055, 0.1, 3]} />
                <Cloth color={mix(top, '#ffffff', 0.1)} />
              </mesh>
            ))}
            {[0, 1, 2, 3].map((i) => (
              <mesh key={i} position={[0, 1.5 - i * 0.12, 0.18 - (i === 3 ? 0.01 : 0)]}>
                <sphereGeometry args={[0.009, 8, 6]} />
                <meshStandardMaterial color="#f4ede4" />
              </mesh>
            ))}
          </>
        )}
        {o.top === 'kurta' && (
          <>
            <mesh position={[0, 1.635, 0.02]} rotation={[Math.PI / 2 + 0.25, 0, 0]} scale={[b, 0.75, 1]}>
              <torusGeometry args={[0.105, 0.016, 8, 32]} />
              <meshStandardMaterial color="#e9c46a" metalness={0.6} roughness={0.35} />
            </mesh>
            <mesh position={[0, 1.47, 0.178]} rotation={[-0.06, 0, 0]}>
              <boxGeometry args={[0.022, 0.28, 0.01]} />
              <meshStandardMaterial color="#e9c46a" metalness={0.6} roughness={0.35} />
            </mesh>
          </>
        )}
        {sash && (
          <mesh geometry={sash} scale={[b, 1, 1]} castShadow>
            <Cloth color={shade(top, -0.12)} />
          </mesh>
        )}
        {strap && (
          <>
            <mesh geometry={strap}>
              <meshStandardMaterial color="#3a2a1f" roughness={0.5} />
            </mesh>
            <mesh position={[-0.31 * b, 0.9, 0.06]} castShadow>
              <boxGeometry args={[0.2, 0.15, 0.08]} />
              <meshPhysicalMaterial color="#8a5532" roughness={0.45} clearcoat={0.4} />
            </mesh>
          </>
        )}

        {/* Arms: shoulder → elbow → wrist */}
        {[-1, 1].map((side) => (
          <group key={side} ref={side < 0 ? armL : armR} position={[side * (0.255 * b + 0.035), 1.53, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.088 * Math.min(b, 1.1), 24, 18]} />
              <Cloth color={top} />
            </mesh>
            <Limb r={0.072 * Math.min(b, 1.1)} len={0.22} color={o.top === 'tshirt' || o.top === 'saree' ? skin : top} skin={!longSleeve} position={[0, -0.16, 0]} />
            {!longSleeve && (
              <mesh position={[0, -0.07, 0]}>
                <cylinderGeometry args={[0.088 * Math.min(b, 1.1), 0.094 * Math.min(b, 1.1), 0.15, 24, 1, true]} />
                <Cloth color={top} side={THREE.DoubleSide} />
              </mesh>
            )}
            <group ref={side < 0 ? foreL : foreR} position={[0, -0.32, 0]}>
              <mesh>
                <sphereGeometry args={[0.068, 18, 14]} />
                {longSleeve ? <Cloth color={top} /> : <SkinMat color={skin} />}
              </mesh>
              <Limb r={0.064} len={0.2} color={longSleeve ? top : skin} skin={!longSleeve} position={[0, -0.13, 0]} />
              {longSleeve && (
                <mesh position={[0, -0.255, 0]}>
                  <cylinderGeometry args={[0.068, 0.068, 0.04, 20]} />
                  <Cloth color={shirtDark} />
                </mesh>
              )}
              <Hand skin={skin} side={side} thumbsUp={pose === 'thumbsup' && side > 0} wave={pose === 'waving' && side > 0} />
              {c.accessories.watch && side < 0 && (
                <mesh position={[0, -0.235, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.064, 0.013, 8, 24]} />
                  <meshStandardMaterial color="#e9c46a" metalness={0.85} roughness={0.25} />
                </mesh>
              )}
            </group>
          </group>
        ))}

        {/* Neck */}
        <mesh position={[0, 1.68, 0]} castShadow>
          <cylinderGeometry args={[0.072, 0.085, 0.16, 24]} />
          <SkinMat color={skin} />
        </mesh>
        {c.accessories.necklace && (
          <mesh position={[0, 1.6, 0.04]} rotation={[Math.PI / 2 + 0.45, 0, 0]}>
            <torusGeometry args={[0.105, 0.007, 6, 40]} />
            <meshStandardMaterial color="#e9c46a" metalness={0.9} roughness={0.2} />
          </mesh>
        )}

        <group ref={head} position={[0, HEAD_Y, 0.01]}>
          <AvatarHead c={c} skin={skin} animate={animate} />
        </group>
      </group>
    </group>
  );
});

function Hand({ skin, side, thumbsUp, wave }: { skin: string; side: number; thumbsUp: boolean; wave: boolean }) {
  return (
    <group position={[0, -0.31, 0]} rotation={[0, wave ? side * -0.4 : 0, 0]} scale={1.25}>
      <mesh scale={[0.05, 0.068, 0.03]} castShadow>
        <sphereGeometry args={[1, 18, 14]} />
        <SkinMat color={skin} />
      </mesh>
      {/* fingers as a soft mitten */}
      <mesh position={[0, thumbsUp ? -0.02 : -0.058, thumbsUp ? 0.02 : 0]} scale={[0.046, thumbsUp ? 0.03 : 0.04, thumbsUp ? 0.04 : 0.026]}>
        <sphereGeometry args={[1, 16, 12]} />
        <SkinMat color={skin} />
      </mesh>
      <mesh position={[side * -0.042, thumbsUp ? 0.05 : -0.01, 0.018]} rotation={[thumbsUp ? 0 : 0.2, 0, thumbsUp ? 0 : side * 0.5]}>
        <capsuleGeometry args={[0.016, thumbsUp ? 0.045 : 0.03, 4, 8]} />
        <SkinMat color={skin} />
      </mesh>
    </group>
  );
}

function Shoe({ kind, color, skin }: { kind: AvatarConfig['outfit']['shoes']; color: string; skin: string }) {
  const sole = kind === 'sneakers' ? '#f4ede4' : kind === 'formal' ? shade(color, -0.12) : '#2a1d16';
  if (kind === 'sandals')
    return (
      <group position={[0, -0.415, 0.035]}>
        <mesh scale={[0.07, 0.045, 0.13]} castShadow>
          <sphereGeometry args={[1, 18, 12]} />
          <SkinMat color={skin} />
        </mesh>
        <mesh position={[0, -0.04, 0]} scale={[0.08, 0.016, 0.145]}>
          <sphereGeometry args={[1, 18, 8]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.005, 0.03]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.5]}>
          <torusGeometry args={[0.065, 0.012, 6, 20, Math.PI]} />
          <meshStandardMaterial color={color} roughness={0.5} />
        </mesh>
      </group>
    );
  return (
    <group position={[0, -0.435, 0.04]}>
      {kind === 'boots' && (
        <mesh position={[0, 0.04, -0.035]}>
          <cylinderGeometry args={[0.092, 0.095, 0.14, 24]} />
          <meshPhysicalMaterial color={color} roughness={0.5} clearcoat={0.3} />
        </mesh>
      )}
      <mesh scale={[0.088, kind === 'formal' ? 0.058 : 0.068, kind === 'formal' ? 0.17 : 0.158]} castShadow>
        <sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshPhysicalMaterial color={color} roughness={kind === 'formal' ? 0.2 : 0.65} clearcoat={kind === 'formal' ? 1 : 0} />
      </mesh>
      <mesh position={[0, -0.022, 0]} scale={[0.092, 0.024, 0.165]} castShadow>
        <sphereGeometry args={[1, 24, 10]} />
        <meshStandardMaterial color={sole} roughness={0.7} />
      </mesh>
    </group>
  );
}
