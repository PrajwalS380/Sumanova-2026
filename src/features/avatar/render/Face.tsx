import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mix, shellGeometry, smooth, softDot, surfaceShape, surfaceTube, surfaceZ, wobble, type HeadShape } from '../sculpt';
import type { BeardP, BrowP, EarP, EyeP, LashP, MouthP, NoseP } from '../look/face';
import type { Expression } from '../look/config';
import type { HearingP, PiercingP } from '../look/extras';
import { taperTube, arc } from '../look/tube';
import { Jewelry } from './Jewelry';

export function SkinMat({ color }: { color: string }) {
  return <meshPhysicalMaterial color={color} roughness={0.5} sheen={0.6} sheenRoughness={0.55} sheenColor={mix(color, '#ffd9c9', 0.6)} />;
}
function HairMat({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return <meshPhysicalMaterial color={color} roughness={0.5} sheen={0.8} sheenRoughness={0.35} sheenColor={mix(color, '#ffffff', 0.3)} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />;
}
function Flat({ color, rough = 0.6 }: { color: string; rough?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} />;
}

export interface FaceProps {
  h: HeadShape;
  skin: string;
  eyes: EyeP;
  lashes: LashP | null;
  brows: BrowP;
  nose: NoseP;
  mouth: MouthP;
  ears: EarP;
  beard: BeardP | null;
  colors: { eyes: string; brows: string; beard: string; lips: string | null; shadow: string | null; blush: string | null; liner: string | null };
  tune: { eyeSize: number; eyeGap: number };
  expression: Expression;
  animate: boolean;
  faceless?: boolean;
  piercings: { earL: PiercingP | null; earR: PiercingP | null; nose: PiercingP | null; brow: PiercingP | null; lip: PiercingP | null; tongue: PiercingP | null };
  hearing: { L: HearingP | null; R: HearingP | null };
}

export function Face(f: FaceProps) {
  const { h, skin } = f;
  const headGeo = useMemo(() => shellGeometry(f.h, () => 1), [f.h]);
  const ex = 0.132 * (h.rx / 0.35) * (1 + f.tune.eyeGap * 0.14);
  const ey = -0.025;
  const er = 0.08 * f.eyes.size * (1 + f.tune.eyeSize * 0.16);
  const noseY = ey - 0.12 * f.nose.len;
  const mouthY = -0.205 * (h.ry / 0.39);
  const lipColor = f.colors.lips ?? mix(skin, '#b0525a', 0.45);
  return (
    <group>
      <mesh geometry={headGeo} castShadow receiveShadow>
        <SkinMat color={skin} />
      </mesh>
      <Ears h={h} p={f.ears} skin={skin} left={f.piercings.earL} right={f.piercings.earR} hearing={f.hearing} />
      {!f.faceless && <Features f={f} ex={ex} ey={ey} er={er} noseY={noseY} mouthY={mouthY} lipColor={lipColor} />}
      {f.faceless && f.beard && <Beard h={h} p={f.beard} color={f.colors.beard} mouthY={mouthY} />}
    </group>
  );
}

/** Eyes, brows, nose, cheeks, mouth (skipped on the featureless preview mannequin). */
function Features({ f, ex, ey, er, noseY, mouthY, lipColor }: { f: FaceProps; ex: number; ey: number; er: number; noseY: number; mouthY: number; lipColor: string }) {
  const { h, skin } = f;
  const e = f.expression;
  return (
    <group>
      <Eyes f={f} ex={ex} ey={ey} er={er} />
      <Brows h={h} p={f.brows} color={f.colors.brows} ex={ex} ey={ey} er={er} e={e} pierce={f.piercings.brow} />
      <Nose h={h} p={f.nose} skin={skin} y={noseY} pierce={f.piercings.nose} />
      <Blush h={h} ex={ex} ey={ey} color={f.colors.blush ?? '#ff7d7d'} strength={f.colors.blush ? 0.55 : e === 'blushing' ? 0.6 : e === 'laughing' || e === 'happy' ? 0.28 : 0.18} />
      <Mouth h={h} p={f.mouth} y={mouthY} lip={lipColor} skin={skin} e={e} lipPierce={f.piercings.lip} tonguePierce={f.piercings.tongue} />
      {e === 'crying' && <Tears h={h} ex={ex} ey={ey} er={er} />}
      {f.beard && <Beard h={h} p={f.beard} color={f.colors.beard} mouthY={mouthY} />}
    </group>
  );
}

/* ---------------------------------------------------------------- Ears */

function Ears({ h, p, skin, left, right, hearing }: { h: HeadShape; p: EarP; skin: string; left: PiercingP | null; right: PiercingP | null; hearing: FaceProps['hearing'] }) {
  const x = h.rx * 0.97;
  return (
    <>
      {[-1, 1].map((s) => {
        const pierce = s < 0 ? left : right;
        const aid = s < 0 ? hearing.L : hearing.R;
        const sz = p.size;
        return (
          <group key={s} position={[s * x, -0.035, -0.02]} rotation={[0, s * (0.2 + p.out * 0.5), s * -0.08]}>
            <group scale={[sz * p.width, sz, sz]}>
              <mesh scale={[0.034, 0.072, 0.052]} castShadow>
                <sphereGeometry args={[1, 22, 18]} />
                <SkinMat color={skin} />
              </mesh>
              <mesh position={[s * 0.012, 0.002, 0.012]} scale={[0.016, 0.05, 0.031]}>
                <sphereGeometry args={[1, 14, 10]} />
                <Flat color={mix(skin, '#7a3a2a', 0.18)} />
              </mesh>
              {p.lobe > 0.4 && (
                <mesh position={[0, -0.068, 0.004]} scale={[0.024, 0.024 * p.lobe, 0.02]}>
                  <sphereGeometry args={[1, 14, 10]} />
                  <SkinMat color={skin} />
                </mesh>
              )}
              {p.point > 0 && (
                <mesh position={[0, 0.07, -0.01]} rotation={[-0.4, 0, 0]} scale={[0.6, 1, 0.9]}>
                  <coneGeometry args={[0.03, 0.06 * p.point, 12]} />
                  <SkinMat color={skin} />
                </mesh>
              )}
              {pierce && <Jewelry zone="ear" side={s} p={pierce} />}
            </group>
            {aid && <HearingAid side={s} p={aid} />}
          </group>
        );
      })}
    </>
  );
}

function HearingAid({ side, p }: { side: number; p: HearingP }) {
  const body = useMemo(() => taperTube(arc(new THREE.Vector3(0, 0.07, -0.03), new THREE.Vector3(side * 0.012, 0.1, -0.075), new THREE.Vector3(0, 0.0, -0.075), 10), { radius: (t) => 0.014 * (1 - 0.3 * Math.abs(t - 0.5)), flat: 0.7, segments: 18, radial: 8 }), [side]);
  const tube = useMemo(() => taperTube(arc(new THREE.Vector3(0, 0.07, -0.03), new THREE.Vector3(side * 0.02, 0.09, 0.02), new THREE.Vector3(side * 0.012, 0.01, 0.015), 10), { radius: () => 0.003, segments: 18, radial: 5 }), [side]);
  return (
    <group>
      <mesh geometry={body} castShadow>
        <meshPhysicalMaterial color={p.shell} roughness={0.3} clearcoat={0.6} />
      </mesh>
      <mesh geometry={tube}>
        <meshPhysicalMaterial color="#f4f6f8" roughness={0.2} transmission={0.3} />
      </mesh>
      <mesh position={[side * 0.012, 0.005, 0.016]} scale={[0.012, 0.014, 0.012]}>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color={p.accent} roughness={0.4} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- Eyes */

function Eyes({ f, ex, ey, er }: { f: FaceProps; ex: number; ey: number; er: number }) {
  const { h, skin, eyes: p } = f;
  const e = f.expression;
  const upper = useRef<(THREE.Group | null)[]>([]);
  const seed = useMemo(() => Math.random() * 10, []);
  const closedEye = (s: number) => e === 'sleeping' || e === 'laughing' || (e === 'winking' && s > 0);
  const open = e === 'surprised' ? Math.min(p.open, -1.05) : e === 'angry' ? p.open + 0.32 : e === 'sad' || e === 'crying' ? p.open + 0.24 : e === 'tongue' ? p.open + 0.1 : p.open;
  const lower = e === 'happy' || e === 'blushing' || e === 'tongue' ? p.lower - 0.5 : e === 'angry' ? p.lower - 0.45 : p.lower;
  const lid = f.colors.shadow ? mix(skin, f.colors.shadow, 0.62) : skin;
  const liner = f.colors.liner ?? '#1a1110';
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + seed;
    const ph = t % 4.6;
    const blink = f.animate && ph < 0.16 ? Math.sin((ph / 0.16) * Math.PI) : 0;
    upper.current.forEach((g, i) => {
      if (!g || closedEye(i === 0 ? -1 : 1)) return;
      g.rotation.x = open + (1.35 - open) * blink;
    });
  });
  return (
    <>
      {[-1, 1].map((s, i) => {
        const z = surfaceZ(h, s * ex, ey) - er * 0.5;
        const closed = closedEye(s);
        return (
          <group key={s}>
            <group position={[s * ex, ey, z]} rotation={[0, s * 0.2, s * -p.tilt]} scale={[1, p.squash, 1]}>
              {!closed && (
                <>
                  <mesh>
                    <sphereGeometry args={[er, 32, 24]} />
                    <meshPhysicalMaterial color="#f8f2ec" roughness={0.2} clearcoat={1} clearcoatRoughness={0.08} />
                  </mesh>
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <sphereGeometry args={[er * 1.004, 32, 8, 0, Math.PI * 2, 0, p.iris + 0.1]} />
                    <meshStandardMaterial color={mix(f.colors.eyes, '#000000', 0.35)} roughness={0.3} />
                  </mesh>
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <sphereGeometry args={[er * 1.007, 32, 8, 0, Math.PI * 2, 0, p.iris]} />
                    <meshPhysicalMaterial color={f.colors.eyes} roughness={0.25} clearcoat={1} emissive={f.colors.eyes} emissiveIntensity={0.12} />
                  </mesh>
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <sphereGeometry args={[er * 1.01, 24, 6, 0, Math.PI * 2, 0, e === 'surprised' ? 0.2 : 0.27]} />
                    <meshStandardMaterial color="#0d0907" roughness={0.1} />
                  </mesh>
                  <mesh position={[er * 0.3, er * 0.32, er * 0.93]}>
                    <sphereGeometry args={[er * 0.15, 12, 8]} />
                    <meshBasicMaterial color="#ffffff" />
                  </mesh>
                  <mesh position={[-er * 0.25, -er * 0.3, er * 0.96]}>
                    <sphereGeometry args={[er * 0.07, 8, 6]} />
                    <meshBasicMaterial color="#ffffff" />
                  </mesh>
                  <mesh rotation={[lower, 0, 0]}>
                    <sphereGeometry args={[er * 1.06, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
                    <SkinMat color={skin} />
                  </mesh>
                  {f.lashes && f.lashes.bottom > 0 && <LowerLashes er={er} s={s} p={f.lashes} color={liner} lower={lower} />}
                </>
              )}
              <group ref={(g) => (upper.current[i] = g)} rotation={[closed ? 1.35 : open, 0, 0]}>
                <mesh>
                  <sphereGeometry args={[er * 1.07, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <SkinMat color={lid} />
                </mesh>
                {!closed && (
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[er * 1.075, 0.004 + (f.lashes?.liner ?? 0.2) * 0.0045, 6, 28, Math.PI]} />
                    <meshStandardMaterial color={liner} roughness={0.6} />
                  </mesh>
                )}
                {!closed && f.lashes && <UpperLashes er={er} s={s} p={f.lashes} color={liner} />}
              </group>
              {/* crease line above the lid */}
              {!closed && p.crease > 0 && (
                <mesh position={[0, er * 0.12, 0]} rotation={[open - 0.45, 0, 0]}>
                  <torusGeometry args={[er * 1.16, 0.0028, 4, 24, Math.PI]} />
                  <meshStandardMaterial color={mix(skin, '#5a3020', 0.35)} transparent opacity={0.55} />
                </mesh>
              )}
            </group>
            {closed && <ClosedEye h={h} s={s} ex={ex} ey={ey} er={er} happy={e === 'laughing' || e === 'winking'} color={liner} />}
          </group>
        );
      })}
    </>
  );
}

function UpperLashes({ er, s, p, color }: { er: number; s: number; p: LashP; color: string }) {
  const geo = useMemo(() => {
    const n = Math.round(5 + p.density * 8);
    const parts: THREE.BufferGeometry[] = [];
    const R = er * 1.075;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n; // across the lid, 0 inner … 1 outer
      const a = Math.PI * (0.15 + 0.7 * (s > 0 ? t : 1 - t));
      const base = new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
      const outward = base.clone().normalize();
      const len = er * (0.22 + p.len * 0.45) * (0.6 + 0.6 * Math.sin(Math.PI * (0.3 + 0.7 * t)));
      const tip = base.clone().addScaledVector(outward, len * 0.55).add(new THREE.Vector3(0, len * 0.9, 0));
      const mid = base.clone().addScaledVector(outward, len * 0.55).add(new THREE.Vector3(0, len * 0.25, 0));
      parts.push(taperTube([base, mid, tip], { radius: (k) => 0.0028 * (1 - k * 0.85), radial: 4, segments: 6 }));
    }
    if (p.wing > 0) {
      const a = s > 0 ? Math.PI * 0.12 : Math.PI * 0.88;
      const base = new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
      const tip = base.clone().add(new THREE.Vector3(s * er * p.wing * 0.9, er * p.wing * p.wingUp, -er * 0.15));
      parts.push(taperTube([base, base.clone().lerp(tip, 0.5), tip], { radius: (k) => (0.005 + p.liner * 0.003) * (1 - k * 0.9), flat: 0.5, radial: 5, segments: 6 }));
    }
    return mergeGeo(parts);
  }, [er, s, p]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

function LowerLashes({ er, s, p, color, lower }: { er: number; s: number; p: LashP; color: string; lower: number }) {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const R = er * 1.06;
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6;
      const a = Math.PI * (0.3 + 0.5 * (s > 0 ? t : 1 - t));
      const base = new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
      const tip = base.clone().addScaledVector(base.clone().normalize(), er * 0.12 * p.bottom).add(new THREE.Vector3(0, -er * 0.18 * p.bottom, 0));
      parts.push(taperTube([base, tip], { radius: (k) => 0.002 * (1 - k * 0.8), radial: 4, segments: 3 }));
    }
    return mergeGeo(parts);
  }, [er, s, p]);
  return (
    <mesh geometry={geo} rotation={[lower - Math.PI / 2 + 0.15, 0, 0]}>
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function mergeGeo(parts: THREE.BufferGeometry[]) {
  const pos: number[] = [], idx: number[] = [];
  let off = 0;
  for (const g of parts) {
    const pp = g.getAttribute('position');
    for (let i = 0; i < pp.count; i++) pos.push(pp.getX(i), pp.getY(i), pp.getZ(i));
    const gi = g.getIndex()!;
    for (let i = 0; i < gi.count; i++) idx.push(gi.getX(i) + off);
    off += pp.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setIndex(idx);
  out.computeVertexNormals();
  return out;
}

function ClosedEye({ h, s, ex, ey, er, happy, color }: { h: HeadShape; s: number; ex: number; ey: number; er: number; happy: boolean; color: string }) {
  const geo = useMemo(() => {
    const d = happy ? er * 0.45 : -er * 0.35;
    const cx = s * ex;
    return surfaceTube(h, [[cx - er, ey], [cx - er * 0.5, ey + d * 0.8], [cx, ey + d], [cx + er * 0.5, ey + d * 0.8], [cx + er, ey]], 0.009, er * 0.62);
  }, [h, s, ex, ey, er, happy]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/* ---------------------------------------------------------------- Brows */

/** Brows lie flat on the face: their thin side faces outward. */
const faceOut = (_p: THREE.Vector3, out: THREE.Vector3) => out.set(0, 0.15, 1);

function Brows({ h, p, color, ex, ey, er, e, pierce }: { h: HeadShape; p: BrowP; color: string; ex: number; ey: number; er: number; e: Expression; pierce: PiercingP | null }) {
  const geos = useMemo(() => {
    const lift = e === 'surprised' ? 0.04 : e === 'sad' || e === 'crying' ? 0.01 : e === 'angry' ? -0.018 : 0;
    const inner = e === 'angry' ? -0.028 : e === 'sad' || e === 'crying' ? 0.03 : 0;
    const by = ey + er * 1.55 + lift;
    const out: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const xi = s * (ex - er * 0.95), xo = s * (ex + er * 1.15 * p.len);
      const pts: THREE.Vector3[] = [];
      const n = 9;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = xi + (xo - xi) * t;
        const archK = Math.exp(-(((t - p.archPos) / 0.32) ** 2));
        const y = by + inner * (1 - t) + p.arch * archK - p.tail * smooth(p.archPos, 1, t);
        pts.push(new THREE.Vector3(x, y, surfaceZ(h, x, y) + 0.006));
      }
      const thick = 0.012 * p.thick;
      const radius = (t: number) => thick * (p.inner * (1 - t) + 0.55 * t) * (t < 0.06 ? 0.7 : 1);
      if (p.slits > 0) {
        // split near the tail to leave clean slits
        const cut = (a: number, b: number) => pts.filter((_, i) => i / (n - 1) >= a && i / (n - 1) <= b);
        const ranges = p.slits === 1 ? [[0, 0.62], [0.74, 1]] : [[0, 0.5], [0.6, 0.72], [0.82, 1]];
        for (const [a, b] of ranges) {
          const seg = cut(a, b);
          if (seg.length >= 2) out.push(taperTube(seg, { radius: (t) => radius(a + (b - a) * t), flat: 0.4, radial: 8, segments: 10, hint: faceOut }));
        }
      } else {
        out.push(taperTube(pts, { radius, flat: 0.4, radial: 8, segments: 18, hint: faceOut }));
      }
      if (p.feather > 0) {
        for (let k = 0; k < 7; k++) {
          const t = k / 7;
          const base = pts[Math.min(n - 1, Math.round(t * (n - 1)))];
          const tip = base.clone().add(new THREE.Vector3(s * 0.012, 0.012 + (1 - t) * 0.008, 0.002));
          out.push(taperTube([base, tip], { radius: (q) => thick * 0.45 * (1 - q * 0.8), radial: 4, segments: 3 }));
        }
      }
    }
    return out;
  }, [h, p, ex, ey, er, e]);
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      ))}
      {pierce && <Jewelry zone="brow" p={pierce} brow={{ h, ex, ey: ey + er * 1.55, er }} />}
    </>
  );
}

/* ---------------------------------------------------------------- Nose */

function Nose({ h, p, skin, y, pierce }: { h: HeadShape; p: NoseP; skin: string; y: number; pierce: PiercingP | null }) {
  const z = surfaceZ(h, 0, y);
  const col = mix(skin, '#c06050', 0.04);
  const tipY = y + p.up * 0.008;
  return (
    <group>
      <mesh position={[0, tipY, z + 0.004]} rotation={[-p.up * 0.3, 0, 0]} scale={[0.034 * p.tipW, 0.032 * p.tipS, 0.042 * p.tipS]} castShadow>
        <sphereGeometry args={[1, 24, 18]} />
        <SkinMat color={col} />
      </mesh>
      {p.bridge > 0.05 && (
        <mesh position={[0, y + 0.058, surfaceZ(h, 0, y + 0.058) - 0.006 + p.bridge * 0.004]} rotation={[-0.2, 0, 0]} scale={[0.02 * p.bridgeW, 0.064, 0.016 + p.bridge * 0.008]}>
          <sphereGeometry args={[1, 16, 12]} />
          <SkinMat color={col} />
        </mesh>
      )}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.026 * p.tipW * p.nostril, y - 0.006, z - 0.004]} scale={[0.018 * p.nostril, 0.016, 0.022]}>
          <sphereGeometry args={[1, 12, 10]} />
          <SkinMat color={col} />
        </mesh>
      ))}
      {pierce && <Jewelry zone="nose" p={pierce} nose={{ y, z, w: 0.026 * p.tipW * p.nostril }} />}
    </group>
  );
}

