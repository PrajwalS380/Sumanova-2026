import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shade, skinWithUndertone, type AvatarConfig } from './config';

/**
 * Original procedural 3D character built from primitives (no external models).
 * Feet at y=0. Stylised proportions: slightly larger head for expressiveness.
 * Kept to low-poly segment counts so it stays smooth on mid-range Android.
 */
const SEG = 24;

function Mat({ color, rough = 0.62, metal = 0, opacity = 1, emissive }: { color: string; rough?: number; metal?: number; opacity?: number; emissive?: string }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={metal} transparent={opacity < 1} opacity={opacity} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 0.4 : 0} />;
}

function Capsule({ r, len, color, ...p }: { r: number; len: number; color: string } & JSX.IntrinsicElements['mesh']) {
  return (
    <mesh castShadow {...p}>
      <capsuleGeometry args={[r, len, 6, 16]} />
      <Mat color={color} />
    </mesh>
  );
}

function Ball({ r, color, scale, rough, ...p }: { r: number; color: string; rough?: number } & JSX.IntrinsicElements['mesh']) {
  return (
    <mesh castShadow scale={scale} {...p}>
      <sphereGeometry args={[r, SEG, SEG]} />
      <Mat color={color} rough={rough} />
    </mesh>
  );
}

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
  const head = useRef<THREE.Group>(null);

  const build = { slim: 0.86, average: 1, athletic: 1.08, broad: 1.2 }[c.body.build];
  const H = c.body.height;
  const longSleeve = ['shirt', 'hoodie', 'jacket', 'kurta', 'blazer'].includes(c.outfit.top);
  const seated = pose === 'sitting';

  // Static base angles per pose (radians). Animation adds on top in useFrame.
  const base = useMemo(() => {
    const b = { armL: 0.12, armR: -0.12, foreL: 0, foreR: 0, armLx: 0, armRx: 0, legL: 0, legR: 0 };
    if (pose === 'waving') Object.assign(b, { armR: -2.6, foreR: -0.4 });
    if (pose === 'celebrating') Object.assign(b, { armL: 2.35, armR: -2.35 });
    if (pose === 'thumbsup') Object.assign(b, { armR: -0.3, armRx: -1.3, foreR: 0, });
    if (pose === 'sitting') Object.assign(b, { legL: -1.5, legR: -1.5, armL: 0.25, armR: -0.25, armLx: -0.4, armRx: -0.4 });
    if (c.body.posture === 'proud' && pose === 'standing') Object.assign(b, { armL: 0.22, armR: -0.22 });
    return b;
  }, [pose, c.body.posture]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!animate) return;
    const s = (f: number, a: number, o = 0) => Math.sin(t * f + o) * a;
    if (body.current) {
      body.current.position.y = (pose === 'dancing' ? Math.abs(s(5, 0.06)) : s(1.6, 0.008)) + (seated ? -0.42 : 0);
      body.current.rotation.z = pose === 'dancing' ? s(2.5, 0.08) : 0;
      body.current.rotation.y = pose === 'dancing' ? s(1.25, 0.25) : 0;
    }
    if (head.current) {
      head.current.rotation.y = pose === 'standing' || pose === 'sitting' ? s(0.5, 0.12) : 0;
      head.current.rotation.z = pose === 'dancing' ? s(2.5, -0.1) : s(0.7, 0.02);
      head.current.rotation.x = c.expression === 'sad' || c.expression === 'crying' ? 0.12 : c.expression === 'sleeping' ? 0.18 : 0;
    }
    const swing = pose === 'walking' ? s(4, 0.5) : pose === 'dancing' ? s(5, 0.6) : 0;
    if (armL.current) {
      armL.current.rotation.z = base.armL + (pose === 'celebrating' ? s(6, 0.15) : pose === 'dancing' ? 0.9 + s(5, 0.4) : s(1.6, 0.02));
      armL.current.rotation.x = base.armLx + (pose === 'walking' ? swing : 0);
    }
    if (armR.current) {
      armR.current.rotation.z = base.armR + (pose === 'waving' ? s(6, 0.25) : pose === 'celebrating' ? s(6, -0.15, 1) : pose === 'dancing' ? -0.9 + s(5, 0.4, Math.PI) : s(1.6, -0.02));
      armR.current.rotation.x = base.armRx + (pose === 'walking' ? -swing : 0);
    }
    if (foreR.current) foreR.current.rotation.z = base.foreR + (pose === 'waving' ? s(6, 0.3, 1) : 0);
    if (foreL.current) foreL.current.rotation.z = base.foreL;
    if (legL.current) legL.current.rotation.x = base.legL + (pose === 'walking' ? -swing * 0.8 : pose === 'dancing' ? s(5, 0.15) : 0);
    if (legR.current) legR.current.rotation.x = base.legR + (pose === 'walking' ? swing * 0.8 : pose === 'dancing' ? s(5, -0.15) : 0);
    if (root.current && pose === 'walking') root.current.position.y = Math.abs(s(8, 0.03));
  });

  const top = c.outfit.topColor;
  const bottom = c.outfit.bottomColor;
  const torsoW = 0.245 * build;
  const longTop = c.outfit.top === 'kurta';
  const isSkirt = c.outfit.bottom === 'skirt' || c.outfit.bottom === 'dhoti' || c.outfit.top === 'saree';

  return (
    <group ref={root} scale={[mirror ? -H : H, H, H]}>
      {seated && (
        <mesh position={[0, 0.3, -0.05]} receiveShadow castShadow>
          <cylinderGeometry args={[0.36, 0.3, 0.6, 32]} />
          <Mat color="#2a2d52" rough={0.4} />
        </mesh>
      )}
      <group ref={body}>
        {/* Legs */}
        {[-1, 1].map((side) => (
          <group key={side} ref={side < 0 ? legL : legR} position={[side * 0.12 * build, 0.9, 0]}>
            {isSkirt && !seated ? null : (
              <>
                <Capsule r={0.095 * build} len={0.3} color={c.outfit.bottom === 'shorts' ? bottom : bottom} position={[0, -0.22, 0]} />
                <Capsule r={0.085 * build} len={0.32} color={c.outfit.bottom === 'shorts' ? skin : bottom} position={[0, -0.6, 0]} />
              </>
            )}
            {isSkirt && !seated && <Capsule r={0.075} len={0.5} color={skin} position={[0, -0.5, 0]} />}
            {/* Shoe */}
            <mesh castShadow position={[0, -0.84, 0.05]} scale={[1, 0.6, c.outfit.shoes === 'formal' ? 1.5 : 1.35]}>
              <sphereGeometry args={[0.1, 16, 12]} />
              <Mat color={c.outfit.shoes === 'sandals' ? shade(c.outfit.shoeColor, -0.1) : c.outfit.shoeColor} rough={c.outfit.shoes === 'formal' ? 0.25 : 0.7} />
            </mesh>
            {c.outfit.shoes === 'boots' && <Capsule r={0.09} len={0.12} color={c.outfit.shoeColor} position={[0, -0.74, 0]} />}
            {c.outfit.shoes === 'sneakers' && (
              <mesh position={[0, -0.88, 0.05]} scale={[1.05, 0.25, 1.4]}>
                <sphereGeometry args={[0.1, 16, 8]} />
                <Mat color="#ffffff" />
              </mesh>
            )}
          </group>
        ))}

        {/* Skirt / dhoti / saree drape */}
        {isSkirt && (
          <mesh castShadow position={[0, c.outfit.bottom === 'dhoti' ? 0.55 : 0.62, 0]}>
            <cylinderGeometry args={[0.27 * build, c.outfit.bottom === 'dhoti' ? 0.32 : 0.4, c.outfit.bottom === 'dhoti' ? 0.75 : 0.62, 28, 1, true]} />
            <meshStandardMaterial color={c.outfit.top === 'saree' ? top : bottom} roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
        )}

        {/* Hips */}
        <mesh castShadow position={[0, 0.93, 0]} scale={[0.95 * build, 0.55, 0.66]}>
          <sphereGeometry args={[0.24, SEG, 16]} />
          <Mat color={isSkirt ? (c.outfit.top === 'saree' ? top : bottom) : bottom} />
        </mesh>

        {/* Torso */}
        <mesh castShadow position={[0, 1.2, 0]} scale={[1.12, 1, 0.68]}>
          <capsuleGeometry args={[torsoW, longTop ? 0.66 : 0.44, 8, 24]} />
          <Mat color={top} rough={c.outfit.top === 'blazer' ? 0.45 : 0.7} />
        </mesh>
        {longTop && (
          <mesh castShadow position={[0, 0.78, 0]}>
            <cylinderGeometry args={[torsoW * 1.02, torsoW * 1.25, 0.5, 24, 1, true]} />
            <meshStandardMaterial color={top} roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
        )}
        {c.outfit.top === 'saree' && (
          <mesh castShadow position={[0.02, 1.22, 0.02]} rotation={[0, 0, -0.75]} scale={[1, 1, 0.8]}>
            <torusGeometry args={[torsoW * 1.05, 0.06, 8, 32, Math.PI]} />
            <Mat color={shade(top, -0.12)} />
          </mesh>
        )}
        {(c.outfit.top === 'jacket' || c.outfit.top === 'blazer') && (
          <>
            {/* Open front shows an inner tee */}
            <mesh position={[0, 1.24, torsoW * 0.66]} rotation={[-0.08, 0, 0]}>
              <planeGeometry args={[torsoW * 0.55, 0.5]} />
              <meshStandardMaterial color={c.outfit.top === 'blazer' ? '#f5f5f7' : '#2a2a35'} roughness={0.8} side={THREE.DoubleSide} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.075, 1.36, torsoW * 0.68]} rotation={[0, 0, s * 0.5]}>
                <boxGeometry args={[0.05, 0.22, 0.02]} />
                <Mat color={shade(top, -0.1)} />
              </mesh>
            ))}
          </>
        )}
        {c.outfit.top === 'shirt' && (
          <mesh position={[0, 1.45, 0.06]} rotation={[Math.PI / 2.4, 0, 0]}>
            <torusGeometry args={[0.12, 0.03, 8, 24]} />
            <Mat color={shade(top, 0.08)} />
          </mesh>
        )}
        {c.outfit.top === 'hoodie' && (
          <mesh position={[0, 1.47, -0.1]} rotation={[0.35, 0, 0]}>
            <torusGeometry args={[0.17, 0.065, 10, 28]} />
            <Mat color={shade(top, -0.08)} />
          </mesh>
        )}

        {/* Bag strap */}
        {c.accessories.bag && (
          <>
            <mesh position={[0, 1.2, 0.02]} rotation={[0, 0, 0.75]} scale={[1, 1, 0.75]}>
              <torusGeometry args={[torsoW * 1.06, 0.018, 6, 40]} />
              <Mat color="#3a2a1f" />
            </mesh>
            <mesh castShadow position={[-0.3 * build, 0.88, 0.1]}>
              <boxGeometry args={[0.2, 0.16, 0.08]} />
              <Mat color="#7c4a2d" rough={0.5} />
            </mesh>
          </>
        )}

        {/* Arms */}
        {[-1, 1].map((side) => (
          <group key={side} ref={side < 0 ? armL : armR} position={[side * (torsoW + 0.06), 1.42, 0]}>
            <Capsule r={0.07 * build} len={0.24} color={top} position={[side * 0.0, -0.17, 0]} />
            <group ref={side < 0 ? foreL : foreR} position={[0, -0.33, 0]}>
              <Capsule r={0.06 * build} len={0.22} color={longSleeve ? top : skin} position={[0, -0.14, 0]} />
              <Ball r={0.07} color={skin} position={[0, -0.32, 0]} />
              {pose === 'thumbsup' && side > 0 && <Capsule r={0.025} len={0.06} color={skin} position={[0, -0.3, 0.07]} rotation={[0.3, 0, 0]} />}
              {c.accessories.watch && side < 0 && (
                <mesh position={[0, -0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.065, 0.016, 6, 20]} />
                  <Mat color="#d4af37" metal={0.7} rough={0.3} />
                </mesh>
              )}
            </group>
          </group>
        ))}

        {/* Neck + necklace */}
        <Capsule r={0.075} len={0.08} color={skin} position={[0, 1.55, 0]} />
        {c.accessories.necklace && (
          <mesh position={[0, 1.5, 0.03]} rotation={[Math.PI / 2.2, 0, 0]}>
            <torusGeometry args={[0.11, 0.012, 6, 28]} />
            <Mat color="#e5c26a" metal={0.8} rough={0.25} />
          </mesh>
        )}

        {/* Head */}
        <group ref={head} position={[0, 1.92, 0]}>
          <Head c={c} skin={skin} />
        </group>
      </group>
    </group>
  );
});

