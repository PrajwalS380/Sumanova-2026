import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shade, type AvatarConfig } from './config';
import { hairline, headShape, mix, shellGeometry, smooth, softDot, surfaceShape, surfaceTube, surfaceZ, wobble, lathe, type HeadShape } from './sculpt';

/* ------------------------------------------------------------------ */
/* Materials                                                            */
/* ------------------------------------------------------------------ */

export function SkinMat({ color }: { color: string }) {
  return <meshPhysicalMaterial color={color} roughness={0.52} sheen={0.6} sheenRoughness={0.55} sheenColor={mix(color, '#ffd9c9', 0.6)} />;
}
function HairMat({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return <meshPhysicalMaterial color={color} roughness={0.42} sheen={0.8} sheenRoughness={0.35} sheenColor={mix(color, '#ffffff', 0.35)} transparent={opacity < 1} opacity={opacity} />;
}
function Flat({ color, opacity = 1, rough = 0.6 }: { color: string; opacity?: number; rough?: number }) {
  return <meshStandardMaterial color={color} roughness={rough} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />;
}

/* ------------------------------------------------------------------ */
/* Head                                                                 */
/* ------------------------------------------------------------------ */

export function AvatarHead({ c, skin, animate }: { c: AvatarConfig; skin: string; animate: boolean }) {
  const h = useMemo(() => headShape(c), [c]);
  const headGeo = useMemo(() => shellGeometry(h, () => 1), [h]);
  const e = c.expression;

  // Feature placement (head-local units).
  const ex = 0.132 * c.face.width;
  const ey = -0.025 - (c.face.forehead - 0.5) * 0.035;
  const er = 0.08 * c.eyes.size;
  const noseY = ey - 0.118;
  const mouthY = -0.205 * c.face.height - (c.face.chin - 0.5) * 0.01;

  return (
    <group>
      <mesh geometry={headGeo} castShadow receiveShadow>
        <SkinMat color={skin} />
      </mesh>
      <Ears h={h} skin={skin} earrings={c.accessories.earrings} />
      <Eyes c={c} h={h} skin={skin} ex={ex} ey={ey} er={er} animate={animate} />
      <Brows c={c} h={h} ex={ex} ey={ey} er={er} />
      <Nose c={c} h={h} skin={skin} y={noseY} />
      <Blush h={h} ex={ex} ey={ey} strength={e === 'blushing' ? 0.6 : e === 'laughing' || e === 'happy' ? 0.32 : 0.2} />
      <Mouth c={c} h={h} y={mouthY} skin={skin} />
      {e === 'crying' && <Tears h={h} ex={ex} ey={ey} er={er} />}
      {c.accessories.bindi && (
        <mesh position={[0, ey + 0.12, surfaceZ(h, 0, ey + 0.12) + 0.004]}>
          <sphereGeometry args={[0.013, 12, 8]} />
          <meshPhysicalMaterial color="#c81e3a" roughness={0.25} clearcoat={1} />
        </mesh>
      )}
      <FacialHair c={c} h={h} mouthY={mouthY} />
      <Hair c={c} h={h} />
      <Glasses c={c} h={h} ex={ex} ey={ey} er={er} />
      <Hat c={c} h={h} />
    </group>
  );
}

function Ears({ h, skin, earrings }: { h: HeadShape; skin: string; earrings: boolean }) {
  const x = h.rx * 0.97;
  return (
    <>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * x, -0.035, -0.02]} rotation={[0, s * 0.35, s * -0.08]}>
          <mesh scale={[0.034, 0.072, 0.052]} castShadow>
            <sphereGeometry args={[1, 20, 16]} />
            <SkinMat color={skin} />
          </mesh>
          <mesh position={[s * 0.012, 0, 0.012]} scale={[0.016, 0.048, 0.03]}>
            <sphereGeometry args={[1, 14, 10]} />
            <Flat color={shade(skin, -0.12)} />
          </mesh>
          {earrings && (
            <mesh position={[s * 0.004, -0.078, 0.01]}>
              <torusGeometry args={[0.017, 0.0045, 8, 20]} />
              <meshStandardMaterial color="#e9c46a" metalness={0.9} roughness={0.22} />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

/** Eyeballs with iris/pupil caps, catch-lights, and skin eyelids that blink. */
function Eyes({ c, h, skin, ex, ey, er, animate }: { c: AvatarConfig; h: HeadShape; skin: string; ex: number; ey: number; er: number; animate: boolean }) {
  const e = c.expression;
  const upper = useRef<(THREE.Group | null)[]>([]);
  const seed = useMemo(() => Math.random() * 10, []);
  const openBase = { round: -0.9, almond: -0.68, upturned: -0.74, hooded: -0.46 }[c.eyes.shape];
  const closedEye = (s: number) => e === 'sleeping' || e === 'laughing' || (e === 'winking' && s > 0);
  const open = e === 'surprised' ? -1.1 : e === 'angry' ? -0.3 : e === 'sad' || e === 'crying' ? openBase + 0.25 : openBase;
  const lower = e === 'happy' || e === 'blushing' ? 0.85 : e === 'angry' ? 0.9 : 1.4;
  const tilt = c.eyes.shape === 'upturned' ? 0.16 : c.eyes.shape === 'almond' ? 0.06 : 0;
  const squash = c.eyes.shape === 'almond' ? 0.86 : c.eyes.shape === 'round' ? 1.04 : 0.94;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + seed;
    const ph = t % 4.6;
    const blink = animate && ph < 0.16 ? Math.sin((ph / 0.16) * Math.PI) : 0;
    upper.current.forEach((g, i) => {
      if (!g) return;
      const s = i === 0 ? -1 : 1;
      if (closedEye(s)) return;
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
          <group position={[s * ex, ey, z]} rotation={[0, s * 0.2, s * -tilt]} scale={[1, squash, 1]}>
            {!closed && (
              <>
                <mesh>
                  <sphereGeometry args={[er, 32, 24]} />
                  <meshPhysicalMaterial color="#f8f2ec" roughness={0.2} clearcoat={1} clearcoatRoughness={0.08} />
                </mesh>
                {/* limbal ring, iris, pupil: caps facing +z */}
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <sphereGeometry args={[er * 1.004, 32, 8, 0, Math.PI * 2, 0, 0.66]} />
                  <meshStandardMaterial color={shade(c.eyes.color, -0.18)} roughness={0.3} />
                </mesh>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <sphereGeometry args={[er * 1.007, 32, 8, 0, Math.PI * 2, 0, 0.56]} />
                  <meshPhysicalMaterial color={c.eyes.color} roughness={0.25} clearcoat={1} emissive={c.eyes.color} emissiveIntensity={0.12} />
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
                {/* lower lid */}
                <mesh rotation={[lower, 0, 0]}>
                  <sphereGeometry args={[er * 1.06, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
                  <SkinMat color={skin} />
                </mesh>
              </>
            )}
            {/* upper lid with lash line */}
            <group ref={(g) => (upper.current[i] = g)} rotation={[closed ? 1.35 : open, 0, 0]}>
              <mesh>
                <sphereGeometry args={[er * 1.07, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <SkinMat color={skin} />
              </mesh>
              {!closed && (
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[er * 1.075, c.eyes.lashes ? 0.0075 : 0.0045, 6, 28, Math.PI]} />
                  <meshStandardMaterial color="#1a1110" roughness={0.6} />
                </mesh>
              )}
              {!closed && c.eyes.lashes && (
                <mesh position={[s * er * 1.02, 0, er * 0.3]} rotation={[0, 0, s * 0.5]}>
                  <capsuleGeometry args={[0.005, er * 0.38, 3, 6]} />
                  <meshStandardMaterial color="#1a1110" />
                </mesh>
              )}
            </group>
          </group>
          {closed && <ClosedEye h={h} s={s} ex={ex} ey={ey} er={er} happy={e === 'laughing' || e === 'winking'} />}
          </group>
        );
      })}
    </>
  );
}

/** Curved lash line drawn on the skin for closed eyes (^ for laughing, ‿ for sleeping). */
function ClosedEye({ h, s, ex, ey, er, happy }: { h: HeadShape; s: number; ex: number; ey: number; er: number; happy: boolean }) {
  const geo = useMemo(() => {
    const d = happy ? er * 0.45 : -er * 0.35;
    const cx = s * ex;
    return surfaceTube(h, [[cx - er, ey], [cx - er * 0.5, ey + d * 0.8], [cx, ey + d], [cx + er * 0.5, ey + d * 0.8], [cx + er, ey]], 0.009, er * 0.62);
  }, [h, s, ex, ey, er, happy]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#1a1110" />
    </mesh>
  );
}

function Brows({ c, h, ex, ey, er }: { c: AvatarConfig; h: HeadShape; ex: number; ey: number; er: number }) {
  const e = c.expression;
  const geos = useMemo(() => {
    const lift = e === 'surprised' ? 0.04 : e === 'sad' || e === 'crying' ? 0.01 : e === 'angry' ? -0.018 : 0;
    // inner end raised/lowered by expression
    const inner = e === 'angry' ? -0.028 : e === 'sad' || e === 'crying' ? 0.03 : 0;
    const arch = { soft: 0.012, straight: 0.002, arched: 0.024, bold: 0.008 }[c.eyes.brow];
    const by = ey + er * 1.55 + lift;
    return [-1, 1].map((s) => {
      const xi = s * (ex - er * 0.95), xo = s * (ex + er * 1.15);
      const xm = (xi + xo) / 2;
      return surfaceTube(h, [[xi, by + inner], [xm - s * 0.01, by + arch + inner * 0.3], [xo, by - 0.012]], c.eyes.brow === 'bold' ? 0.016 : c.eyes.brow === 'arched' ? 0.0095 : 0.012, 0.006, 16);
    });
  }, [c.eyes.brow, e, h, ex, ey, er]);
  return (
    <>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color={c.eyes.browColor} roughness={0.85} />
        </mesh>
      ))}
    </>
  );
}

