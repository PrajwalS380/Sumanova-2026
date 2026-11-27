import { useSculpt } from '../sculpt3d/async';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mix, shellGeometry, smooth, softDot, surfaceShape, surfaceTube, surfaceZ, wobble, type HeadShape } from '../sculpt';
import type { BeardP, BrowP, EarP, EyeP, LashP, MouthP, NoseP } from '../look/face';
import type { Expression } from '../look/config';
import type { HearingP, PiercingP } from '../look/extras';
import { taperTube, arc } from '../look/tube';
import { Jewelry } from './Jewelry';

export function SkinMat({ color, nail = false }: { color: string; /** glossier, for fingernails */ nail?: boolean }) {
  if (nail) return <meshPhysicalMaterial color={color} roughness={0.28} clearcoat={0.6} clearcoatRoughness={0.3} />;
  // soft subsurface feel: a warm sheen at grazing angles, a touch of clearcoat for a healthy skin glow.
  // Deeper tones get a richer, warmer sheen and a stronger soft highlight so they never look flat.
  const d = skinDepth(color);
  return (
    <meshPhysicalMaterial
      color={color}
      roughness={0.52 - d * 0.1}
      sheen={0.42 + d * 0.58}
      sheenRoughness={0.5 - d * 0.1}
      sheenColor={mix(color, d > 0.5 ? '#e0926a' : '#ffb8a0', 0.55)}
      clearcoat={0.08 + d * 0.16}
      clearcoatRoughness={0.6 - d * 0.15}
    />
  );
}
/** 0 for the lightest skin … 1 for the deepest */
export function skinDepth(skin: string) {
  const c = new THREE.Color(skin);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; // linear
  return Math.min(1, Math.max(0, (0.6 - lum) / 0.55));
}
/** Natural lip tone for a skin: rosy on light skin, deeper berry-brown on deep skin. */
export const lipTone = (skin: string) => {
  const d = skinDepth(skin);
  return mix(mix(skin, '#b04a56', 0.62), mix(skin, '#4f1f28', 0.5), d);
};
/** Fingernail tone: the skin lifted toward a pale pink. */
export const nailTone = (skin: string) => mix(skin, '#f3cfc6', 0.35);
function Flat({ color, rough = 0.6, layer = 0 }: { color: string; rough?: number; /** >0 wins depth ties against thin layers below it (no z-fighting) */ layer?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} polygonOffset={layer > 0} polygonOffsetFactor={-3 * layer} polygonOffsetUnits={-60 * layer} />;
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
  const sculpted = useSculpt({ k: 'head', h: f.h, nose: f.faceless ? null : f.nose, ears: f.ears })?.[0]?.geo ?? null;
  const headGeo = useMemo(() => (sculpted ? null : shellGeometry(f.h, () => 1)), [f.h, sculpted]);
  const ex = 0.127 * (h.rx / 0.35) * (1 + f.tune.eyeGap * 0.14);
  const ey = -0.025;
  const er = 0.071 * f.eyes.size * (1 + f.tune.eyeSize * 0.16);
  const noseY = ey - 0.12 * f.nose.len;
  const mouthY = -0.205 * (h.ry / 0.39);
  const lipColor = f.colors.lips ?? lipTone(skin);
  return (
    <group>
      {/* sculpted skull + nose + ears in one surface (the separate pieces are only a fallback while it's built) */}
      <mesh geometry={sculpted ?? headGeo!} castShadow receiveShadow>
        <SkinMat color={skin} />
      </mesh>
      <Ears h={h} p={f.ears} skin={skin} left={f.piercings.earL} right={f.piercings.earR} hearing={f.hearing} sculpted={!!sculpted} />
      {!f.faceless && <Features f={f} ex={ex} ey={ey} er={er} noseY={noseY} mouthY={mouthY} lipColor={lipColor} sculpted={!!sculpted} />}
      {f.faceless && f.beard && <Beard h={h} p={f.beard} color={f.colors.beard} mouthY={mouthY} open={false} />}
    </group>
  );
}

/** Eyes, brows, nose, cheeks, mouth (skipped on the featureless preview mannequin). */
function Features({ f, ex, ey, er, noseY, mouthY, lipColor, sculpted }: { f: FaceProps; ex: number; ey: number; er: number; noseY: number; mouthY: number; lipColor: string; sculpted: boolean }) {
  const { h, skin } = f;
  const e = f.expression;
  return (
    <group>
      <Eyes f={f} ex={ex} ey={ey} er={er} />
      <Brows h={h} p={f.brows} color={f.colors.brows} ex={ex} ey={ey} er={er} e={e} pierce={f.piercings.brow} />
      <Nose h={h} p={f.nose} skin={skin} y={noseY} pierce={f.piercings.nose} sculpted={sculpted} />
      <Blush h={h} ex={ex} ey={ey} color={f.colors.blush ?? '#ff7d7d'} strength={f.colors.blush ? 0.4 : e === 'blushing' ? 0.5 : e === 'laughing' || e === 'happy' ? 0.12 : 0.08} />
      <Mouth h={h} p={f.mouth} y={mouthY} lip={lipColor} skin={skin} e={e} lipPierce={f.piercings.lip} tonguePierce={f.piercings.tongue} />
      {e === 'crying' && <Tears h={h} ex={ex} ey={ey} er={er} />}
      {f.beard && <Beard h={h} p={f.beard} color={f.colors.beard} mouthY={mouthY} open={e === 'laughing' || e === 'surprised' || e === 'tongue' || (e === 'happy' && f.mouth.corner >= 0)} />}
    </group>
  );
}