function Head({ c, skin }: { c: AvatarConfig; skin: string }) {
  const f = c.face;
  const shapeScale = { oval: [1, 1.08, 1], round: [1.06, 1, 1.02], square: [1.05, 1.02, 1], heart: [1.02, 1.05, 1], long: [0.95, 1.14, 0.98] }[f.shape] as [number, number, number];
  const sx = 0.36 * shapeScale[0] * f.width;
  const sy = 0.4 * shapeScale[1] * f.height;
  const sz = 0.36 * shapeScale[2];
  const e = c.expression;
  const eyeY = 0.04 + (f.forehead - 0.5) * 0.04;
  const eyeX = 0.13 * f.width;
  const eyeR = 0.06 * c.eyes.size;
  const closedL = e === 'sleeping' || e === 'laughing';
  const closedR = closedL || e === 'winking';
  const eyeSquash = c.eyes.shape === 'hooded' ? 0.7 : c.eyes.shape === 'almond' ? 0.82 : 1;
  const tilt = c.eyes.shape === 'upturned' ? 0.18 : 0;
  const browLift = e === 'surprised' ? 0.05 : e === 'angry' ? -0.02 : e === 'sad' || e === 'crying' ? 0.02 : 0;
  const browAngle = e === 'angry' ? 0.35 : e === 'sad' || e === 'crying' ? -0.3 : { soft: 0.05, straight: 0, arched: -0.15, bold: 0.05 }[c.eyes.brow];
  const browThick = c.eyes.brow === 'bold' ? 0.022 : 0.014;
  const z = sz * 0.93;

  // Mouth: open shapes for surprise/laugh, arcs for the rest.
  const mouthY = -0.17 * f.height;
  const smileCurve = e === 'sad' || e === 'crying' ? -1 : e === 'angry' ? -0.6 : e === 'neutral' || e === 'sleeping' ? 0 : c.mouth.smile === 'neutral' ? 0.15 : 1;
  const mouthW = 0.09 * c.mouth.size * (c.mouth.smile === 'grin' || e === 'happy' || e === 'blushing' ? 1.25 : 1);
  const lipT = c.mouth.shape === 'full' ? 0.022 : c.mouth.shape === 'thin' ? 0.012 : 0.018;

  return (
    <group>
      {/* Skull + jaw + cheeks */}
      <mesh castShadow scale={[sx, sy, sz]}>
        <sphereGeometry args={[1, 32, 32]} />
        <Mat color={skin} rough={0.55} />
      </mesh>
      <mesh castShadow position={[0, -0.15 - f.chin * 0.03, -0.01]} scale={[sx * (0.68 + f.jaw * 0.3) * (f.shape === 'heart' ? 0.85 : f.shape === 'square' ? 1.08 : 1), sy * 0.55, sz * 0.88]}>
        <sphereGeometry args={[1, 24, 16]} />
        <Mat color={skin} rough={0.55} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`cheek${s}`} position={[s * sx * 0.55, -0.06, z * 0.6]} scale={[0.1 + f.cheeks * 0.04, 0.08, 0.08]}>
          <sphereGeometry args={[1, 16, 12]} />
          <Mat color={e === 'blushing' || e === 'laughing' ? '#f08a9a' : skin} opacity={e === 'blushing' || e === 'laughing' ? 0.85 : 1} />
        </mesh>
      ))}
      {/* Ears */}
      {[-1, 1].map((s) => (
        <group key={`ear${s}`}>
          <Ball r={0.07} color={skin} position={[s * sx * 0.98, 0, 0]} scale={[0.5, 1, 0.8]} />
          {c.accessories.earrings && <Ball r={0.022} color="#e5c26a" position={[s * sx * 0.98, -0.08, 0.01]} rough={0.2} />}
        </group>
      ))}

      {/* Eyes */}
      {[-1, 1].map((s) => {
        const closed = s < 0 ? closedL : closedR;
        return (
          <group key={`eye${s}`} position={[s * eyeX, eyeY, z * 0.92]} rotation={[0, 0, s * -tilt]}>
            {closed ? (
              <mesh rotation={[0, 0, e === 'laughing' ? Math.PI : 0]}>
                <torusGeometry args={[eyeR * 0.85, 0.012, 6, 16, Math.PI]} />
                <Mat color="#2a1d18" />
              </mesh>
            ) : (
              <>
                <mesh scale={[1, eyeSquash * (e === 'surprised' ? 1.2 : 1), 0.5]}>
                  <sphereGeometry args={[eyeR, 20, 16]} />
                  <Mat color="#ffffff" rough={0.3} />
                </mesh>
                <mesh position={[0, -0.004, eyeR * 0.42]} scale={[1, 1, 0.4]}>
                  <sphereGeometry args={[eyeR * 0.62, 16, 12]} />
                  <Mat color={c.eyes.color} rough={0.25} />
                </mesh>
                <mesh position={[0, -0.004, eyeR * 0.6]} scale={[1, 1, 0.3]}>
                  <sphereGeometry args={[eyeR * 0.3, 12, 10]} />
                  <Mat color="#0b0b10" rough={0.1} />
                </mesh>
                <Ball r={eyeR * 0.13} color="#ffffff" position={[eyeR * 0.2, eyeR * 0.22, eyeR * 0.7]} rough={0} />
                {c.eyes.shape === 'hooded' && (
                  <mesh position={[0, eyeR * 0.45, 0.005]} scale={[1.08, 0.5, 0.6]}>
                    <sphereGeometry args={[eyeR, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                    <Mat color={skin} />
                  </mesh>
                )}
                {c.eyes.lashes && (
                  <mesh position={[s * eyeR * 0.85, eyeR * 0.55, 0.01]} rotation={[0, 0, s * -0.6]}>
                    <boxGeometry args={[eyeR * 0.45, 0.01, 0.01]} />
                    <Mat color="#151010" />
                  </mesh>
                )}
              </>
            )}
            {/* Tears */}
            {e === 'crying' && <Ball r={0.022} color="#7dd3fc" position={[s * 0.01, -eyeR * 1.4, 0.02]} scale={[0.8, 1.3, 0.8]} rough={0.05} />}
            {/* Brow */}
            <mesh position={[0, eyeR * 1.55 + browLift, 0.02]} rotation={[0, 0, s * browAngle]}>
              <capsuleGeometry args={[browThick, eyeR * 1.5, 4, 8]} />
              <Mat color={c.eyes.browColor} />
            </mesh>
          </group>
        );
      })}
      {/* Glasses */}
      {c.accessories.glasses !== 'none' && (
        <group position={[0, eyeY, z * 0.98]}>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * eyeX, 0, 0.04]}>
              {c.accessories.glasses === 'square' ? <torusGeometry args={[eyeR * 1.45, 0.012, 4, 4]} /> : <torusGeometry args={[eyeR * 1.4, 0.012, 8, 24]} />}
              <Mat color="#151519" metal={0.3} rough={0.3} />
            </mesh>
          ))}
          {c.accessories.glasses === 'sunglasses' &&
            [-1, 1].map((s) => (
              <mesh key={`l${s}`} position={[s * eyeX, 0, 0.045]}>
                <circleGeometry args={[eyeR * 1.4, 24]} />
                <meshStandardMaterial color="#0b0b14" roughness={0.1} metalness={0.4} transparent opacity={0.88} />
              </mesh>
            ))}
          <mesh position={[0, 0.005, 0.05]}>
            <boxGeometry args={[eyeX * 0.6, 0.012, 0.012]} />
            <Mat color="#151519" />
          </mesh>
        </group>
      )}

      {/* Nose */}
      <group position={[0, -0.05, z * 1.02]}>
        {c.nose.shape === 'pointed' ? (
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[c.nose.width, 1, c.nose.size]}>
            <coneGeometry args={[0.035, 0.08, 12]} />
            <Mat color={shade(skin, -0.03)} />
          </mesh>
        ) : (
          <mesh scale={[(c.nose.shape === 'wide' ? 1.35 : 1) * c.nose.width, c.nose.shape === 'straight' ? 1.3 : 1, 0.8 * c.nose.size]}>
            <sphereGeometry args={[0.04 * c.nose.size, 16, 12]} />
            <Mat color={shade(skin, -0.03)} />
          </mesh>
        )}
      </group>
      {c.accessories.bindi && <Ball r={0.014} color="#dc2626" position={[0, eyeY + 0.1, z * 1.0]} rough={0.3} />}

      {/* Mouth */}
      <group position={[0, mouthY, z * 0.93]}>
        {e === 'surprised' ? (
          <mesh scale={[0.6, 1, 0.4]}>
            <sphereGeometry args={[0.045 * c.mouth.size, 16, 12]} />
            <Mat color="#3b1515" />
          </mesh>
        ) : e === 'laughing' ? (
          <mesh rotation={[0, 0, Math.PI]} scale={[1, 0.9, 0.4]}>
            <sphereGeometry args={[mouthW, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Mat color="#4a1a1f" />
          </mesh>
        ) : smileCurve === 0 ? (
          <mesh>
            <capsuleGeometry args={[lipT, mouthW, 4, 8]} />
            <Mat color={c.mouth.color} />
          </mesh>
        ) : (
          <mesh rotation={[0, 0, smileCurve > 0 ? Math.PI : 0]} position={[c.mouth.smile === 'smirk' && smileCurve > 0 ? 0.015 : 0, smileCurve > 0 ? 0.03 : -0.03, 0]} scale={[1, Math.abs(smileCurve) * (c.mouth.shape === 'heart' ? 0.8 : 0.6), 1]}>
            <torusGeometry args={[mouthW * 0.75, lipT, 6, 20, Math.PI]} />
            <Mat color={c.mouth.color} />
          </mesh>
        )}
      </group>

      <FacialHair c={c} sx={sx} sy={sy} sz={sz} mouthY={mouthY} />
      <Hair c={c} sx={sx} sy={sy} sz={sz} />
      <Hat c={c} sx={sx} sy={sy} />
    </group>
  );
}