function Nose({ c, h, skin, y }: { c: AvatarConfig; h: HeadShape; skin: string; y: number }) {
  const z = surfaceZ(h, 0, y);
  const w = c.nose.width * (c.nose.shape === 'wide' ? 1.3 : 1);
  const sz = c.nose.size;
  const tipScale: [number, number, number] =
    c.nose.shape === 'pointed' ? [0.032 * w, 0.036, 0.05 * sz] : c.nose.shape === 'button' ? [0.034 * w, 0.03, 0.034 * sz] : [0.036 * w, 0.034, 0.042 * sz];
  const col = shade(skin, -0.015);
  return (
    <group>
      <mesh position={[0, y + (c.nose.shape === 'button' ? 0.004 : 0), z + 0.002]} scale={tipScale} castShadow>
        <sphereGeometry args={[1, 24, 18]} />
        <SkinMat color={col} />
      </mesh>
      {c.nose.shape !== 'button' && (
        <mesh position={[0, y + 0.055, surfaceZ(h, 0, y + 0.055) - 0.004]} rotation={[-0.25, 0, 0]} scale={[0.022 * w, 0.06, 0.02 * sz]}>
          <sphereGeometry args={[1, 16, 12]} />
          <SkinMat color={col} />
        </mesh>
      )}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.026 * w, y - 0.006, z - 0.004]} scale={[0.017 * w, 0.016, 0.022]}>
          <sphereGeometry args={[1, 12, 10]} />
          <SkinMat color={col} />
        </mesh>
      ))}
    </group>
  );
}