function Blush({ h, ex, ey, strength, color }: { h: HeadShape; ex: number; ey: number; strength: number; color: string }) {
  const tex = useMemo(() => softDot(), []);
  const geos = useMemo(
    () =>
      [-1, 1].map((s) => {
        const g = surfaceShape(h, new THREE.Shape().absarc(0, 0, 0.062, 0, Math.PI * 2, false), s * (ex + 0.03), ey - 0.1, 0.003);
        const uv = g.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / 0.124 + 0.5, uv.getY(k) / 0.124 + 0.5);
        return g;
      }),
    [h, ex, ey],
  );
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} renderOrder={2}>
          <meshBasicMaterial color={color} map={tex} transparent opacity={strength} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- Mouth */

function Mouth({ h, p, y, lip, skin, e, lipPierce, tonguePierce }: { h: HeadShape; p: MouthP; y: number; lip: string; skin: string; e: Expression; lipPierce: PiercingP | null; tonguePierce: PiercingP | null }) {
  const w = 0.07 * p.width;
  const parts = useMemo(() => {
    const open = e === 'laughing' || e === 'surprised' || e === 'tongue' || (e === 'happy' && p.corner >= 0.3);
    if (open) {
      const ww = e === 'surprised' ? w * 0.45 : w * (e === 'laughing' || e === 'tongue' ? 1.12 : 1.02);
      const top = e === 'surprised' ? 0.03 : 0.012;
      const depth = e === 'surprised' ? 0.035 : e === 'laughing' || e === 'tongue' ? 0.075 : 0.05;
      const mk = (sx: number, sy: number) => {
        const s = new THREE.Shape();
        if (e === 'surprised') return s.absellipse(0, 0, ww * sx, depth * sy, 0, Math.PI * 2, false, 0);
        s.moveTo(-ww * sx, 0);
        s.quadraticCurveTo(0, -top * sy, ww * sx, 0);
        s.quadraticCurveTo(0, -depth * 2 * sy, -ww * sx, 0);
        return s;
      };
      const teeth = new THREE.Shape();
      teeth.moveTo(-ww * 0.86, -0.004);
      teeth.quadraticCurveTo(0, -top - 0.003, ww * 0.86, -0.004);
      teeth.quadraticCurveTo(0, -top - 0.026, -ww * 0.86, -0.004);
      return {
        open: true,
        lips: surfaceShape(h, mk(1.12 + p.upper * 0.04, 1.14 + p.lower * 0.06), 0, y + 0.004, 0.003),
        inner: surfaceShape(h, mk(1, 1), 0, y + 0.004, 0.0045),
        teeth: e !== 'surprised' ? surfaceShape(h, teeth, 0, y + 0.004, 0.0055) : null,
      };
    }
    const smile = e === 'sad' || e === 'crying' ? -0.7 : e === 'angry' ? -0.35 : e === 'neutral' || e === 'sleeping' ? 0.06 : 0.75 + p.corner * 0.5;
    const smirk = e === 'winking' ? 1 : 0;
    const k = 0.024 * smile + p.corner * 0.006;
    const ys = (t: number) => k * (t * t - 0.35) + smirk * 0.012 * (t + 1) * 0.5;
    const upperT = 0.015 * p.upper, lowerT = 0.019 * p.lower;
    // upper lip with a cupid's bow
    const up = new THREE.Shape();
    const N = 16;
    up.moveTo(-w, ys(-1));
    for (let i = 1; i <= N; i++) {
      const t = -1 + (2 * i) / N;
      const bowDip = p.bow * 0.006 * Math.exp(-((t / 0.12) ** 2));
      const peak = upperT * Math.sin(Math.PI * (t + 1) / 2) ** 0.7 * (1 + 0.25 * Math.exp(-(((Math.abs(t) - 0.28) / 0.15) ** 2)));
      up.lineTo(t * w, ys(t) + peak - bowDip);
    }
    for (let i = N - 1; i >= 1; i--) {
      const t = -1 + (2 * i) / N;
      up.lineTo(t * w, ys(t));
    }
    const lo = new THREE.Shape();
    lo.moveTo(-w, ys(-1));
    for (let i = 1; i < N; i++) {
      const t = -1 + (2 * i) / N;
      lo.lineTo(t * w * 0.98, ys(t));
    }
    lo.lineTo(w, ys(1));
    for (let i = N - 1; i >= 1; i--) {
      const t = -1 + (2 * i) / N;
      lo.lineTo(t * w * 0.9, ys(t) - lowerT * Math.sin(Math.PI * (t + 1) / 2) ** 0.8);
    }
    const line: [number, number][] = [-1, -0.6, -0.25, 0, 0.25, 0.6, 1].map((t) => [t * w, y + ys(t)]);
    return { open: false, upper: surfaceShape(h, up, 0, y, 0.0035), lower: surfaceShape(h, lo, 0, y, 0.0035), line: surfaceTube(h, line, 0.0032, 0.005, 32) };
  }, [e, p, w, h, y]);

  const tongue = useMemo(() => {
    if (e !== 'tongue') return null;
    const z = surfaceZ(h, 0, y - 0.03);
    const pts = [new THREE.Vector3(0, y - 0.02, z - 0.02), new THREE.Vector3(0, y - 0.05, z + 0.03), new THREE.Vector3(0, y - 0.1, z + 0.045), new THREE.Vector3(0, y - 0.135, z + 0.03)];
    return { geo: taperTube(pts, { radius: (t) => 0.034 * (1 - 0.35 * t * t), flat: 0.42, radial: 14, segments: 16 }), pts };
  }, [e, h, y]);

  return (
    <group>
      {'lips' in parts && parts.lips && <mesh geometry={parts.lips}><meshPhysicalMaterial color={lip} roughness={0.35} clearcoat={0.5} /></mesh>}
      {'inner' in parts && parts.inner && <mesh geometry={parts.inner}><Flat color="#4a1418" rough={0.8} /></mesh>}
      {'teeth' in parts && parts.teeth && <mesh geometry={parts.teeth}><Flat color="#fbf6ef" rough={0.25} /></mesh>}
      {'upper' in parts && parts.upper && <mesh geometry={parts.upper}><meshPhysicalMaterial color={mix(lip, skin, 0.12)} roughness={0.38} clearcoat={0.5} /></mesh>}
      {'lower' in parts && parts.lower && <mesh geometry={parts.lower}><meshPhysicalMaterial color={lip} roughness={0.3} clearcoat={0.7} /></mesh>}
      {'line' in parts && parts.line && <mesh geometry={parts.line}><Flat color={mix(lip, '#2a0a0a', 0.45)} /></mesh>}
      {tongue && (
        <mesh geometry={tongue.geo} castShadow>
          <meshPhysicalMaterial color="#e0707a" roughness={0.35} clearcoat={0.6} />
        </mesh>
      )}
      {lipPierce && <Jewelry zone="lip" p={lipPierce} lip={{ h, y, w }} />}
      {tonguePierce && tongue && <Jewelry zone="tongue" p={tonguePierce} tongue={tongue.pts} />}
    </group>
  );
}