function FacialHair({ c, sx, sy, sz, mouthY }: { c: AvatarConfig; sx: number; sy: number; sz: number; mouthY: number }) {
  const st = c.facialHair.style;
  if (st === 'none') return null;
  const col = c.facialHair.color;
  return (
    <group>
      {(st === 'moustache' || st === 'short' || st === 'full') && (
        <mesh position={[0, mouthY + 0.05, sz * 0.95]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.018, 0.09, 4, 10]} />
          <Mat color={col} rough={0.9} />
        </mesh>
      )}
      {st === 'goatee' && <Ball r={0.05} color={col} position={[0, mouthY - 0.07, sz * 0.86]} scale={[0.8, 1, 0.6]} rough={0.9} />}
      {(st === 'short' || st === 'full' || st === 'stubble') && (
        <mesh position={[0, -0.04, 0.0]} scale={[sx * 1.03, sy * 1.0, sz * 1.04]}>
          <sphereGeometry args={[1, 28, 18, Math.PI * 0.1, Math.PI * 0.8, Math.PI * (st === 'full' ? 0.58 : 0.64), Math.PI * (st === 'full' ? 0.32 : 0.26)]} />
          <Mat color={col} rough={0.95} opacity={st === 'stubble' ? 0.38 : 1} />
        </mesh>
      )}
    </group>
  );
}