/* ---------------------------------------------------------------- Ears */

function Ears({ h, p, skin, left, right, hearing, sculpted }: { h: HeadShape; p: EarP; skin: string; left: PiercingP | null; right: PiercingP | null; hearing: FaceProps['hearing']; sculpted: boolean }) {
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
              {!sculpted && (
                <>
                  <mesh scale={[0.034, 0.072, 0.052]} castShadow>
                    <sphereGeometry args={[1, 22, 18]} />
                    <SkinMat color={skin} />
                  </mesh>
                  <mesh position={[s * 0.012, 0.002, 0.012]} scale={[0.016, 0.05, 0.031]}>
                    <sphereGeometry args={[1, 14, 10]} />
                    <Flat color={mix(skin, '#7a3a2a', 0.18)} />
                  </mesh>
                </>
              )}
              {!sculpted && p.lobe > 0.4 && (
                <mesh position={[0, -0.068, 0.004]} scale={[0.024, 0.024 * p.lobe, 0.02]}>
                  <sphereGeometry args={[1, 14, 10]} />
                  <SkinMat color={skin} />
                </mesh>
              )}
              {!sculpted && p.point > 0 && (
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
  // Bright, wide-awake eyes by default (lids sit a little higher than the raw catalogue value).
  const open = (e === 'surprised' ? Math.min(p.open, -1.05) : e === 'angry' ? p.open + 0.32 : e === 'sad' || e === 'crying' ? p.open + 0.24 : e === 'tongue' ? p.open + 0.1 : p.open) - 0.14;
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
  const peak = p.peak ?? 0;
  const lowTilt = p.lowTilt ?? 0;
  const fold = p.fold ?? (p.crease > 0 ? 1 : 0);
  const long = p.long ?? 1;
  const pupil = 0.27 * (p.pupil ?? 1);
  const irisA = Math.min(1.1, p.iris * 1.32);
  const rim = mix(f.colors.eyes, '#000000', 0.35 + 0.35 * (p.ring ?? 0.5));
  const inner = mix(f.colors.eyes, '#fff4d8', 0.28);
  const lidEdge = mix(skin, '#6a3a2c', 0.3);
  return (
    <>
      {(p.deep ?? 0) > 0 && <DeepSet h={h} ex={ex} ey={ey} er={er} amount={p.deep!} />}
      {[-1, 1].map((s, i) => {
        const z = surfaceZ(h, s * ex, ey) - er * 0.5;
        const closed = closedEye(s);
        return (
          <group key={s}>
            <group position={[s * ex, ey, z]} rotation={[0, s * 0.2, s * -p.tilt]} scale={[1.06 * long, p.squash * 0.9, 1]}>
              {!closed && (
                <>
                  <mesh>
                    <sphereGeometry args={[er, 32, 24]} />
                    <meshPhysicalMaterial color="#fbf8f4" roughness={0.2} clearcoat={1} clearcoatRoughness={0.08} emissive="#ffffff" emissiveIntensity={0.12} />
                  </mesh>
                  {/* iris: dark limbal rim, coloured iris, lighter ring round the pupil, pupil */}
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <sphereGeometry args={[er * 1.004, 32, 8, 0, Math.PI * 2, 0, irisA + 0.08]} />
                    <meshStandardMaterial color={rim} roughness={0.3} />
                  </mesh>
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <sphereGeometry args={[er * 1.007, 32, 8, 0, Math.PI * 2, 0, irisA]} />
                    <meshPhysicalMaterial color={f.colors.eyes} roughness={0.25} clearcoat={1} emissive={f.colors.eyes} emissiveIntensity={0.12} />
                  </mesh>
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <sphereGeometry args={[er * 1.0085, 32, 6, 0, Math.PI * 2, 0, pupil + (irisA - pupil) * 0.45]} />
                    <meshStandardMaterial color={inner} roughness={0.3} transparent opacity={0.55} />
                  </mesh>
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <sphereGeometry args={[er * 1.01, 24, 6, 0, Math.PI * 2, 0, e === 'surprised' ? pupil * 0.75 : pupil]} />
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
                  {/* pink inner corner */}
                  <mesh position={[-s * er * 0.93, -er * 0.06, er * 0.28]} scale={[0.8, 1, 0.7]}>
                    <sphereGeometry args={[er * 0.13, 10, 8]} />
                    <meshStandardMaterial color={mix(skin, '#d97f7a', 0.5)} roughness={0.35} />
                  </mesh>
                  {/* lower lid (slanted per shape) with a soft lash-line edge */}
                  <group rotation={[0, 0, s * lowTilt * 0.4]}>
                    <group rotation={[lower, 0, 0]}>
                      <mesh>
                        <sphereGeometry args={[er * 1.06, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
                        <SkinMat color={skin} />
                      </mesh>
                      <mesh rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[er * 1.062, 0.0032, 6, 32, Math.PI]} />
                        <meshStandardMaterial color={lidEdge} roughness={0.7} transparent opacity={0.7} />
                      </mesh>
                    </group>
                    {f.lashes && f.lashes.bottom > 0 && <LowerLashes er={er} s={s} p={f.lashes} color={liner} lower={lower} />}
                  </group>
                </>
              )}
              {/* upper lid: the edge peaks toward the inner / outer corner per shape */}
              <group rotation={[0, 0, s * peak * 0.22]}>
                <group ref={(g) => (upper.current[i] = g)} rotation={[closed ? 1.35 : open, 0, 0]}>
                  <mesh>
                    <sphereGeometry args={[er * 1.07, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
                    <SkinMat color={lid} />
                  </mesh>
                  {!closed && (
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                      <torusGeometry args={[er * 1.075, 0.0062 + (f.lashes?.liner ?? 0.2) * 0.006, 8, 32, Math.PI]} />
                      <meshStandardMaterial color={liner} roughness={0.6} />
                    </mesh>
                  )}
                  {!closed && f.lashes && <UpperLashes er={er} s={s} p={f.lashes} color={liner} />}
                </group>
              </group>
              {/* lid fold: a crease line, or a hooded skin overhang; monolids have neither */}
              {!closed && fold === 1 && (
                <mesh position={[0, er * 0.12, 0]} rotation={[open - 0.45, 0, s * peak * 0.15]}>
                  <torusGeometry args={[er * 1.16, 0.0028, 4, 24, Math.PI]} />
                  <meshStandardMaterial color={mix(skin, '#5a3020', 0.35)} transparent opacity={0.55} />
                </mesh>
              )}
              {!closed && fold === 2 && (
                <group rotation={[open - 0.55, 0, s * peak * 0.15]}>
                  <mesh position={[0, er * 0.06, 0]}>
                    <sphereGeometry args={[er * 1.13, 32, 10, Math.PI * 0.08, Math.PI * 0.84, 0, Math.PI * 0.42]} />
                    <SkinMat color={skin} />
                  </mesh>
                  <mesh position={[0, er * 0.06, 0]} rotation={[Math.PI / 2 - Math.PI * 0.42 + Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[er * 1.13 * Math.sin(Math.PI * 0.42), 0.0026, 4, 24, Math.PI]} />
                    <meshStandardMaterial color={mix(skin, '#5a3020', 0.4)} transparent opacity={0.5} />
                  </mesh>
                </group>
              )}
            </group>
            {closed && <ClosedEye h={h} s={s} ex={ex} ey={ey} er={er} happy={e === 'laughing' || e === 'winking'} color={liner} />}
          </group>
        );
      })}
    </>
  );
}

/** Deep-set eyes: a soft shadow tucked under the brow bone. */
function DeepSet({ h, ex, ey, er, amount }: { h: HeadShape; ex: number; ey: number; er: number; amount: number }) {
  const tex = useMemo(() => softDot(), []);
  const geos = useMemo(
    () =>
      [-1, 1].map((s) => {
        const r = er * 1.35;
        const g = surfaceShape(h, new THREE.Shape().absellipse(0, 0, r, r * 0.62, 0, Math.PI * 2, false, 0), s * ex, ey + er * 0.55, 0.0015);
        const uv = g.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / (2 * r) + 0.5, uv.getY(k) / (1.24 * r) + 0.5);
        return g;
      }),
    [h, ex, ey, er],
  );
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} renderOrder={1}>
          <meshBasicMaterial color="#5a3424" map={tex} transparent opacity={0.22 * amount} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

/** small stable hash for per-lash variation */
const lashHash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function UpperLashes({ er, s, p, color }: { er: number; s: number; p: LashP; color: string }) {
  const geo = useMemo(() => {
    const n = Math.round(9 + p.density * 13);
    const curl = p.curl ?? 0.5, outer = p.outer ?? 0.3, clump = p.clump ?? 0, wisp = p.wisp ?? 0, thick = p.thick ?? 1;
    const parts: THREE.BufferGeometry[] = [];
    const R = er * 1.075;
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n; // across the lid, 0 inner … 1 outer
      const a = Math.PI * (0.13 + 0.74 * (s > 0 ? t : 1 - t));
      const base = new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
      const outward = base.clone().normalize();
      // length profile: even arc (doll) ↔ rising toward the outer corner (fox)
      const even = 0.5 + 0.5 * Math.sin(Math.PI * (0.15 + 0.85 * t));
      const fox = 0.3 + 0.8 * Math.pow(t, 1.4);
      let len = er * (0.26 + p.len * 0.6) * ((1 - outer) * even + outer * fox);
      len *= 1 - wisp * 0.45 * lashHash(i) + wisp * 0.15;
      // lashes fan toward their own corner
      const side = new THREE.Vector3(s * (t - 0.45) * 0.55, 0, 0);
      const dir = outward.clone().multiplyScalar(0.62).add(side).add(up.clone().multiplyScalar(0.55)).normalize();
      let tip = base.clone().addScaledVector(dir, len);
      // curl: the tip turns up and back toward the brow
      tip.y += len * curl * 0.35;
      tip.addScaledVector(outward, -len * curl * 0.18);
      // clumps: tips gather in threes
      if (clump > 0) {
        const c = Math.floor(i / 3) * 3 + 1;
        const tc = (Math.min(c, n - 1) + 0.5) / n;
        const ac = Math.PI * (0.13 + 0.74 * (s > 0 ? tc : 1 - tc));
        const cBase = new THREE.Vector3(Math.cos(ac) * R, 0, Math.sin(ac) * R);
        const cTip = cBase.clone().addScaledVector(dir, len * 1.08);
        cTip.y += len * curl * 0.35;
        tip = tip.lerp(cTip, clump * 0.7);
      }
      const mid = base.clone().lerp(tip, 0.45).addScaledVector(outward, len * 0.12).add(new THREE.Vector3(0, -len * 0.05 * (1 - curl), 0));
      const r0 = 0.0015 * thick * (0.75 + 0.5 * Math.sin(Math.PI * t));
      parts.push(taperTube([base, mid, tip], { radius: (k) => r0 * Math.pow(1 - k, 0.7) + 0.0002, radial: 4, segments: 7 }));
    }
    if (p.wing > 0) {
      const a = s > 0 ? Math.PI * 0.1 : Math.PI * 0.9;
      const base = new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
      const tip = base.clone().add(new THREE.Vector3(s * er * p.wing * 0.9, er * p.wing * p.wingUp, -er * 0.15));
      parts.push(taperTube([base, base.clone().lerp(tip, 0.5), tip], { radius: (k) => (0.005 + p.liner * 0.003) * (1 - k * 0.9), flat: 0.5, radial: 5, segments: 6 }));
    }
    return mergeGeo(parts);
  }, [er, s, p]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} roughness={0.55} />
    </mesh>
  );
}

function LowerLashes({ er, s, p, color, lower }: { er: number; s: number; p: LashP; color: string; lower: number }) {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const R = er * 1.06;
    const n = Math.round(5 + p.bottom * 7);
    const outer = p.outer ?? 0.3;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const a = Math.PI * (0.25 + 0.55 * (s > 0 ? t : 1 - t));
      const base = new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
      const l = p.bottom * (0.6 + 0.6 * ((1 - outer) * Math.sin(Math.PI * t) + outer * t)) * (0.85 + 0.3 * lashHash(i + 50));
      const tip = base.clone().addScaledVector(base.clone().normalize(), er * 0.12 * l).add(new THREE.Vector3(s * (t - 0.4) * er * 0.06, -er * 0.17 * l, 0));
      parts.push(taperTube([base, tip], { radius: (k) => 0.0016 * (p.thick ?? 1) * (1 - k * 0.85), radial: 4, segments: 3 }));
    }
    return mergeGeo(parts);
  }, [er, s, p]);
  return (
    <mesh geometry={geo} rotation={[lower, 0, 0]}>
      <meshStandardMaterial color={color} roughness={0.55} />
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
      // soft base: blunt, full head near the nose, tapering to a fine tail
      const radius = (t: number) => thick * (p.inner * (1 - t) + 0.45 * t) * (t < 0.06 ? 0.75 : 1) * (t > 0.9 ? 1 - (t - 0.9) * 4 : 1) * 0.82;
      if (p.slits > 0) {
        // split near the tail to leave clean slits
        const cut = (a: number, b: number) => pts.filter((_, i) => i / (n - 1) >= a && i / (n - 1) <= b);
        const ranges = p.slits === 1 ? [[0, 0.62], [0.74, 1]] : [[0, 0.5], [0.6, 0.72], [0.82, 1]];
        for (const [a, b] of ranges) {
          const seg = cut(a, b);
          if (seg.length >= 2) out.push(taperTube(seg, { radius: (t) => radius(a + (b - a) * t), flat: 0.3, radial: 8, segments: 10, hint: faceOut }));
        }
      } else {
        out.push(taperTube(pts, { radius, flat: 0.3, radial: 8, segments: 18, hint: faceOut }));
      }
      // hair strokes on top: upright at the head, following the arch in the body, lying flat at the tail
      const curve = new THREE.CatmullRomCurve3(pts);
      let seed = 7 + Math.round(p.thick * 31 + p.arch * 900 + p.len * 13) + (s > 0 ? 101 : 0);
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const count = Math.round((16 + 14 * p.thick) * p.len + p.feather * 12);
      for (let k = 0; k < count; k++) {
        const t = Math.min(0.97, Math.pow(rnd(), 0.9));
        if (p.slits > 0 && ((p.slits === 1 && t > 0.58 && t < 0.78) || (p.slits === 2 && ((t > 0.46 && t < 0.64) || (t > 0.68 && t < 0.86))))) continue;
        const base = curve.getPoint(t);
        const tan = curve.getTangent(t);
        const w = radius(t);
        base.y += (rnd() * 2 - 1) * w * 0.85;
        // direction: tangent rotated upward; steeper near the inner head and for feathered brows
        const up = (t < 0.22 ? 0.95 - t * 2.6 : 0.24 - t * 0.28) + p.feather * 0.3 + (rnd() - 0.5) * 0.22;
        const dir = new THREE.Vector3(tan.x * Math.cos(up) * (t < 0.22 ? 0.6 : 1), Math.abs(tan.x) * Math.sin(up) + tan.y, 0).normalize();
        const len = (0.0065 + rnd() * 0.005) * (1 + p.feather * 0.45) * (0.85 + p.thick * 0.15) * (t > 0.85 ? 0.7 : 1);
        const tip = base.clone().addScaledVector(dir, len);
        // stay inside the brow's outline (feathered brows may brush a little past it)
        const cy = curve.getPoint(Math.min(1, t + (tip.x - base.x) / Math.max(1e-4, Math.abs(xo - xi)) * Math.sign(xo - xi))).y;
        tip.y = Math.min(tip.y, cy + w * (1 + p.feather * 0.6));
        const mid = base.clone().lerp(tip, 0.5);
        mid.z += 0.0012;
        tip.z = surfaceZ(h, tip.x, tip.y) + 0.0045;
        base.z = surfaceZ(h, base.x, base.y) + 0.0055;
        out.push(taperTube([base, mid, tip], { radius: (q) => (0.0011 + p.thick * 0.0005) * (1 - q * 0.85), radial: 3, segments: 3 }));
      }
    }
    // one draw call for both brows and all their strokes
    return [mergeGeo(out)];
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

function Nose({ h, p, skin, y, pierce, sculpted }: { h: HeadShape; p: NoseP; skin: string; y: number; pierce: PiercingP | null; sculpted: boolean }) {
  const z = surfaceZ(h, 0, y);
  const col = mix(skin, '#c06050', 0.04);
  const tipY = y + p.up * 0.008;
  return (
    <>
    <group scale={1.18} position={[0, -y * 0.18, -z * 0.18]}>
      {!sculpted && (<>
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
      </>)}
      {pierce && <Jewelry zone="nose" p={pierce} nose={{ y, z, w: 0.026 * p.tipW * p.nostril }} />}
    </group>
    {sculpted && <NoseShade h={h} p={p} y={y} skin={skin} />}
    </>
  );
}

/** Soft shading that makes the sculpted nose read: shadow under it and creases beside the wings. */
function NoseShade({ h, p, y, skin }: { h: HeadShape; p: NoseP; y: number; skin: string }) {
  const tex = useMemo(() => softDot(), []);
  const parts = useMemo(() => {
    const out: { g: THREE.BufferGeometry; o: number }[] = [];
    const dot = (x: number, yy: number, rx: number, ry: number, o: number) => {
      const g = surfaceShape(h, new THREE.Shape().absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0), x, yy, 0.0012);
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / (2 * rx) + 0.5, uv.getY(k) / (2 * ry) + 0.5);
      out.push({ g, o });
    };
    const S = 1.18;
    const tipY = (y + p.up * 0.008 - (p.droop ?? 0) * 0.009) * S - y * 0.18;
    const w = 0.027 * p.tipW * p.nostril * (1 + (p.flare ?? 0) * 0.18) * S;
    dot(0, tipY - 0.034 * p.tipS, 0.036 * p.tipW, 0.016, 0.5);
    for (const s of [-1, 1]) dot(s * (w + 0.014), y * S - y * 0.18 - 0.002, 0.012, 0.024, 0.42);
    return out;
  }, [h, p, y]);
  const col = mix(skin, '#3a1a10', 0.55);
  return (
    <>
      {parts.map(({ g, o }, i) => (
        <mesh key={i} geometry={g} renderOrder={1}>
          <meshBasicMaterial color={col} map={tex} transparent opacity={o} depthWrite={false} />
        </mesh>
      ))}
    </>
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
  const w = 0.105 * p.width; // generous, friendly mouth
  const parts = useMemo(() => {
    const open = e === 'laughing' || e === 'surprised' || e === 'tongue' || (e === 'happy' && p.corner >= 0);
    if (open) {
      const ww = e === 'surprised' ? w * 0.45 : w * (e === 'laughing' || e === 'tongue' ? 1.18 : 1.1);
      const top = e === 'surprised' ? 0.03 : 0.012;
      const depth = e === 'surprised' ? 0.035 : e === 'laughing' || e === 'tongue' ? 0.085 : 0.066;
      // Outlines are sampled into explicit points (no repeated start/end point): a path that
      // closes on its own start point makes the triangulator drop half of the fill.
      const lens = (x0: number, y0: number, cTop: number, cBot: number, n = 24) => {
        const pts: THREE.Vector2[] = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n, x = x0 * (2 * t - 1);
          pts.push(new THREE.Vector2(x, y0 + 2 * t * (1 - t) * cTop));
        }
        for (let i = n - 1; i >= 1; i--) {
          const t = i / n, x = x0 * (2 * t - 1);
          pts.push(new THREE.Vector2(x, y0 + 2 * t * (1 - t) * cBot));
        }
        return new THREE.Shape(pts);
      };
      const mk = (sx: number, sy: number) => {
        if (e === 'surprised') return new THREE.Shape().absellipse(0, 0, ww * sx, depth * sy, 0, Math.PI * 2, false, 0);
        return lens(ww * sx, 0, -top * sy, -depth * 2 * sy);
      };
      // individual teeth: two bigger front teeth, smaller toward the corners, tiny gaps between
      const toothRow = (x0: number, y0: number, cTop: number, cBot: number, n: number, lower = false) => {
        const yAt = (x: number, c: number) => { const t = (x / x0 + 1) / 2; return y0 + 2 * t * (1 - t) * c; };
        const widths = Array.from({ length: n }, (_, i) => { const d = Math.abs(i - (n - 1) / 2); return d < 1 ? 1.25 : d < 2 ? 1.0 : 0.88; });
        const sum = widths.reduce((a, b) => a + b, 0);
        const shapes: THREE.Shape[] = [];
        const gap = 0.0011;
        let x = -x0;
        for (let i = 0; i < n; i++) {
          const tw = (2 * x0 * widths[i]) / sum;
          const a = x + gap / 2, b = x + tw - gap / 2;
          const d = Math.abs(i - (n - 1) / 2);
          const len = d < 1 ? 1 : d < 2 ? 0.9 : 0.8; // front teeth longest
          const pts: THREE.Vector2[] = [];
          const steps = 6;
          const r = Math.min((b - a) * 0.35, 0.004);
          // root edge (hidden under the lip) then the rounded biting edge
          for (let k = 0; k <= steps; k++) { const xx = a + ((b - a) * k) / steps; pts.push(new THREE.Vector2(xx, yAt(xx, lower ? cBot : cTop))); }
          const edge = (xx: number) => { const y1 = yAt(xx, lower ? cBot : cTop), y2 = yAt(xx, lower ? cTop : cBot); return y1 + (y2 - y1) * len; };
          for (let k = steps; k >= 0; k--) {
            const xx = a + ((b - a) * k) / steps;
            const fromEdge = Math.min(xx - a, b - xx);
            const round = fromEdge < r ? r - Math.sqrt(Math.max(0, r * r - (r - fromEdge) ** 2)) : 0;
            pts.push(new THREE.Vector2(xx, edge(xx) + (lower ? -round : round)));
          }
          shapes.push(new THREE.Shape(pts));
          x += tw;
        }
        return shapes;
      };
      const teeth = toothRow(ww * 0.86, -0.004, -top - 0.003, -top - 0.036, 8);
      const lowerTeeth = e === 'laughing' ? toothRow(ww * 0.5, -depth * 0.62, -depth * 0.36, -depth * 0.62, 6, true) : null;
      const ell = (rx: number, ry: number) => new THREE.Shape().absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0);
      // inside the mouth: a darker throat at the back and a rounded tongue resting on the floor
      const sur = e === 'surprised';
      const throat = sur ? ell(ww * 0.55, depth * 0.55) : ell(ww * 0.62, depth * 0.42);
      const tongueY = sur ? -depth * 0.55 : -depth * 0.76;
      const tongueShape = sur ? ell(ww * 0.6, depth * 0.28) : ell(ww * 0.44, depth * 0.19);
      return {
        open: true,
        lips: surfaceShape(h, mk(1.12 + p.upper * 0.04, 1.14 + p.lower * 0.06), 0, y + 0.004, 0.003),
        inner: surfaceShape(h, mk(1, 1), 0, y + 0.004, 0.0045),
        throat: surfaceShape(h, throat, 0, y + 0.004 - (sur ? 0 : depth * 0.5), 0.0048),
        tongue: e !== 'tongue' ? surfaceShape(h, tongueShape, 0, y + 0.004 + tongueY, 0.0052) : null,
        teeth: !sur ? surfaceShape(h, teeth, 0, y + 0.004, 0.0055) : null,
        lowerTeeth: lowerTeeth ? surfaceShape(h, lowerTeeth, 0, y + 0.004, 0.0056) : null,
        ww, depth, top,
      };
    }
    const smile = e === 'sad' || e === 'crying' ? -0.7 : e === 'angry' ? -0.35 : e === 'neutral' || e === 'sleeping' ? 0.06 : 0.75 + p.corner * 0.5;
    const smirk = e === 'winking' ? 1 : 0;
    const k = 0.024 * smile + p.corner * 0.006;
    const ys = (t: number) => k * (t * t - 0.35) + smirk * 0.012 * (t + 1) * 0.5;
    const upperT = 0.0195 * p.upper, lowerT = 0.025 * p.lower;
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
    // lips sit a little proud of the skin (the sculpted head's surface can be a few mm out from the analytic one)
    const lipMid = y + ys(0) - lowerT * 0.55;
    return { open: false, upper: surfaceShape(h, up, 0, y, 0.0062), lower: surfaceShape(h, lo, 0, y, 0.0068), line: surfaceTube(h, line, 0.0028, 0.0075, 32), lipMid, upTop: y + ys(0) + upperT };
  }, [e, p, w, h, y]);

  const tongue = useMemo(() => {
    if (e !== 'tongue') return null;
    const z = surfaceZ(h, 0, y - 0.03);
    const pts = [new THREE.Vector3(0, y - 0.02, z - 0.02), new THREE.Vector3(0, y - 0.05, z + 0.03), new THREE.Vector3(0, y - 0.1, z + 0.045), new THREE.Vector3(0, y - 0.135, z + 0.03)];
    return { geo: taperTube(pts, { radius: (t) => 0.034 * (1 - 0.35 * t * t), flat: 0.42, radial: 14, segments: 16 }), pts };
  }, [e, h, y]);

  return (
    <group>
      {'lips' in parts && parts.lips && <mesh geometry={parts.lips}><meshPhysicalMaterial color={lip} roughness={0.35} clearcoat={0.5} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-30} /></mesh>}
      {'inner' in parts && parts.inner && <mesh geometry={parts.inner} renderOrder={1}><Flat color="#4a1418" rough={0.8} layer={1.5} /></mesh>}
      {'throat' in parts && parts.throat && <mesh geometry={parts.throat} renderOrder={1}><Flat color="#2a080c" rough={0.9} layer={1.7} /></mesh>}
      {'tongue' in parts && parts.tongue && <mesh geometry={parts.tongue} renderOrder={2}><meshPhysicalMaterial color="#c8505e" roughness={0.4} clearcoat={0.5} polygonOffset polygonOffsetFactor={-5.6} polygonOffsetUnits={-112} /></mesh>}
      {'teeth' in parts && parts.teeth && <mesh geometry={parts.teeth} renderOrder={2}><meshPhysicalMaterial color="#f7f1e8" roughness={0.22} clearcoat={0.4} polygonOffset polygonOffsetFactor={-6.6} polygonOffsetUnits={-132} /></mesh>}
      {'lowerTeeth' in parts && parts.lowerTeeth && <mesh geometry={parts.lowerTeeth} renderOrder={2}><meshPhysicalMaterial color="#efe7dc" roughness={0.25} clearcoat={0.3} polygonOffset polygonOffsetFactor={-6.6} polygonOffsetUnits={-132} /></mesh>}
      {'ww' in parts && parts.ww && <SmileShade h={h} y={y + 0.004} ww={parts.ww} depth={parts.depth!} top={parts.top!} teeth={!!parts.teeth} />}
      {'upper' in parts && parts.upper && <mesh geometry={parts.upper}><meshPhysicalMaterial color={mix(lip, '#3a1010', 0.12)} roughness={0.38} clearcoat={0.5} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-8} /></mesh>}
      {'lower' in parts && parts.lower && <mesh geometry={parts.lower}><meshPhysicalMaterial color={lip} roughness={0.3} clearcoat={0.7} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-8} /></mesh>}
      {'lipMid' in parts && <LipShade h={h} w={w} y={y} lipMid={parts.lipMid!} upTop={parts.upTop!} p={p} skin={skin} />}
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

