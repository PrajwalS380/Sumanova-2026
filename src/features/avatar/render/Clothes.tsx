import { useMemo } from 'react';
import * as THREE from 'three';
import { lathe, mix, wobble } from '../sculpt';
import type { Wear } from '../look/fashion';
import type { BodyP } from '../look/face';
import { fabric } from './patterns';
import { taperTube } from '../look/tube';

/* ------------------------------------------------------------------ helpers */

export function scaleUV(g: THREE.BufferGeometry, su: number, sv: number) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined;
  if (!uv) return g;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
}

export function Cloth({ w, color, rough = 0.8, side, shade = 0, repeat }: { w?: Wear | null; color?: string; rough?: number; side?: THREE.Side; shade?: number; repeat?: never }) {
  void repeat;
  const map = useMemo(() => (w && w.pattern !== 'solid' ? fabric(w.pattern, w.c1, w.c2, w.c3) : null), [w]);
  const base = color ?? w?.c1 ?? '#888888';
  const c = shade ? mix(base, shade > 0 ? '#ffffff' : '#000000', Math.abs(shade)) : base;
  return <meshPhysicalMaterial map={map} color={map ? (shade ? mix('#ffffff', shade > 0 ? '#ffffff' : '#000000', Math.abs(shade)) : '#ffffff') : c} roughness={rough} sheen={0.9} sheenRoughness={0.7} sheenColor={mix(base, '#ffffff', 0.3)} side={side} />;
}

/** Torso silhouette (radius, y) bottom → top for a given body; `pad` inflates for layering. */
export function torsoProfile(body: BodyP, from: number, pad = 0): [number, number][] {
  const sh = body.shoulders, hp = body.hips, bl = body.belly;
  const pts: [number, number][] = [
    [0.25 * hp, 0.82], [0.258 * hp, 0.9], [0.252 * hp + bl * 0.03, 0.98], [0.24 + bl * 0.05, 1.08], [0.236 + bl * 0.045, 1.16],
    [0.248 + bl * 0.02, 1.28], [0.268 * sh, 1.42], [0.262 * sh, 1.52], [0.21 * sh, 1.6], [0.13, 1.645], [0.085, 1.66],
  ];
  return pts.filter(([, y]) => y >= from - 1e-6).map(([r, y]) => [r + pad, y] as [number, number]);
}

/* ------------------------------------------------------------------ tops & outerwear */

export interface GarmentProps { w: Wear; body: BodyP; layer: 0 | 1 }