function Hair({ c, sx, sy, sz }: { c: AvatarConfig; sx: number; sy: number; sz: number }) {
  const st = c.hair.style;
  const col = c.hair.color;
  if (st === 'bald') return null;
  const capScale: [number, number, number] = [sx * 1.06, sy * 1.06, sz * 1.08];
  const cap = (thetaLen = Math.PI * 0.45, extra: [number, number, number] = [1, 1, 1]) => (
    <mesh castShadow position={[0, 0.03, -0.015]} scale={[capScale[0] * extra[0], capScale[1] * extra[1], capScale[2] * extra[2]]} rotation={[-0.32, 0, 0]}>
      <sphereGeometry args={[1, 32, 20, 0, Math.PI * 2, 0, thetaLen]} />
      <Mat color={col} rough={0.85} />
    </mesh>
  );
  switch (st) {
    case 'buzz':
      return (
        <mesh position={[0, 0.03, -0.015]} scale={[capScale[0] * 0.99, capScale[1] * 0.99, capScale[2] * 0.99]} rotation={[-0.32, 0, 0]}>
          <sphereGeometry args={[1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          <Mat color={col} rough={1} opacity={0.75} />
        </mesh>
      );
    case 'short':
      return cap();
    case 'quiff':
      return (
        <group>
          {cap()}
          <mesh position={[0, sy * 0.92, sz * 0.45]} rotation={[0.9, 0, 0]} scale={[1.3, 1, 0.8]}>
            <capsuleGeometry args={[0.1, 0.12, 6, 12]} />
            <Mat color={col} rough={0.8} />
          </mesh>
        </group>
      );
    case 'curly':
      return (
        <group>
          {cap(Math.PI * 0.46)}
          {Array.from({ length: 18 }).map((_, i) => {
            const a = (i / 18) * Math.PI * 2;
            const ring = i % 2 ? 0.75 : 0.55;
            return <Ball key={i} r={0.08} color={col} rough={0.95} position={[Math.cos(a) * sx * ring, sy * (0.78 + (i % 3) * 0.06), Math.sin(a) * sz * ring - 0.02]} />;
          })}
        </group>
      );
    case 'afro':
      return (
        <mesh castShadow position={[0, sy * 0.35, -0.04]} scale={[sx * 1.55, sy * 1.25, sz * 1.5]}>
          <sphereGeometry args={[1, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <Mat color={col} rough={1} />
        </mesh>
      );
    case 'wavy':
    case 'long':
      return (
        <group>
          {cap(Math.PI * 0.47)}
          <mesh castShadow position={[0, st === 'long' ? -0.28 : -0.12, -sz * 0.45]} scale={[sx * 1.05, 1, 0.55]}>
            <capsuleGeometry args={[0.32, st === 'long' ? 0.55 : 0.25, 8, 20]} />
            <Mat color={col} rough={0.85} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} castShadow position={[s * sx * 0.92, st === 'long' ? -0.18 : -0.06, sz * 0.05]} rotation={[0, 0, s * (st === 'wavy' ? 0.15 : 0.05)]}>
              <capsuleGeometry args={[0.07, st === 'long' ? 0.45 : 0.22, 6, 10]} />
              <Mat color={col} rough={0.85} />
            </mesh>
          ))}
        </group>
      );
    case 'bun':
      return (
        <group>
          {cap()}
          <Ball r={0.14} color={col} rough={0.85} position={[0, sy * 1.12, -sz * 0.25]} />
        </group>
      );
    case 'ponytail':
      return (
        <group>
          {cap()}
          <mesh position={[0, sy * 0.25, -sz * 1.05]} rotation={[0.5, 0, 0]}>
            <capsuleGeometry args={[0.08, 0.38, 6, 12]} />
            <Mat color={col} rough={0.85} />
          </mesh>
        </group>
      );
    case 'braids':
      return (
        <group>
          {cap()}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * sx * 0.82, -0.2, -0.04]}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Ball key={i} r={0.05} color={col} rough={0.9} position={[0, -i * 0.08, 0]} />
              ))}
            </group>
          ))}
        </group>
      );
    default:
      return cap();
  }
}