/** Open-smile detail: the upper lip's shadow across the teeth and soft creases at the mouth corners. */
function SmileShade({ h, y, ww, depth, top, teeth }: { h: HeadShape; y: number; ww: number; depth: number; top: number; teeth: boolean }) {
  const tex = useMemo(() => softDot(), []);
  const parts = useMemo(() => {
    const out: { g: THREE.BufferGeometry; c: string; o: number; layer: number }[] = [];
    const dot = (x: number, yy: number, rx: number, ry: number, c: string, o: number, lift: number, layer: number) => {
      const g = surfaceShape(h, new THREE.Shape().absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0), x, yy, lift);
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / (2 * rx) + 0.5, uv.getY(k) / (2 * ry) + 0.5);
      out.push({ g, c, o, layer });
    };
    if (teeth) dot(0, y - top - 0.006, ww * 0.78, 0.008, '#5a3a30', 0.35, 0.0058, 2.6);
    for (const s of [-1, 1]) {
      // the cheek folds up around the corners of a smile
      dot(s * ww * 1.2, y - depth * 0.25, 0.007, 0.018, '#3a1a10', 0.22, 0.0016, 0.5);
      dot(s * ww * 1.32, y + 0.018, 0.03, 0.018, '#ffffff', 0.1, 0.0016, 0.5);
    }
    return out;
  }, [h, y, ww, depth, top, teeth]);
  return (
    <>
      {parts.map(({ g, c, o, layer }, i) => (
        <mesh key={i} geometry={g} renderOrder={3}>
          <meshBasicMaterial color={c} map={tex} transparent opacity={o} depthWrite={false} polygonOffset polygonOffsetFactor={-3 * layer} polygonOffsetUnits={-60 * layer} />
        </mesh>
      ))}
    </>
  );
}

