import { useMemo } from 'react';
import * as THREE from 'three';
import { mix, shellGeometry, smooth, surfaceZ, type HeadShape } from '../sculpt';
import type { Wear } from '../look/fashion';
import type { HeadExtraP } from '../look/extras';
import { Cloth, scaleUV } from './Clothes';
import { taperTube, arc } from '../look/tube';

/* ------------------------------------------------------------------ glasses */

export function Glasses({ w, h, ex, ey, er }: { w: Wear; h: HeadShape; ex: number; ey: number; er: number }) {
  const cut = w.cut;
  const z = surfaceZ(h, ex, ey) + er * 0.78;
  const R = er * (cut === 'Oversized' ? 1.9 : cut === 'Round' ? 1.45 : 1.6);
  const lensTex = useMemo(() => lensGradient(w.c2, w.c3), [w.c2, w.c3]);
  const clear = w.c2 === '#ffffff';
  const frameMat = <meshPhysicalMaterial color={w.c1} metalness={cut === 'Aviator' || cut === 'Rimless' || cut === 'Round' ? 0.85 : 0.15} roughness={0.25} clearcoat={0.8} />;
  const lensMat = <meshPhysicalMaterial map={clear ? null : lensTex} color="#ffffff" transparent opacity={clear ? 0.08 : 0.88} roughness={0.05} metalness={cut === 'Shield visor' || w.c3 === '#f6f6f8' ? 0.5 : 0.1} clearcoat={1} depthWrite={false} side={THREE.DoubleSide} />;
  const shape = (s: number): THREE.Shape => {
    const sh = new THREE.Shape();
    if (cut === 'Heart') {
      const k = R * 1.05;
      sh.moveTo(0, -k * 0.85);
      sh.bezierCurveTo(-k * 1.4, -k * 0.05, -k * 0.6, k * 1.05, 0, k * 0.35);
      sh.bezierCurveTo(k * 0.6, k * 1.05, k * 1.4, -k * 0.05, 0, -k * 0.85);
      return sh;
    }
    if (cut === 'Square' || cut === 'Browline') return roundRect(sh, R * 2.1, R * 1.6, R * 0.35);
    if (cut === 'Cat-eye') {
      sh.moveTo(-R * 1.05 * s, R * 0.2);
      sh.quadraticCurveTo(0, R * 0.95, R * 1.15 * s, R * 0.75);
      sh.quadraticCurveTo(R * 1.1 * s, -R * 0.9, 0, -R * 0.85);
      sh.quadraticCurveTo(-R * 1.15 * s, -R * 0.7, -R * 1.05 * s, R * 0.2);
      return sh;
    }
    if (cut === 'Aviator') {
      sh.moveTo(-R, R * 0.6);
      sh.lineTo(R, R * 0.6);
      sh.quadraticCurveTo(R * 1.15, -R * 0.4, R * 0.2, -R * 1.0);
      sh.quadraticCurveTo(-R * 0.9, -R * 1.05, -R, R * 0.6);
      return sh;
    }
    return sh.absellipse(0, 0, R * (cut === 'Sport wrap' ? 1.25 : 1), R * (cut === 'Sport wrap' ? 0.7 : 1), 0, Math.PI * 2, false, 0);
  };
  if (cut === 'Shield visor' || cut === 'Sport wrap') {
    const width = ex * 2 + R * 2.4;
    return (
      <group position={[0, ey + 0.004, z - 0.02]}>
        <mesh>
          <cylinderGeometry args={[width * 0.62, width * 0.62, R * (cut === 'Shield visor' ? 2 : 1.5), 48, 1, true, -0.95, 1.9]} />
          {lensMat}
        </mesh>
        <mesh position={[0, R * (cut === 'Shield visor' ? 1 : 0.75), 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[width * 0.62, 0.006, 6, 48, 1.9]} />
          {frameMat}
        </mesh>
        <Temples h={h} z={z - 0.02} x={width * 0.5} mat={frameMat} />
      </group>
    );
  }
  return (
    <group position={[0, ey, z]}>
      {[-1, 1].map((s) => {
        const sh = shape(s);
        return (
          <group key={s} position={[s * ex, 0, 0]}>
            {cut !== 'Rimless' && (
              <mesh>
                <extrudeGeometry args={[ringShape(sh, cut === 'Round' || cut === 'Aviator' ? 0.006 : 0.01), { depth: 0.006, bevelEnabled: false, curveSegments: 24 }]} />
                {frameMat}
              </mesh>
            )}
            {cut === 'Browline' && (
              <mesh position={[0, R * 0.62, 0.004]}>
                <boxGeometry args={[R * 2.1, R * 0.32, 0.012]} />
                <meshStandardMaterial color="#1d1917" roughness={0.3} />
              </mesh>
            )}
            <mesh position={[0, 0, 0.002]}>
              <shapeGeometry args={[sh, 24]} />
              {lensMat}
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, R * 0.25, 0.004]}>
        <boxGeometry args={[Math.max(0.01, ex * 2 - R * 2 + 0.012), 0.008, 0.008]} />
        {frameMat}
      </mesh>
      {cut === 'Aviator' && (
        <mesh position={[0, R * 0.6, 0.004]}>
          <boxGeometry args={[ex * 2 - R * 1.6, 0.005, 0.005]} />
          {frameMat}
        </mesh>
      )}
      <Temples h={h} z={z} x={ex + R} mat={frameMat} />
    </group>
  );
}

function Temples({ h, z, x, mat }: { h: HeadShape; z: number; x: number; mat: JSX.Element }) {
  return (
    <>
      {[-1, 1].map((s) => {
        const from = new THREE.Vector3(s * x, 0.01, 0);
        const to = new THREE.Vector3(s * h.rx * 1.0, 0.0, -z - 0.02);
        const len = from.distanceTo(to);
        const mid = from.clone().lerp(to, 0.5);
        return (
          <mesh key={s} position={mid} rotation={[0, Math.atan2(to.x - from.x, to.z - from.z), 0]}>
            <boxGeometry args={[0.006, 0.008, len]} />
            {mat}
          </mesh>
        );
      })}
    </>
  );
}

function roundRect(sh: THREE.Shape, w: number, h: number, r: number) {
  const x = -w / 2, y = -h / 2;
  sh.moveTo(x + r, y);
  sh.lineTo(x + w - r, y);
  sh.quadraticCurveTo(x + w, y, x + w, y + r);
  sh.lineTo(x + w, y + h - r);
  sh.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  sh.lineTo(x + r, y + h);
  sh.quadraticCurveTo(x, y + h, x, y + h - r);
  sh.lineTo(x, y + r);
  sh.quadraticCurveTo(x, y, x + r, y);
  return sh;
}

/** Frame ring = shape minus a slightly smaller copy. */
function ringShape(outer: THREE.Shape, t: number) {
  const pts = outer.getPoints(48);
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  const ring = new THREE.Shape(pts.map((p) => p.clone().sub(new THREE.Vector2(cx, cy)).multiplyScalar(1 + t * 8).add(new THREE.Vector2(cx, cy))));
  ring.holes.push(new THREE.Path(pts.slice().reverse()));
  return ring;
}

const lensCache = new Map<string, THREE.CanvasTexture>();
function lensGradient(a: string, b: string) {
  const k = a + b;
  const hit = lensCache.get(k);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, a);
  gr.addColorStop(1, b);
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  lensCache.set(k, t);
  return t;
}

/* ------------------------------------------------------------------ hats */

export function Hat({ w, h }: { w: Wear; h: HeadShape }) {
  const cut = w.cut;
  const geo = useMemo(() => {
    if (cut === 'Headband' || cut === 'Festive hat' || cut === 'Pagdi') {
      if (cut === 'Headband') return null;
    }
    const cfg: Record<string, [number, number, number]> = {
      // start height, thickness, crown extra
      Cap: [0.18, 0.08, 0.04], Beanie: [0.08, 0.1, 0.18], 'Bucket hat': [0.15, 0.1, 0.06], Fedora: [0.2, 0.12, 0.16], Beret: [0.25, 0.12, 0.05],
      Trapper: [-0.25, 0.14, 0.05], 'Hard hat': [0.2, 0.12, 0.08], 'Festive hat': [0.12, 0.1, 0.1], Pagdi: [0.05, 0.2, 0.14],
    };
    const [start, t, crown] = cfg[cut] ?? cfg.Cap;
    const g = shellGeometry(h, (ux, uy, uz) => {
      let m = smooth(start, start + 0.08, uy);
      if (cut === 'Trapper') m = Math.max(m, smooth(0.25, 0.1, Math.abs(Math.atan2(ux, uz)) - 1.2) * smooth(-0.7, -0.5, uy));
      const knit = cut === 'Beanie' ? 0.01 * Math.sin(Math.atan2(ux, uz) * 40) : cut === 'Pagdi' ? 0.03 * Math.sin(uy * 22 + Math.atan2(ux, uz) * 2) : 0;
      return 0.98 + (t + knit + crown * Math.max(0, uy) ** 2) * m;
    }, 72, 48);
    return scaleUV(withSphereUV(g), 3, 3);
  }, [cut, h]);
  const brim = (r: number, y: number, tilt = 0, full = true, depth = 0.012) => (
    <mesh position={[0, y, full ? 0 : h.rz * 0.92]} rotation={[tilt, 0, 0]}>
      <cylinderGeometry args={[r, r * (full ? 1.02 : 1), depth, 48, 1, false, full ? 0 : -Math.PI / 2, full ? Math.PI * 2 : Math.PI]} />
      <Cloth w={w} color={mix(w.c1, '#000000', 0.06)} />
    </mesh>
  );
  return (
    <group rotation={[-0.1, 0, 0]}>
      {geo && (
        <mesh geometry={geo} castShadow>
          <Cloth w={w} rough={cut === 'Hard hat' ? 0.3 : 0.85} />
        </mesh>
      )}
      {cut === 'Cap' && brim(h.rx * 0.8, h.ry * 0.3, 0.28, false, 0.014)}
      {cut === 'Bucket hat' && <mesh position={[0, h.ry * 0.22, 0]} rotation={[0.05, 0, 0]}><cylinderGeometry args={[h.rx * 1.12, h.rx * 1.45, 0.1, 48, 1, true]} /><Cloth w={w} side={THREE.DoubleSide} /></mesh>}
      {cut === 'Fedora' && (
        <>
          {brim(h.rx * 1.55, h.ry * 0.3, 0.06)}
          <mesh position={[0, h.ry * 0.42, 0]}><cylinderGeometry args={[h.rx * 1.13, h.rx * 1.13, 0.04, 48, 1, true]} /><meshStandardMaterial color={w.c2} side={THREE.DoubleSide} /></mesh>
        </>
      )}
      {cut === 'Hard hat' && brim(h.rx * 1.3, h.ry * 0.3, 0.02)}
      {cut === 'Beret' && <mesh position={[0, h.ry * 0.95, -0.02]} rotation={[0, 0, 0.25]} scale={[1.25, 0.32, 1.15]}><sphereGeometry args={[h.rx, 32, 16]} /><Cloth w={w} /></mesh>}
      {(cut === 'Beanie' || cut === 'Festive hat') && (
        <mesh position={[0, cut === 'Festive hat' ? h.ry * 1.25 : h.ry * 1.22, cut === 'Festive hat' ? -h.rz * 0.6 : -0.02]} castShadow>
          <sphereGeometry args={[0.065, 16, 12]} />
          <meshPhysicalMaterial color={cut === 'Festive hat' ? '#f6f1ea' : w.c2} roughness={1} sheen={1} />
        </mesh>
      )}
      {cut === 'Festive hat' && <mesh position={[0, h.ry * 0.25, 0]}><torusGeometry args={[h.rx * 1.08, 0.04, 12, 40]} /><meshPhysicalMaterial color="#f6f1ea" roughness={1} sheen={1} /></mesh>}
      {cut === 'Headband' && <mesh position={[0, h.ry * 0.5, -0.02]} rotation={[0.35, 0, 0]}><torusGeometry args={[h.rx * 0.98, 0.022, 10, 48, Math.PI * 1.2]} /><Cloth w={w} /></mesh>}
      {cut === 'Trapper' && <mesh position={[0, h.ry * 0.25, h.rz * 0.85]} rotation={[0.3, 0, 0]} scale={[1, 0.35, 0.45]}><sphereGeometry args={[h.rx * 0.8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshPhysicalMaterial color="#f4e3c8" roughness={1} sheen={1} /></mesh>}
      {cut === 'Pagdi' && <mesh position={[0, h.ry * 0.62, h.rz * 0.95]}><sphereGeometry args={[0.03, 12, 10]} /><meshPhysicalMaterial color="#e9c46a" metalness={0.8} roughness={0.25} /></mesh>}
    </group>
  );
}

function withSphereUV(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    uv[i * 2] = 0.5 + Math.atan2(x, z) / (Math.PI * 2);
    uv[i * 2 + 1] = 0.5 + y * 1.2;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/* ------------------------------------------------------------------ head extras */

export function HeadExtra({ p, h }: { p: HeadExtraP; h: HeadShape }) {
  const parts = useMemo(() => {
    const out: { geo: THREE.BufferGeometry; color: string; metal?: boolean }[] = [];
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const top = h.ry;
    switch (p.kind) {
      case 'Devil horns':
        for (const s of [-1, 1]) out.push({ geo: taperTube(arc(V(s * 0.13, top * 0.72, h.rz * 0.35), V(s * 0.2, top * 1.05, h.rz * 0.4), V(s * 0.17, top * 1.25, h.rz * 0.15), 10), { radius: (t) => 0.04 * (1 - t), radial: 12, segments: 16 }), color: p.c1 });
        break;
      case 'Ram horns':
        for (const s of [-1, 1]) {
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= 20; i++) {
            const t = i / 20, a = t * Math.PI * 1.6;
            pts.push(V(s * (h.rx * 0.75 + Math.sin(a) * 0.08 * (1 - t * 0.4) + t * 0.05), top * 0.55 + Math.cos(a) * 0.09 * (1 - t * 0.4) - t * 0.08, h.rz * 0.1 - t * 0.05));
          }
          out.push({ geo: taperTube(pts, { radius: (t) => 0.035 * (1 - t * 0.75), radial: 10, segments: 40 }), color: p.c1 });
        }
        break;
      case 'Unicorn horn': {
        const pts = [V(0, top * 0.82, h.rz * 0.45), V(0, top * 1.15, h.rz * 0.62), V(0, top * 1.5, h.rz * 0.72)];
        const g = taperTube(pts, { radius: (t) => 0.035 * (1 - t), radial: 12, segments: 24 });
        const pp = g.attributes.position;
        for (let i = 0; i < pp.count; i++) {
          const y = pp.getY(i);
          const tw = Math.sin(y * 90) * 0.004;
          pp.setX(i, pp.getX(i) + tw);
        }
        g.computeVertexNormals();
        out.push({ geo: g, color: p.c1, metal: true });
        break;
      }
      case 'Cat ears':
      case 'Bunny ears':
        for (const s of [-1, 1]) {
          const bunny = p.kind === 'Bunny ears';
          const base = V(s * h.rx * 0.55, top * 0.8, -0.02);
          const tip = V(s * h.rx * (bunny ? 0.65 : 0.8), top * (bunny ? 1.75 : 1.28), bunny ? -0.04 : 0);
          out.push({ geo: taperTube([base, base.clone().lerp(tip, 0.5).add(V(s * 0.02, 0, 0)), tip], { radius: (t) => (bunny ? 0.055 * Math.sin(Math.PI * (0.15 + 0.85 * t)) + 0.01 : 0.07 * (1 - t)), flat: 0.35, radial: 10, segments: 16 }), color: p.c1 });
          out.push({ geo: taperTube([base.clone().add(V(0, 0.02, 0.012)), base.clone().lerp(tip, 0.5).add(V(s * 0.02, 0, 0.012)), tip.clone().add(V(0, -0.03, 0.012))], { radius: (t) => (bunny ? 0.032 * Math.sin(Math.PI * (0.15 + 0.85 * t)) : 0.04 * (1 - t)), flat: 0.3, radial: 8, segments: 12 }), color: p.c2 });
        }
        break;
      case 'Halo':
        out.push({ geo: new THREE.TorusGeometry(h.rx * 0.75, 0.016, 12, 48).rotateX(Math.PI / 2 - 0.15).translate(0, top * 1.45, -0.02), color: p.c1, metal: true });
        break;
      case 'Antennae':
        for (const s of [-1, 1]) {
          const pts = [V(s * 0.08, top * 0.9, 0.02), V(s * 0.14, top * 1.35, 0.06), V(s * 0.2, top * 1.6, 0.02)];
          out.push({ geo: taperTube(pts, { radius: () => 0.008, radial: 6, segments: 14 }), color: p.c2 });
          out.push({ geo: new THREE.SphereGeometry(0.035, 16, 12).translate(pts[2].x, pts[2].y, pts[2].z), color: p.c1 });
        }
        break;
      case 'Flower crown':
      case 'Leaf crown':
      case 'Tiara': {
        const n = p.kind === 'Tiara' ? 1 : 14;
        if (p.kind === 'Tiara') {
          out.push({ geo: new THREE.TorusGeometry(h.rx * 0.95, 0.01, 8, 48, Math.PI).rotateX(Math.PI / 2 - 0.4).rotateY(Math.PI).translate(0, top * 0.72, 0.02), color: p.c2, metal: true });
          for (let i = 0; i < 7; i++) {
            const a = Math.PI * (0.2 + (0.6 * i) / 6);
            const x = Math.cos(a) * h.rx * 0.95, z = Math.sin(a) * h.rx * 0.95 * 0.9;
            const ht = i === 3 ? 0.08 : 0.045;
            out.push({ geo: new THREE.ConeGeometry(0.014, ht, 8).translate(x, top * 0.74 + ht / 2 + 0.02 * Math.sin(a), z), color: p.c2, metal: true });
            out.push({ geo: new THREE.OctahedronGeometry(i === 3 ? 0.02 : 0.012).translate(x, top * 0.74 + ht + 0.02, z), color: p.c1 });
          }
        } else {
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const x = Math.sin(a) * h.rx * 1.02, z = Math.cos(a) * h.rz * 1.02 * 0.95;
            const y = top * 0.55 + 0.05 * Math.cos(a);
            if (p.kind === 'Flower crown') {
              for (let k = 0; k < 5; k++) {
                const b = (k / 5) * Math.PI * 2;
                out.push({ geo: new THREE.SphereGeometry(0.022, 10, 8).scale(1, 1, 0.5).translate(x + Math.cos(b) * 0.022, y + Math.sin(b) * 0.022, z), color: i % 2 ? p.c1 : p.c2 });
              }
              out.push({ geo: new THREE.SphereGeometry(0.014, 8, 6).translate(x, y, z + 0.008), color: '#ffe1a0' });
            } else {
              const tip = V(x * 1.25, y + 0.06, z * 1.2);
              out.push({ geo: taperTube([V(x, y, z), V(x, y, z).lerp(tip, 0.5).add(V(0, 0.02, 0)), tip], { radius: (t) => 0.025 * Math.sin(Math.PI * (0.1 + 0.9 * t)), flat: 0.3, radial: 8, segments: 10 }), color: i % 2 ? p.c1 : p.c2 });
            }
          }
        }
        break;
      }
      default:
        break;
    }
    return out;
  }, [p, h]);
  return (
    <group>
      {parts.map((pt, i) => (
        <mesh key={i} geometry={pt.geo} castShadow>
          <meshPhysicalMaterial color={pt.color} roughness={pt.metal ? 0.2 : 0.45} metalness={pt.metal ? 0.8 : 0} clearcoat={0.6} emissive={p.kind === 'Halo' ? pt.color : '#000000'} emissiveIntensity={p.kind === 'Halo' ? 0.6 : 0} />
        </mesh>
      ))}
    </group>
  );
}