function Hat({ c, sx, sy }: { c: AvatarConfig; sx: number; sy: number }) {
  if (c.accessories.hat === 'none') return null;
  const col = c.outfit.topColor === '#16161f' ? '#dc2626' : shade(c.outfit.topColor, -0.1);
  if (c.accessories.hat === 'cap')
    return (
      <group position={[0, sy * 0.45, 0]}>
        <mesh castShadow scale={[sx * 1.12, sy * 0.85, sx * 1.12]} rotation={[-0.15, 0, 0]}>
          <sphereGeometry args={[1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Mat color={col} />
        </mesh>
        <mesh position={[0, 0.02, sx * 1.05]} rotation={[-0.1, 0, 0]} scale={[1, 0.15, 1]}>
          <cylinderGeometry args={[0.22, 0.22, 0.12, 24, 1, false, -Math.PI / 2, Math.PI]} />
          <Mat color={shade(col, -0.1)} />
        </mesh>
      </group>
    );
  return (
    <group position={[0, sy * 0.4, -0.02]}>
      <mesh castShadow scale={[sx * 1.14, sy * 1.0, sx * 1.14]}>
        <sphereGeometry args={[1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Mat color={col} rough={0.95} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[sx * 1.12, 0.05, 8, 32]} />
        <Mat color={shade(col, -0.12)} rough={0.95} />
      </mesh>
    </group>
  );
}