/** Body of a top/outer garment (sleeves are rendered on the arms). */
export function TorsoGarment({ w, body, layer }: GarmentProps) {
  const cut = w.cut;
  const pad = layer ? (cut === 'Puffer' || cut === 'Shaggy coat' ? 0.03 : 0.022) : 0.006;
  const geo = useMemo(() => {
    const hem = { 'Crop top': 1.2, Tank: 0.95, 'Boxy tee': 0.9, Sweatshirt: 0.93, Trench: 0.42, 'Shaggy coat': 0.62, Puffer: 0.86, Hoodie: 0.9, 'Zip hoodie': 0.9, Blazer: 0.84, Biker: 0.95, Bomber: 0.95, Varsity: 0.94, 'Denim jacket': 0.92 }[cut] ?? 0.95;
    let pts = torsoProfile(body, Math.max(hem, 0.82), pad);
    if (hem < 0.82) {
      const r0 = pts[0][0];
      const extra: [number, number][] = [];
      for (let y = hem; y < 0.82; y += 0.08) extra.push([r0 + (0.82 - y) * (cut === 'Trench' ? 0.16 : 0.1), y]);
      pts = [...extra, ...pts];
    }
    if (cut === 'Boxy tee' || cut === 'Sweatshirt' || cut === 'Hoodie') pts = pts.map(([r, y]) => [y < 1.4 ? Math.max(r, 0.27 * body.shoulders) + 0.01 : r, y]);
    const open = cut === 'Blazer' || cut === 'Denim jacket' || cut === 'Biker' || cut === 'Zip hoodie' || cut === 'Trench' || cut === 'Shaggy coat';
    const g = open ? lathe(pts, 64, 0.32, Math.PI * 2 - 0.64) : lathe(pts, 64);
    // puffer quilting / fur
    if (cut === 'Puffer' || cut === 'Shaggy coat' || cut === 'Bomber') {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const rr = Math.hypot(x, z);
        if (rr < 1e-4) continue;
        let k = 1;
        if (cut === 'Puffer') k += 0.06 + 0.1 * Math.pow(Math.abs(Math.sin(((y - hem) / 0.13) * Math.PI)), 0.6);
        if (cut === 'Bomber') k += 0.025 * Math.abs(Math.sin(((y - hem) / 0.2) * Math.PI));
        if (cut === 'Shaggy coat') k += 0.05 + 0.06 * wobble(x * 6, y * 6, z * 6, 1.6) + 0.03 * Math.sin(Math.atan2(x, z) * 23 + y * 40);
        p.setXYZ(i, x * k, y, z * k);
      }
      g.computeVertexNormals();
    }
    return scaleUV(g, 3, 2.5);
  }, [cut, body, pad]);
  const open = cut === 'Blazer' || cut === 'Denim jacket' || cut === 'Biker' || cut === 'Zip hoodie' || cut === 'Trench' || cut === 'Shaggy coat';
  const dark = mix(w.c1, '#000000', 0.18);
  return (
    <group>
      <mesh geometry={geo} scale={[body.width, 1, 0.68]} castShadow>
        <Cloth w={w} rough={cut === 'Biker' ? 0.35 : cut === 'Puffer' ? 0.45 : 0.82} side={open ? THREE.DoubleSide : undefined} />
      </mesh>
      <Details w={w} body={body} dark={dark} />
    </group>
  );
}