function Blush({ h, ex, ey, strength }: { h: HeadShape; ex: number; ey: number; strength: number }) {
  const tex = useMemo(() => softDot(), []);
  const geos = useMemo(() => [-1, 1].map((s) => surfaceShape(h, new THREE.Shape().absarc(0, 0, 0.062, 0, Math.PI * 2, false), s * (ex + 0.03), ey - 0.1, 0.003)), [h, ex, ey]);
  return (
    <>
      {geos.map((g, i) => {
        // ShapeGeometry has UVs in shape units; remap to 0..1 for the radial texture.
        const uv = g.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) / 0.124 + 0.5, uv.getY(k) / 0.124 + 0.5);
        return (
          <mesh key={i} geometry={g} renderOrder={2}>
            <meshBasicMaterial color="#ff7d7d" map={tex} transparent opacity={strength} depthWrite={false} />
          </mesh>
        );
      })}
    </>
  );
}

function Mouth({ c, h, y, skin }: { c: AvatarConfig; h: HeadShape; y: number; skin: string }) {
  const e = c.expression;
  const w = 0.07 * c.mouth.size * (c.mouth.shape === 'thin' ? 0.95 : 1);
  const lip = c.mouth.color;
  const parts = useMemo(() => {
    const open = e === 'laughing' || e === 'surprised' || (e === 'happy' && c.mouth.smile === 'grin') || (e === 'blushing' && c.mouth.smile === 'grin');
    if (open) {
      const ww = e === 'surprised' ? w * 0.45 : w * (e === 'laughing' ? 1.15 : 1.02);
      const top = e === 'surprised' ? 0.03 : 0.012;
      const depth = e === 'surprised' ? 0.035 : e === 'laughing' ? 0.075 : 0.05;
      const mk = (sx: number, sy: number) => {
        const s = new THREE.Shape();
        if (e === 'surprised') {
          s.absellipse(0, 0, ww * sx, depth * sy, 0, Math.PI * 2, false, 0);
          return s;
        }
        s.moveTo(-ww * sx, 0);
        s.quadraticCurveTo(0, -top * sy, ww * sx, 0);
        s.quadraticCurveTo(0, -depth * 2 * sy, -ww * sx, 0);
        return s;
      };
      const teeth = new THREE.Shape();
      if (e !== 'surprised') {
        teeth.moveTo(-ww * 0.86, -0.004);
        teeth.quadraticCurveTo(0, -top - 0.003, ww * 0.86, -0.004);
        teeth.quadraticCurveTo(0, -top - 0.026, -ww * 0.86, -0.004);
      }
      const tongue = new THREE.Shape().absellipse(0, -depth * 0.78, ww * 0.42, depth * 0.32, 0, Math.PI * 2, false, 0);
      return {
        lips: surfaceShape(h, mk(1.16, 1.18), 0, y + 0.004, 0.003),
        inner: surfaceShape(h, mk(1, 1), 0, y + 0.004, 0.0045),
        teeth: e !== 'surprised' ? surfaceShape(h, teeth, 0, y + 0.004, 0.0055) : null,
        tongue: e === 'laughing' ? surfaceShape(h, tongue, 0, y + 0.004, 0.0052) : null,
        line: null as THREE.BufferGeometry | null,
        lower: null as THREE.BufferGeometry | null,
      };
    }
    // Closed mouth: a curved lip line + soft lower lip.
    const smile = e === 'sad' || e === 'crying' ? -0.7 : e === 'angry' ? -0.35 : e === 'neutral' || e === 'sleeping' ? 0.08 : c.mouth.smile === 'neutral' ? 0.15 : c.mouth.smile === 'grin' ? 1.1 : 0.85;
    const smirk = c.mouth.smile === 'smirk' || e === 'winking' ? 1 : 0;
    const k = 0.026 * smile;
    const ys = (t: number) => k * (t * t - 0.35) + smirk * 0.012 * (t + 1) * 0.5;
    const pts: [number, number][] = [-1, -0.6, -0.25, 0, 0.25, 0.6, 1].map((t) => [t * w, y + ys(t)]);
    const r = c.mouth.shape === 'thin' ? 0.0065 : 0.0085;
    const lowerShape = new THREE.Shape().absellipse(0, 0, w * (c.mouth.shape === 'heart' ? 0.42 : 0.55), c.mouth.shape === 'full' ? 0.017 : c.mouth.shape === 'thin' ? 0.008 : 0.013, 0, Math.PI * 2, false, 0);
    return {
      lips: null,
      inner: null,
      teeth: null,
      tongue: null,
      line: surfaceTube(h, pts, r, 0.004, 32),
      lower: surfaceShape(h, lowerShape, 0, y + ys(0) - 0.017, 0.003),
    };
  }, [e, c.mouth.smile, c.mouth.shape, w, h, y]);

  return (
    <group>
      {parts.lips && <mesh geometry={parts.lips}><Flat color={lip} rough={0.35} /></mesh>}
      {parts.inner && <mesh geometry={parts.inner}><Flat color="#4a1418" rough={0.8} /></mesh>}
      {parts.tongue && <mesh geometry={parts.tongue}><Flat color="#e0707a" rough={0.5} /></mesh>}
      {parts.teeth && <mesh geometry={parts.teeth}><Flat color="#fbf6ef" rough={0.25} /></mesh>}
      {parts.line && <mesh geometry={parts.line}><Flat color={shade(lip, -0.2)} rough={0.5} /></mesh>}
      {parts.lower && <mesh geometry={parts.lower}><meshPhysicalMaterial color={mix(lip, skin, 0.25)} roughness={0.32} clearcoat={0.6} /></mesh>}
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

/* ------------------------------------------------------------------ */
/* Facial hair                                                          */
/* ------------------------------------------------------------------ */

function FacialHair({ c, h, mouthY }: { c: AvatarConfig; h: HeadShape; mouthY: number }) {
  const st = c.facialHair.style;
  const geo = useMemo(() => {
    if (st === 'none' || st === 'moustache') return null;
    const my = mouthY / (h.ry * h.chinLow);
    const thick = st === 'full' ? 0.085 : st === 'short' ? 0.04 : st === 'goatee' ? 0.05 : 0.006;
    return shellGeometry(h, (ux, uy, uz, az) => {
      let m: number;
      if (st === 'goatee') {
        m = smooth(-0.08, 0.02, uz) * smooth(0.3, 0.18, Math.abs(ux)) * smooth(my - 0.05, my - 0.15, uy);
        m = Math.max(m, smooth(0.25, 0.15, Math.abs(ux)) * smooth(my + 0.06, my + 0.1, uy) * smooth(my + 0.2, my + 0.15, uy) * smooth(0.5, 0.7, uz));
      } else {
        const front = smooth(-0.35, -0.1, uz);
        const below = smooth(my + 0.3, my + 0.16, uy) * (1 - 0.6 * smooth(0.45, 0.2, Math.abs(ux)) * smooth(my + 0.12, my + 0.22, uy)); // cheek line, dipping at the centre
        const side = smooth(0.85, 1.15, Math.abs(az)) * smooth(1.9, 1.6, Math.abs(az)) * smooth(0.12, -0.02, uy); // sideburns
        const mouthHole = 1 - smooth(0.24, 0.17, Math.abs(ux)) * smooth(0.075, 0.035, Math.abs(uy - my + 0.005));
        m = Math.max(front * below, side) * mouthHole;
      }
      const lumps = st === 'full' ? 0.012 * wobble(ux, uy, uz, 2.4) : 0;
      // full beards hang a little lower under the chin
      const drop = st === 'full' ? 0.06 * smooth(-0.6, -0.95, uy) * smooth(0, 0.4, uz) : 0;
      return 0.985 + (thick + 0.015 + lumps + drop) * m;
    }, 72, 56);
  }, [st, h, mouthY]);
  const tache = useMemo(() => {
    if (!(st === 'moustache' || st === 'short' || st === 'full' || st === 'goatee')) return null;
    const y = mouthY + 0.026;
    const w = 0.075;
    return surfaceTube(h, [[-w, y - 0.016], [-w * 0.5, y + 0.002], [0, y + 0.006], [w * 0.5, y + 0.002], [w, y - 0.016]], st === 'moustache' ? 0.014 : 0.012, 0.008, 24);
  }, [st, h, mouthY]);
  if (st === 'none') return null;
  const col = c.facialHair.color;
  return (
    <>
      {geo && (
        <mesh geometry={geo} castShadow={st !== 'stubble'}>
          <HairMat color={col} opacity={st === 'stubble' ? 0.42 : 1} />
        </mesh>
      )}
      {tache && (
        <mesh geometry={tache}>
          <HairMat color={col} />
        </mesh>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Hair                                                                 */
/* ------------------------------------------------------------------ */

function Hair({ c, h }: { c: AvatarConfig; h: HeadShape }) {
  const st = c.hair.style;
  const col = c.hair.color;
  const shell = useMemo(() => {
    if (st === 'bald') return null;
    const cfg = {
      buzz: { front: 0.56, back: -0.5, side: 0.12, off: 0.014, fringe: 0, part: 0 },
      short: { front: 0.5, back: -0.48, side: 0.1, off: 0.075, fringe: 0.06, part: 0.12 },
      quiff: { front: 0.55, back: -0.48, side: 0.12, off: 0.06, fringe: 0, part: 0 },
      curly: { front: 0.46, back: -0.55, side: 0.08, off: 0.1, fringe: 0, part: 0 },
      wavy: { front: 0.42, back: -0.62, side: 0.0, off: 0.08, fringe: 0.12, part: 0.22 },
      long: { front: 0.44, back: -0.66, side: -0.02, off: 0.07, fringe: 0.1, part: 0.2 },
      bun: { front: 0.52, back: -0.5, side: 0.12, off: 0.035, fringe: 0, part: 0.1 },
      ponytail: { front: 0.52, back: -0.5, side: 0.12, off: 0.035, fringe: 0, part: 0.1 },
      afro: { front: 0.36, back: -0.42, side: 0.06, off: 0.42, fringe: 0, part: 0 },
      braids: { front: 0.52, back: -0.5, side: 0.12, off: 0.035, fringe: 0, part: 0.08 },
    }[st];
    const hat = c.accessories.hat !== 'none';
    return shellGeometry(h, (ux, uy, uz, az) => {
      // Temples recede, a side-swept fringe dips across the forehead.
      const temple = 0.1 * Math.exp(-(((Math.abs(az) - 0.75) / 0.28) ** 2));
      const sweep = cfg.fringe * Math.exp(-(((az + 0.25) / 0.45) ** 2)) * (az < 0.45 ? 1 : 0);
      const line = hairline(az, cfg.front, cfg.back, cfg.side) + temple - sweep - cfg.part * 0.15 * Math.exp(-(((az - 0.5) / 0.6) ** 2));
      const soft = st === 'afro' ? 0.18 : 0.045;
      const m = smooth(line - soft, line + soft, uy);
      let off = cfg.off * (1 + (st === 'short' || st === 'quiff' ? 0.6 * Math.max(0, uy) : 0));
      if (st === 'quiff') off += 0.2 * Math.exp(-((az / 0.55) ** 2) - ((uy - 0.72) / 0.22) ** 2);
      if (st === 'curly') off += 0.05 * wobble(ux, uy, uz, 1.9);
      if (st === 'afro') off += 0.05 * wobble(ux, uy, uz, 1.5);
      if (st === 'wavy') off += 0.018 * Math.sin(uy * 14 + az * 3);
      // side parting: a soft groove on one side of the crown
      if (cfg.part) off -= 0.035 * Math.exp(-(((az - 0.42) / 0.1) ** 2)) * smooth(0.4, 0.75, uy);
      if (st !== 'afro' && st !== 'curly' && st !== 'buzz') off += 0.007 * Math.sin(az * 28) * m; // strand grooves
      if (hat) off = Math.min(off, 0.05);
      return 0.985 + (off + 0.015) * m;
    }, 128, 84);
  }, [st, h, c.accessories.hat]);

  const drape = useMemo(() => {
    if (st !== 'long' && st !== 'wavy') return null;
    const L = st === 'long' ? 0.95 : 0.5;
    const g = new THREE.CylinderGeometry(h.rx * 0.96, h.rx * (st === 'long' ? 1.12 : 1.06), L, 56, 12, true, Math.PI * 0.4, Math.PI * 1.2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const t = 0.5 - y / L; // 0 top → 1 bottom
      const th = Math.atan2(x, z);
      const k = (1 + (st === 'wavy' ? 0.05 * Math.sin(t * 9 + th * 2) : 0.015 * Math.sin(th * 16)) * t) * (1 - 0.18 * t * Math.cos(th) * (Math.cos(th) > 0 ? 1 : 0));
      p.setXYZ(i, x * k, y, z * k * ((h.rz * 1.07) / h.rx));
    }
    g.computeVertexNormals();
    g.translate(0, -L / 2 - 0.02, -0.02);
    return g;
  }, [st, h]);

  const tail = useMemo(() => (st === 'ponytail' ? lathe([[0.005, -0.62], [0.045, -0.5], [0.075, -0.32], [0.085, -0.14], [0.06, -0.02], [0.03, 0.02]], 28) : null), [st]);

  const braids = useMemo(() => {
    if (st !== 'braids') return null;
    return [-1, 1].map((s) => {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(s * h.rx * 0.82, -0.1, -0.05), new THREE.Vector3(s * h.rx * 0.95, -0.35, 0.02), new THREE.Vector3(s * h.rx * 0.8, -0.7, 0.14)]);
      return Array.from({ length: 11 }, (_, i) => curve.getPoint(i / 10));
    });
  }, [st, h]);

  if (st === 'bald') return null;
  const buzzCol = st === 'buzz' ? mix(col, '#6b5446', 0.15) : col;
  return (
    <group>
      {shell && (
        <mesh geometry={shell} castShadow>
          <HairMat color={buzzCol} />
        </mesh>
      )}
      {drape && (
        <mesh geometry={drape} castShadow>
          <meshPhysicalMaterial color={col} roughness={0.45} sheen={0.8} sheenColor={mix(col, '#ffffff', 0.35)} side={THREE.DoubleSide} />
        </mesh>
      )}
      {st === 'bun' && (
        <mesh position={[0, h.ry * 0.95, -h.rz * 0.42]} scale={[0.15, 0.13, 0.14]} castShadow>
          <sphereGeometry args={[1, 28, 20]} />
          <HairMat color={col} />
        </mesh>
      )}
      {tail && (
        <group position={[0, 0.06, -h.rz * 1.02]} rotation={[0.42, 0, 0]}>
          <mesh geometry={tail} castShadow>
            <HairMat color={col} />
          </mesh>
          <mesh position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.05, 0.014, 8, 20]} />
            <meshStandardMaterial color="#ff7a3d" roughness={0.5} />
          </mesh>
        </group>
      )}
      {braids?.map((pts, bi) => (
        <group key={bi}>
          {pts.map((p, i) => (
            <mesh key={i} position={p} rotation={[0, 0, (i % 2 ? 0.5 : -0.5) * (bi ? 1 : -1)]} scale={[0.05 - i * 0.0015, 0.042, 0.045 - i * 0.0012]} castShadow>
              <sphereGeometry args={[1, 14, 10]} />
              <HairMat color={col} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Glasses & hats                                                       */
/* ------------------------------------------------------------------ */

function Glasses({ c, h, ex, ey, er }: { c: AvatarConfig; h: HeadShape; ex: number; ey: number; er: number }) {
  const g = c.accessories.glasses;
  if (g === 'none') return null;
  const z = surfaceZ(h, ex, ey) + er * 0.75;
  const R = er * 1.5;
  const frame = g === 'sunglasses' ? '#15100d' : g === 'round' ? '#b8893c' : '#1d1714';
  return (
    <group position={[0, ey, z]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * ex, 0, 0]}>
          <mesh rotation={[0, 0, g === 'square' ? Math.PI / 4 : 0]} scale={g === 'square' ? [1.12, 0.85, 1] : [1, 1, 1]}>
            <torusGeometry args={[R, g === 'round' ? 0.0065 : 0.009, 8, g === 'square' ? 4 : 36]} />
            <meshStandardMaterial color={frame} metalness={g === 'round' ? 0.85 : 0.2} roughness={0.3} />
          </mesh>
          <mesh rotation={[0, 0, g === 'square' ? Math.PI / 4 : 0]} scale={g === 'square' ? [1.12, 0.85, 1] : [1, 1, 1]}>
            <circleGeometry args={[R, g === 'square' ? 4 : 36]} />
            <meshPhysicalMaterial color={g === 'sunglasses' ? '#2a1a14' : '#ffffff'} transparent opacity={g === 'sunglasses' ? 0.9 : 0.08} roughness={0.05} metalness={g === 'sunglasses' ? 0.3 : 0} depthWrite={false} />
          </mesh>
          {/* temple arm back to the ear */}
          <mesh position={[s * (h.rx - ex) * 0.55 + s * R * 0.5, 0.01, -z * 0.5]} rotation={[0, s * -1.35, 0]}>
            <boxGeometry args={[z * 1.05, 0.008, 0.006]} />
            <meshStandardMaterial color={frame} metalness={0.4} roughness={0.35} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.012, 0]}>
        <boxGeometry args={[ex * 2 - R * 2 + 0.01, 0.008, 0.008]} />
        <meshStandardMaterial color={frame} metalness={0.5} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Hat({ c, h }: { c: AvatarConfig; h: HeadShape }) {
  const kind = c.accessories.hat;
  const geo = useMemo(() => {
    if (kind === 'none') return null;
    return shellGeometry(h, (ux, uy) => {
      const m = smooth(kind === 'cap' ? 0.2 : 0.12, kind === 'cap' ? 0.3 : 0.22, uy);
      const knit = kind === 'beanie' ? 0.008 * Math.sin(Math.atan2(ux, 1) * 0 + uy * 60) : 0;
      return 0.98 + (kind === 'cap' ? 0.11 : 0.14 + knit) * m;
    }, 72, 48);
  }, [kind, h]);
  if (!geo) return null;
  const col = c.outfit.topColor === '#16161f' ? '#ff7a3d' : shade(c.outfit.topColor, -0.06);
  return (
    <group rotation={[-0.12, 0, 0]}>
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial color={col} roughness={0.85} sheen={1} sheenColor={mix(col, '#ffffff', 0.3)} />
      </mesh>
      {kind === 'cap' && (
        <mesh position={[0, h.ry * 0.3, h.rz * 0.92]} rotation={[0.28, 0, 0]} scale={[1, 0.08, 1]}>
          <cylinderGeometry args={[h.rx * 0.78, h.rx * 0.78, 0.12, 40, 1, false, -Math.PI / 2, Math.PI]} />
          <meshStandardMaterial color={shade(col, -0.08)} roughness={0.7} />
        </mesh>
      )}
      {kind === 'beanie' && (
        <mesh position={[0, h.ry * 1.18, -0.02]} castShadow>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshPhysicalMaterial color={mix(col, '#ffffff', 0.3)} roughness={1} sheen={1} />
        </mesh>
      )}
    </group>
  );
}