/** Lip detail for closed mouths: gloss on the lower lip, a soft shadow under it, and the philtrum groove. */
function LipShade({ h, w, y, lipMid, upTop, p, skin }: { h: HeadShape; w: number; y: number; lipMid: number; upTop: number; p: MouthP; skin: string }) {
  const tex = useMemo(() => softDot(), []);
  const parts = useMemo(() => {
    const out: { g: THREE.BufferGeometry; c: string; o: number; lift: number }[] = [];
    const dot = (x: number, yy: number, rx: number, ry: number, c: string, o: number, lift: number) => {
      const g = surfaceShape(h, new THREE.Shape().absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0), x, yy, lift);
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / (2 * rx) + 0.5, uv.getY(k) / (2 * ry) + 0.5);
      out.push({ g, c, o, lift });
    };
    // gloss highlight on the lower lip
    dot(w * 0.12, lipMid + 0.002, w * 0.28, 0.006 * p.lower, '#ffffff', 0.32, 0.0078);
    // shadow tucked under the lower lip
    dot(0, lipMid - 0.022 * p.lower, w * 0.42, 0.011, '#3a1a10', 0.3, 0.0014);
    // philtrum: two soft ridges' shadow from the nose to the cupid's bow
    for (const s of [-1, 1]) dot(s * 0.011, upTop + 0.02, 0.0055, 0.02, '#3a1a10', 0.16, 0.0014);
    return out;
  }, [h, w, y, lipMid, upTop, p]);
  void skin;
  return (
    <>
      {parts.map(({ g, c, o }, i) => (
        <mesh key={i} geometry={g} renderOrder={3}>
          <meshBasicMaterial color={c} map={tex} transparent opacity={o} depthWrite={false} />
        </mesh>
      ))}
    </>
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

/**
 * Stubble: fine dark hair dots on the skin whose density follows the beard shape (vertex
 * attribute `density`) and thins out at its edges — not a tinted mask.
 */
function useStubbleMat(color: string, amount: number) {
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.95, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    m.userData.u = { uAmt: { value: amount } };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, m.userData.u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float density;\nvarying float vDen;\nvarying vec3 vSP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDen = density; vSP = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uAmt;\nvarying float vDen;\nvarying vec3 vSP;\nfloat bHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
float d = clamp(vDen, 0.0, 1.0);
float dots = step(1.0 - d * 0.6, bHash(floor(vSP * 900.0)));
float shadow = d * d * (0.32 + 0.25 * uAmt);
diffuseColor.a = clamp(shadow + dots * d * 0.18, 0.0, 0.72);`,
        );
    };
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    mat.color.set(color);
    (mat.userData.u as { uAmt: { value: number } }).uAmt.value = amount;
  }, [mat, color, amount]);
  return mat;
}

/** Beard surface: fine downward strands (light / dark streaks) instead of a flat solid. */
function useBeardMat(color: string) {
  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({ roughness: 0.88, sheen: 0.45, sheenRoughness: 0.8 });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vBP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBP = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vBP;\nfloat bH(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
// strands run downward: fine across, long along y
float st = bH(floor(vec3(vBP.x * 700.0, vBP.y * 70.0 + bH(floor(vec3(vBP.x * 700.0, 0.0, vBP.z * 700.0))) * 3.0, vBP.z * 700.0)));
diffuseColor.rgb *= 0.72 + 0.5 * st;`,
        );
    };
    return m;
  }, []);
  useEffect(() => {
    // very dark beards are lifted a touch so the strand texture still reads (pure black looks like plastic)
    const c = new THREE.Color(color);
    const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    mat.color.set(lum < 0.02 ? mix(color, '#4a3a30', 0.25) : color);
    mat.sheenColor.set(mix(color, '#d8c0a8', 0.25));
  }, [mat, color]);
  return mat;
}