function Details({ w, body, dark }: { w: Wear; body: BodyP; dark: string }) {
  const cut = w.cut;
  const bw = body.width;
  const z = (y: number) => 0.68 * (0.25 + (y > 1.3 ? 0.02 : 0)) + 0.012;
  const items: JSX.Element[] = [];
  const neck = (r: number, t: number, col: string) => (
    <mesh key="neck" position={[0, 1.635, 0.02]} rotation={[Math.PI / 2 + 0.25, 0, 0]} scale={[bw, 0.75, 1]}>
      <torusGeometry args={[r, t, 8, 32]} />
      <Cloth color={col} />
    </mesh>
  );
  const placket = (from: number, to: number, col: string, buttons: number) => (
    <group key="placket">
      <mesh position={[0, (from + to) / 2, z((from + to) / 2) * bw]}>
        <boxGeometry args={[0.03, to - from, 0.006]} />
        <Cloth color={col} />
      </mesh>
      {Array.from({ length: buttons }).map((_, i) => (
        <mesh key={i} position={[0, to - 0.04 - i * ((to - from - 0.06) / Math.max(1, buttons - 1)), z(to) * bw + 0.006]}>
          <sphereGeometry args={[0.008, 8, 6]} />
          <meshStandardMaterial color="#f4ede4" />
        </mesh>
      ))}
    </group>
  );
  const collar = (col: string, spread = 0.9) =>
    [-1, 1].map((s) => (
      <mesh key={'c' + s} position={[s * 0.06, 1.615, 0.1]} rotation={[0.5, s * 0.5, s * spread]} scale={[1, 1, 0.25]}>
        <coneGeometry args={[0.058, 0.11, 3]} />
        <Cloth color={col} />
      </mesh>
    ));
  const hood = (col: string) => (
    <mesh key="hood" position={[0, 1.6, -0.08]} rotation={[1.1, 0, 0]} scale={[bw, 1, 0.9]}>
      <torusGeometry args={[0.15, 0.065, 14, 36]} />
      <Cloth color={col} />
    </mesh>
  );
  const lapels = (col: string, wide = 1) =>
    [-1, 1].map((s) => (
      <mesh key={'l' + s} position={[s * 0.095 * bw, 1.42, 0.185 * bw]} rotation={[-0.12, s * -0.25, s * 0.38]}>
        <boxGeometry args={[0.07 * wide, 0.3, 0.012]} />
        <Cloth color={col} />
      </mesh>
    ));
  const band = (y: number, col: string, r = 0.27) => (
    <mesh key={'b' + y} position={[0, y, 0]} scale={[bw, 1, 0.68]}>
      <cylinderGeometry args={[r * body.hips, r * body.hips, 0.05, 40, 1, true]} />
      <Cloth color={col} side={THREE.DoubleSide} />
    </mesh>
  );
  switch (cut) {
    case 'Tee':
    case 'Boxy tee':
    case 'Long sleeve':
    case 'Crop top':
      items.push(neck(0.105, 0.014, dark));
      break;
    case 'V-neck':
      items.push(
        <mesh key="v" position={[0, 1.57, 0.178 * bw]} rotation={[-0.15, 0, Math.PI]}>
          <circleGeometry args={[0.06, 3]} />
          <meshStandardMaterial color={dark} />
        </mesh>,
      );
      break;
    case 'Polo':
      items.push(...collar(mix(w.c1, '#ffffff', 0.08), 1.1), placket(1.48, 1.62, mix(w.c1, '#000000', 0.08), 2));
      break;
    case 'Shirt':
      items.push(...collar(mix(w.c1, '#ffffff', 0.1)), placket(0.98, 1.6, mix(w.c1, '#000000', 0.05), 5));
      break;
    case 'Lounge shirt':
      items.push(...collar(w.c1), placket(0.98, 1.6, w.c1, 5));
      items.push(
        <mesh key="pocket" position={[-0.11 * bw, 1.42, 0.18 * bw]}>
          <boxGeometry args={[0.08, 0.08, 0.006]} />
          <Cloth w={w} />
        </mesh>,
      );
      break;
    case 'Sweatshirt':
      items.push(neck(0.11, 0.02, dark), band(0.95, dark));
      break;
    case 'Tank':
      items.push(neck(0.12, 0.01, dark));
      break;
    case 'Puffer':
      items.push(
        <mesh key="collar" position={[0, 1.62, 0]} scale={[bw, 1, 0.75]}>
          <cylinderGeometry args={[0.15, 0.2, 0.12, 32, 1, true]} />
          <Cloth w={w} side={THREE.DoubleSide} />
        </mesh>,
        placket(0.9, 1.66, dark, 0),
      );
      break;
    case 'Bomber':
      items.push(neck(0.12, 0.024, dark), band(0.96, dark, 0.272), placket(0.97, 1.6, '#c8ccd2', 0));
      break;
    case 'Varsity':
      items.push(neck(0.12, 0.024, w.c3), band(0.95, w.c3, 0.272), placket(0.96, 1.6, w.c3, 5));
      break;
    case 'Denim jacket':
      items.push(...collar(dark, 1.1), ...[-1, 1].map((s) => (
        <mesh key={'p' + s} position={[s * 0.11 * bw, 1.42, 0.186 * bw]}>
          <boxGeometry args={[0.085, 0.07, 0.008]} />
          <Cloth color={dark} />
        </mesh>
      )));
      break;
    case 'Biker':
      items.push(...lapels(dark, 1.3), <mesh key="zip" position={[0.04, 1.25, 0.19 * bw]} rotation={[0, 0, 0.12]}><boxGeometry args={[0.008, 0.55, 0.006]} /><meshStandardMaterial color="#d6d9de" metalness={0.9} roughness={0.2} /></mesh>);
      break;
    case 'Blazer':
    case 'Trench':
      items.push(...lapels(dark, cut === 'Trench' ? 1.4 : 1));
      if (cut === 'Trench') items.push(band(1.06, dark, 0.262));
      break;
    case 'Zip hoodie':
    case 'Hoodie':
      items.push(hood(dark));
      items.push(...[-1, 1].map((s) => (
        <mesh key={'s' + s} position={[s * 0.045, 1.46, 0.174 * bw]}>
          <capsuleGeometry args={[0.006, 0.12, 3, 6]} />
          <meshStandardMaterial color="#f4ede4" />
        </mesh>
      )));
      if (cut === 'Hoodie')
        items.push(
          <mesh key="pocket" position={[0, 1.08, 0.165 * bw]} rotation={[0, 0, Math.PI / 2]} scale={[0.55, bw, 0.1]}>
            <capsuleGeometry args={[0.1, 0.18, 6, 16]} />
            <Cloth color={dark} />
          </mesh>,
        );
      break;
    case 'Shaggy coat': {
      items.push(...lapels(mix(w.c1, '#ffffff', 0.06), 1.6));
      break;
    }
    default:
      break;
  }
  return <>{items}</>;
}