function Tears({ h, ex, ey, er }: { h: HeadShape; ex: number; ey: number; er: number }) {
  return (
    <>
      {[-1, 1].map((s) => {
        const x = s * (ex - er * 0.2), y = ey - er * 1.5;
        return (
          <mesh key={s} position={[x, y, surfaceZ(h, x, y) + 0.008]} scale={[0.012, 0.02, 0.01]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshPhysicalMaterial color="#bfe3f2" roughness={0.02} transmission={0.4} clearcoat={1} />
          </mesh>
        );
      })}
    </>
  );
}

/* ---------------------------------------------------------------- Beard */

function Beard({ h, p, color, mouthY }: { h: HeadShape; p: BeardP; color: string; mouthY: number }) {
  const geo = useMemo(() => {
    if (p.beard <= 0 && p.stubble <= 0) return null;
    const my = mouthY / (h.ry * h.chinLow);
    const thick = p.beard > 0 ? p.beard : 0.006;
    return shellGeometry(h, (ux, uy, uz, az) => {
      let m: number;
      if (p.chinOnly > 0) {
        m = smooth(-0.08, 0.02, uz) * smooth(p.chinW + 0.08, p.chinW, Math.abs(ux)) * smooth(my - 0.05, my - 0.15, uy);
        if (p.soul) m = Math.max(m, smooth(0.08, 0.04, Math.abs(ux)) * smooth(my - 0.04, my - 0.08, uy) * smooth(my - 0.2, my - 0.14, uy));
      } else {
        const front = smooth(-0.35, -0.1, uz);
        const below = smooth(my + 0.1 + p.cheekLine, my + p.cheekLine * 0.5, uy) * (1 - 0.6 * smooth(0.45, 0.2, Math.abs(ux)) * smooth(my + 0.12, my + 0.22, uy));
        const side = smooth(0.85, 1.15, Math.abs(az)) * smooth(1.9, 1.6, Math.abs(az)) * smooth(0.12, -0.02, uy) * p.sides;
        const mouthHole = 1 - smooth(0.24, 0.17, Math.abs(ux)) * smooth(0.075, 0.035, Math.abs(uy - my + 0.005));
        const chinGap = p.chinOnly < 0 ? 1 - smooth(0.3, 0.15, Math.abs(ux)) : 1; // mutton chops leave the chin bare
        m = Math.max(front * below, side) * mouthHole * chinGap;
      }
      const lumps = p.beard > 0.06 ? 0.012 * wobble(ux, uy, uz, 2.4) : 0;
      const drop = p.drop * smooth(-0.6, -0.95, uy) * smooth(0, 0.4, uz) * (1 + p.curl * 0.2 * wobble(ux, uy, uz, 4));
      return 0.985 + (thick + 0.015 + lumps + drop) * m;
    }, 72, 56);
  }, [p, h, mouthY]);

  const tache = useMemo(() => {
    if (!p.tache) return null;
    const y = mouthY + 0.026;
    const w = 0.075 * p.tacheW;
    const shapes: Record<number, [number, number][]> = {
      1: [[-w, y - 0.016], [-w * 0.5, y + 0.002], [0, y + 0.006], [w * 0.5, y + 0.002], [w, y - 0.016]],
      2: [[-w * 0.9, y - 0.004], [-w * 0.45, y + 0.004], [0, y + 0.005], [w * 0.45, y + 0.004], [w * 0.9, y - 0.004]],
      3: [[-w * 1.05, y - 0.022], [-w * 0.5, y + 0.002], [0, y + 0.008], [w * 0.5, y + 0.002], [w * 1.05, y - 0.022]],
      4: [[-w * 1.35, y + 0.02], [-w * 1.05, y - 0.006], [-w * 0.5, y + 0.002], [0, y + 0.006], [w * 0.5, y + 0.002], [w * 1.05, y - 0.006], [w * 1.35, y + 0.02]],
      5: [[-w * 1.05, y - 0.075], [-w * 1.0, y - 0.01], [-w * 0.5, y + 0.004], [0, y + 0.006], [w * 0.5, y + 0.004], [w * 1.0, y - 0.01], [w * 1.05, y - 0.075]],
      6: [[-w * 1.1, y - 0.03], [-w * 0.55, y + 0.002], [0, y + 0.004], [w * 0.55, y + 0.002], [w * 1.1, y - 0.03]],
      7: [[-w * 0.7, y - 0.006], [0, y + 0.004], [w * 0.7, y - 0.006]],
    };
    const pts = shapes[p.tache] ?? shapes[1];
    const t = { 1: 0.013, 2: 0.006, 3: 0.018, 4: 0.012, 5: 0.012, 6: 0.022, 7: 0.009 }[p.tache] ?? 0.012;
    const P = pts.map(([x, yy]) => new THREE.Vector3(x, yy, surfaceZ(h, x, yy) + 0.008));
    return taperTube(P, { radius: (k) => t * p.tacheT * (0.55 + 0.45 * Math.sin(Math.PI * k)), flat: 0.6, radial: 8, segments: 24 });
  }, [p, h, mouthY]);

  return (
    <>
      {geo && (
        <mesh geometry={geo} castShadow={p.beard > 0}>
          <HairMat color={color} opacity={p.beard > 0 ? 1 : Math.max(0.2, p.stubble * 0.75)} />
        </mesh>
      )}
      {geo && p.beard > 0 && p.stubble > 0 && null}
      {tache && (
        <mesh geometry={tache} castShadow>
          <HairMat color={color} />
        </mesh>
      )}
    </>
  );
}