function Beard({ h, p, color, mouthY, open }: { h: HeadShape; p: BeardP; color: string; mouthY: number; open: boolean }) {
  const halo = useMemo(() => {
    // soft stubble fade around a beard's edge, so it grows out of the skin instead of ending in a hard line
    if (p.beard <= 0) return null;
    const my = mouthY / (h.ry * h.chinLow);
    const ms: number[] = [];
    const g = shellGeometry(h, (ux, uy, uz, az) => {
      const front = smooth(-0.45, -0.1, uz);
      const below = p.chinOnly > 0
        ? smooth(p.chinW + 0.16, p.chinW, Math.abs(ux)) * smooth(my - 0.02, my - 0.12, uy)
        : smooth(my + 0.16 + p.cheekLine * 0.35, my - 0.02 + p.cheekLine * 0.15, uy);
      const side = p.chinOnly > 0 ? 0 : smooth(1.05, 1.35, Math.abs(az)) * smooth(1.95, 1.65, Math.abs(az)) * smooth(0.06, -0.1, uy) * p.sides;
      const mouthHole = smooth(0.6, 1.0, (ux / 0.22) ** 2 + ((uy - my + 0.01) / 0.07) ** 2);
      const band = p.band ? smooth(my - 0.16 - p.band * 0.12, my - 0.28 - p.band * 0.12, uy) : 1;
      ms.push(Math.max(front * below * band, side) * mouthHole * 0.85);
      return 1.006;
    }, 96, 72, ms);
    return g;
  }, [p, h, mouthY]);
  const haloMat = useStubbleMat(color, 0.55);
  const beardMat = useBeardMat(color);
  const geo = useMemo(() => {
    if (p.beard <= 0 && p.stubble <= 0) return null;
    const my = mouthY / (h.ry * h.chinLow);
    const thick = p.beard > 0 ? p.beard * 0.6 : 0.006; // close-trimmed, sculpted
    const ms: number[] = []; // beard density per vertex (same order as the sphere's vertices)
    const g = shellGeometry(h, (ux, uy, uz, az) => {
      let m: number;
      if (p.chinOnly > 0) {
        m = smooth(-0.08, 0.02, uz) * smooth(p.chinW + 0.08, p.chinW, Math.abs(ux)) * smooth(my - 0.05, my - 0.15, uy);
        if (p.soul) m = Math.max(m, smooth(0.08, 0.04, Math.abs(ux)) * smooth(my - 0.04, my - 0.08, uy) * smooth(my - 0.2, my - 0.14, uy));
      } else {
        const front = smooth(-0.35, -0.1, uz);
        const below = smooth(my + 0.1 + p.cheekLine * 0.35, my - 0.05 + p.cheekLine * 0.15, uy) * (1 - 0.6 * smooth(0.45, 0.2, Math.abs(ux)) * smooth(my + 0.12, my + 0.22, uy));
        const side = smooth(1.12, 1.4, Math.abs(az)) * smooth(1.9, 1.65, Math.abs(az)) * smooth(0.02, -0.1, uy) * p.sides; // sideburns stay by the ears
        // hugs the lips; widens only for open-mouth expressions (a grin, laughing)
        const mouthHole = open ? smooth(0.8, 1.05, (ux / 0.36) ** 2 + ((uy - my + 0.07) / 0.13) ** 2) : smooth(0.75, 1.0, (ux / 0.27) ** 2 + ((uy - my + 0.012) / 0.072) ** 2);
        const chinGap = p.chinOnly < 0 ? 1 - smooth(0.3, 0.15, Math.abs(ux)) : 1; // mutton chops leave the chin bare
        // chinstrap: only a band hugging the jawline (higher band = thinner strap)
        const band = p.band ? smooth(my - 0.2 - p.band * 0.12, my - 0.3 - p.band * 0.12, uy) : 1;
        m = Math.max(front * below * band, side) * mouthHole * chinGap;
      }
      const lumps = p.beard > 0.06 ? 0.012 * wobble(ux, uy, uz, 2.4) : 0;
      const drop = p.drop * smooth(-0.6, -0.95, uy) * smooth(0, 0.4, uz) * (1 + p.curl * 0.2 * wobble(ux, uy, uz, 4));
      ms.push(m);
      // stubble only: a thin skin-hugging layer everywhere (its density shader decides where it shows),
      // so there is no line where a shell would cut through the skin
      if (p.beard <= 0) return 1.006;
      return 0.985 + (thick + 0.015 + lumps + drop) * m;
    }, 128, 96, ms);
    return g;
  }, [p, h, mouthY, open]);
  const stubble = useStubbleMat(color, p.stubble);

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
    return taperTube(P, { radius: (k) => t * 1.45 * p.tacheT * (0.55 + 0.45 * Math.sin(Math.PI * k)), flat: 0.6, radial: 8, segments: 24 });
  }, [p, h, mouthY]);

  return (
    <>
      {geo && (
        <mesh geometry={geo} castShadow={p.beard > 0} material={p.beard > 0 ? beardMat : stubble} />
      )}
      {halo && <mesh geometry={halo} material={haloMat} />}
      {tache && (
        <mesh geometry={tache} castShadow material={beardMat} />
      )}
    </>
  );
}