export function sleeveStyle(cut: string): { len: 'none' | 'short' | 'elbow' | 'long'; puff: number; wide: number } {
  if (cut === 'Tank' || cut === 'Slip') return { len: 'none', puff: 0, wide: 1 };
  if (cut === 'Tee' || cut === 'V-neck' || cut === 'Polo' || cut === 'Crop top' || cut === 'Saree' || cut === 'Lehenga' || cut === 'Bodycon' || cut === 'Tiered') return { len: 'short', puff: 0, wide: 1 };
  if (cut === 'Boxy tee') return { len: 'elbow', puff: 0, wide: 1.25 };
  if (cut === 'Puffer') return { len: 'long', puff: 0.35, wide: 1.4 };
  if (cut === 'Shaggy coat') return { len: 'long', puff: 0.25, wide: 1.45 };
  if (cut === 'Bomber' || cut === 'Sweatshirt' || cut === 'Hoodie' || cut === 'Zip hoodie') return { len: 'long', puff: 0.1, wide: 1.2 };
  return { len: 'long', puff: 0, wide: 1.08 };
}

/* ------------------------------------------------------------------ dresses */

export function DressGarment({ w, body }: { w: Wear; body: BodyP }) {
  const cut = w.cut;
  const geo = useMemo(() => {
    const hem = { Slip: 0.48, 'A-line': 0.5, Maxi: 0.06, Saree: 0.05, Lehenga: 0.05, Bodycon: 0.5, 'Shirt dress': 0.45, Anarkali: 0.08, Tiered: 0.3, Wrap: 0.44 }[cut] ?? 0.5;
    const flare = { Slip: 0.06, 'A-line': 0.16, Maxi: 0.14, Saree: 0.08, Lehenga: 0.3, Bodycon: -0.03, 'Shirt dress': 0.09, Anarkali: 0.34, Tiered: 0.2, Wrap: 0.1 }[cut] ?? 0.1;
    const top = torsoProfile(body, 0.98, 0.006);
    const waistR = top[0][0];
    const skirt: [number, number][] = [];
    for (let y = hem; y < 0.98; y += 0.06) {
      const t = (0.98 - y) / (0.98 - hem);
      skirt.push([waistR + flare * t + (cut === 'Tiered' ? 0.03 * Math.floor(t * 3) : 0), y]);
    }
    const g = lathe([...skirt, ...top], 72);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y > 0.98) continue;
      const k = 1 + (0.02 + flare * 0.1) * Math.sin(Math.atan2(x, z) * 18) * ((0.98 - y) / 0.98);
      p.setXYZ(i, x * k, y, z * k);
    }
    g.computeVertexNormals();
    return scaleUV(g, 3, 4);
  }, [cut, body]);
  const sash = useMemo(() => {
    if (cut !== 'Saree' && cut !== 'Wrap') return null;
    const pts = cut === 'Saree' ? [[0.2, 0.95, 0.18], [0.06, 1.2, 0.2], [-0.12, 1.46, 0.16], [-0.24, 1.6, 0.0], [-0.2, 1.42, -0.18], [-0.1, 1.0, -0.2], [-0.04, 0.6, -0.24]] : [[0.18, 1.0, 0.18], [0.0, 1.0, 0.2], [-0.2, 1.0, 0.16], [-0.24, 0.85, 0.12]];
    return scaleUV(taperTube(pts.map((p) => new THREE.Vector3(...(p as [number, number, number]))), { radius: () => (cut === 'Saree' ? 0.062 : 0.025), flat: 0.35, radial: 10, segments: 48 }), 1, 1);
  }, [cut]);
  return (
    <group>
      <mesh geometry={geo} scale={[body.width, 1, 0.7]} castShadow>
        <Cloth w={w} side={THREE.DoubleSide} />
      </mesh>
      {sash && (
        <mesh geometry={sash} scale={[body.width, 1, 1]} castShadow>
          <Cloth color={mix(w.c1, w.c2, 0.5)} />
        </mesh>
      )}
      {cut === 'Lehenga' && (
        <mesh position={[0, 1.02, 0]} scale={[body.width, 1, 0.7]}>
          <cylinderGeometry args={[0.245, 0.245, 0.05, 48, 1, true]} />
          <meshStandardMaterial color="#e9c46a" metalness={0.6} roughness={0.35} side={THREE.DoubleSide} />
        </mesh>
      )}
      {cut === 'Shirt dress' && (
        <mesh position={[0, 1.04, 0]} scale={[body.width, 1, 0.7]}>
          <cylinderGeometry args={[0.243, 0.243, 0.04, 48, 1, true]} />
          <Cloth color={mix(w.c1, '#000000', 0.25)} side={THREE.DoubleSide} />
        </mesh>
      )}
      {cut === 'Slip' &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.12 * body.width, 1.58, 0.02]} rotation={[0, 0, s * 0.15]}>
            <boxGeometry args={[0.012, 0.14, 0.012]} />
            <Cloth color={w.c1} />
          </mesh>
        ))}
    </group>
  );
}

/* ------------------------------------------------------------------ pants */

export function pantsStyle(cut: string) {
  return {
    thighR: { 'Skinny jeans': 0.095, 'Baggy jeans': 0.13, 'Wide trousers': 0.13, Cargo: 0.12, Joggers: 0.115, 'Lounge pants': 0.12 }[cut] ?? 0.108,
    ankleR: { 'Skinny jeans': 0.07, 'Flared jeans': 0.135, 'Baggy jeans': 0.125, 'Wide trousers': 0.145, Joggers: 0.075, Cargo: 0.105, 'Lounge pants': 0.11 }[cut] ?? 0.095,
    short: cut === 'Shorts',
    cuff: cut === 'Joggers',
    cargo: cut === 'Cargo',
  };
}

/** Pant leg segment as a tapered tube between y0 (top) and y1 (bottom) in the leg's local space. */
export function PantLeg({ w, r0, r1, y0, y1, flareOut = 0 }: { w: Wear; r0: number; r1: number; y0: number; y1: number; flareOut?: number }) {
  const geo = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push([r1 + (r0 - r1) * t + (flareOut > 0 ? flareOut * (1 - t) ** 3 : 0), y1 + (y0 - y1) * t]);
    }
    return scaleUV(lathe(pts, 28, 0, Math.PI * 2), 1.5, 1.5);
  }, [r0, r1, y0, y1, flareOut]);
  return (
    <mesh geometry={geo} castShadow>
      <Cloth w={w} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ shoes & socks */

export function Shoe({ w, skin }: { w: Wear; skin: string }) {
  const cut = w.cut;
  const c1 = w.c1, c2 = w.c2;
  const sole = cut === 'Loafer' ? mix(c1, '#000000', 0.3) : cut === 'Chelsea boot' || cut === 'Combat boot' ? '#2a1d16' : cut === 'Cosy slipper' ? mix(c1, '#ffffff', 0.7) : '#f4ede4';
  const tall = cut === 'Chelsea boot' ? 0.12 : cut === 'Combat boot' ? 0.18 : cut === 'High-top' ? 0.1 : 0;
  if (cut === 'Sandal' || cut === 'Slide') {
    return (
      <group position={[0, -0.415, 0.035]}>
        <mesh scale={[0.07, 0.045, 0.13]} castShadow>
          <sphereGeometry args={[1, 18, 12]} />
          <meshPhysicalMaterial color={skin} roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.042, 0]} scale={[0.085, 0.018, 0.15]}>
          <sphereGeometry args={[1, 18, 8]} />
          <meshStandardMaterial color={c2 === c1 ? mix(c1, '#000000', 0.3) : c2} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.005, cut === 'Slide' ? 0.035 : 0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, cut === 'Slide' ? 1.4 : 0.5]}>
          <torusGeometry args={[0.068, cut === 'Slide' ? 0.026 : 0.012, 8, 24, Math.PI]} />
          <Cloth w={w} rough={0.5} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[0, -0.435, 0.04]}>
      {tall > 0 && (
        <mesh position={[0, tall / 2 + 0.02, -0.035]}>
          <cylinderGeometry args={[0.093, 0.097, tall, 24]} />
          <Cloth w={w} rough={cut === 'Chelsea boot' ? 0.4 : 0.7} />
        </mesh>
      )}
      <mesh scale={[cut === 'Cosy slipper' ? 0.1 : 0.09, cut === 'Loafer' ? 0.058 : cut === 'Cosy slipper' ? 0.08 : 0.07, cut === 'Runner' ? 0.168 : 0.16]} castShadow>
        <sphereGeometry args={[1, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <Cloth w={w} rough={cut === 'Loafer' || cut === 'Chelsea boot' ? 0.3 : 0.75} />
      </mesh>
      {cut === 'Cosy slipper' && (
        <mesh position={[0, 0.045, -0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.4, 1]}>
          <torusGeometry args={[0.07, 0.026, 10, 24]} />
          <meshPhysicalMaterial color="#f6f1ea" roughness={1} sheen={1} />
        </mesh>
      )}
      {(cut === 'Low sneaker' || cut === 'High-top' || cut === 'Runner' || cut === 'Combat boot') &&
        [0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.05 - i * 0.004, 0.03 + i * 0.028]} rotation={[0.35, 0, 0]}>
            <boxGeometry args={[0.06, 0.006, 0.01]} />
            <meshStandardMaterial color={cut === 'Combat boot' ? '#1d1917' : '#f6f1ea'} />
          </mesh>
        ))}
      {(cut === 'Low sneaker' || cut === 'High-top') && (
        <mesh position={[0.088, 0.012, 0.0]} rotation={[0, Math.PI / 2, 0.15]} scale={[1.6, 0.5, 1]}>
          <torusGeometry args={[0.022, 0.006, 6, 18, Math.PI]} />
          <meshStandardMaterial color={c2} />
        </mesh>
      )}
      <mesh position={[0, -0.022, 0]} scale={[0.094, cut === 'Runner' ? 0.032 : 0.025, 0.168]} castShadow>
        <sphereGeometry args={[1, 24, 10]} />
        <meshStandardMaterial color={sole} roughness={0.7} />
      </mesh>
    </group>
  );
}

export function Sock({ w, height }: { w: Wear; height: number }) {
  const geo = useMemo(() => scaleUV(lathe([[0.084, 0], [0.086, height * 0.5], [0.088, height]], 24), 1.5, 1.5), [height]);
  return (
    <mesh geometry={geo} position={[0, -0.43, 0]}>
      <Cloth w={w} />
    </mesh>
  );
}
export const sockHeight = (cut: string) => ({ Ankle: 0.06, Trainer: 0.04, Crew: 0.16, 'Sport crew': 0.17, 'Ribbed crew': 0.16, Slouch: 0.14, Calf: 0.24, Knee: 0.36, 'Sport knee': 0.36, 'Over-knee': 0.44 }[cut] ?? 0.16);

/* ------------------------------------------------------------------ bags */

export function Bag({ w, width }: { w: Wear; width: number }) {
  const cut = w.cut;
  const strap = useMemo(() => {
    const pts = cut === 'Backpack' ? null : cut === 'Belt bag' ? [[0.27, 1.06, 0.12], [0, 1.08, 0.2], [-0.27, 1.06, 0.12]] : cut === 'Clutch' || cut === 'Mini top-handle' || cut === 'Tote' || cut === 'Bowling' || cut === 'Duffle' ? null : [[0.2, 1.58, 0.08], [0.0, 1.32, 0.2], [-0.25, 1.0, 0.17], [-0.32, 0.95, 0.0]];
    return pts ? taperTube(pts.map((p) => new THREE.Vector3(p[0] * width, p[1], p[2])), { radius: () => 0.011, flat: 0.4, radial: 6, segments: 32 }) : null;
  }, [cut, width]);
  const body: Record<string, [number, number, number, number, number, number]> = {
    // w, h, d, x, y, z
    Crossbody: [0.2, 0.15, 0.07, -0.32, 0.9, 0.06],
    Tote: [0.28, 0.3, 0.09, -0.4, 0.95, 0.04],
    Backpack: [0.36, 0.42, 0.16, 0, 1.3, -0.25],
    Baguette: [0.26, 0.11, 0.06, -0.31, 1.08, 0.06],
    Bucket: [0.18, 0.22, 0.18, -0.34, 0.92, 0.04],
    'Belt bag': [0.24, 0.1, 0.07, 0, 1.06, 0.21],
    Clutch: [0.22, 0.12, 0.04, -0.36, 0.75, 0.08],
    Duffle: [0.42, 0.2, 0.2, -0.46, 0.7, 0.0],
    Bowling: [0.3, 0.2, 0.14, -0.42, 0.78, 0.04],
    'Mini top-handle': [0.18, 0.14, 0.08, -0.4, 0.78, 0.06],
  };
  const [bw, bh, bd, x, y, z] = body[cut] ?? body.Crossbody;
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 28, 18);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      // superellipsoid for a soft boxy bag
      const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i);
      const f = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), cut === 'Bucket' || cut === 'Duffle' || cut === 'Bowling' ? 0.7 : 0.4);
      p.setXYZ(i, f(X) * bw / 2, f(Y) * bh / 2, f(Z) * bd / 2);
    }
    g.computeVertexNormals();
    return scaleUV(g, 2, 2);
  }, [cut, bw, bh, bd]);
  const handle = cut === 'Tote' || cut === 'Mini top-handle' || cut === 'Bowling' || cut === 'Duffle' || cut === 'Bucket';
  return (
    <group>
      {strap && (
        <mesh geometry={strap}>
          <meshStandardMaterial color={mix(w.c1, '#000000', 0.25)} roughness={0.5} />
        </mesh>
      )}
      <group position={[x * width, y, z]}>
        <mesh geometry={geo} castShadow>
          <Cloth w={w} rough={0.45} />
        </mesh>
        {cut === 'Backpack' &&
          [-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.1, 0.02, 0.1]} rotation={[0.2, 0, 0]}>
              <boxGeometry args={[0.04, 0.4, 0.015]} />
              <meshStandardMaterial color={mix(w.c1, '#000000', 0.25)} />
            </mesh>
          ))}
        {handle && (
          <mesh position={[0, bh / 2 + 0.02, 0]}>
            <torusGeometry args={[bw * 0.3, 0.008, 8, 24, Math.PI]} />
            <meshStandardMaterial color={mix(w.c1, '#000000', 0.25)} />
          </mesh>
        )}
        <mesh position={[0, bh * 0.15, bd / 2 + 0.002]}>
          <boxGeometry args={[bw * 0.25, 0.012, 0.004]} />
          <meshStandardMaterial color={w.c3} metalness={0.8} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}
