import * as THREE from 'three';
import { surfaceZ, type HeadShape } from '../sculpt';
import type { Jewel, PiercingP } from '../look/extras';

type Zone = 'ear' | 'nose' | 'brow' | 'lip' | 'tongue';

interface Props {
  zone: Zone;
  p: PiercingP;
  side?: number;
  nose?: { y: number; z: number; w: number; h?: HeadShape };
  brow?: { h: HeadShape; ex: number; ey: number; er: number };
  lip?: { h: HeadShape; y: number; w: number };
  tongue?: THREE.Vector3[];
}

function Metal({ color }: { color: string }) {
  return <meshPhysicalMaterial color={color} metalness={0.95} roughness={0.18} clearcoat={0.6} />;
}
function Gem({ color }: { color: string }) {
  return <meshPhysicalMaterial color={color} metalness={0.1} roughness={0.02} clearcoat={1} emissive={color} emissiveIntensity={0.25} />;
}

/** One piece of jewellery at a resolved position. `out` points away from the skin. */
function Piece({ j, pos, out, metal, gem, scale = 1 }: { j: Jewel; pos: THREE.Vector3; out: THREE.Vector3; metal: string; gem: string; scale?: number }) {
  const s = j.size * scale;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), out.clone().normalize());
  switch (j.kind) {
    case 'stud':
      return (
        <mesh position={pos}>
          <sphereGeometry args={[0.0065 * s, 12, 10]} />
          <Metal color={metal} />
        </mesh>
      );
    case 'gem':
      return (
        <group position={pos} quaternion={q}>
          <mesh scale={[1, 1, 0.6]}>
            <octahedronGeometry args={[0.0085 * s, 0]} />
            <Gem color={gem} />
          </mesh>
          <mesh position={[0, 0, -0.002]}>
            <torusGeometry args={[0.0075 * s, 0.0015, 6, 16]} />
            <Metal color={metal} />
          </mesh>
        </group>
      );
    case 'hoop':
      return (
        <mesh position={pos.clone().add(new THREE.Vector3(0, -0.016 * s, 0))} rotation={[0, Math.atan2(out.x, out.z) + Math.PI / 2 - 0.6 * Math.sign(out.x || 1), 0]}>
          <torusGeometry args={[0.016 * s, 0.0022, 8, 28]} />
          <Metal color={metal} />
        </mesh>
      );
    case 'ring':
      return (
        <mesh position={pos} quaternion={q} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.011 * s, 0.0022, 8, 24]} />
          <Metal color={metal} />
        </mesh>
      );
    case 'cuff':
      return (
        <mesh position={pos} quaternion={q}>
          <torusGeometry args={[0.009 * s, 0.0035, 8, 20, Math.PI * 1.4]} />
          <Metal color={metal} />
        </mesh>
      );
    case 'spike':
      return (
        <group position={pos} quaternion={q}>
          <mesh position={[0, 0, 0.008 * s]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.005 * s, 0.018 * s, 12]} />
            <Metal color={metal} />
          </mesh>
        </group>
      );
    case 'bar':
      return (
        <group position={pos} quaternion={q}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.0018, 0.0018, 0.03 * s, 8]} />
            <Metal color={metal} />
          </mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * 0.015 * s, 0, 0]}>
              <sphereGeometry args={[0.004 * s, 10, 8]} />
              <Metal color={metal} />
            </mesh>
          ))}
        </group>
      );
    case 'chain':
      return (
        <group position={pos}>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[0, -0.006 - i * 0.008, 0]} rotation={[0, i % 2 ? Math.PI / 2 : 0, 0]}>
              <torusGeometry args={[0.004, 0.0013, 6, 12]} />
              <Metal color={metal} />
            </mesh>
          ))}
          <mesh position={[0, -0.042, 0]}>
            <octahedronGeometry args={[0.006, 0]} />
            <Gem color={gem} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

export function Jewelry({ zone, p, side = 1, nose, brow, lip, tongue }: Props) {
  const items: { j: Jewel; pos: THREE.Vector3; out: THREE.Vector3 }[] = [];
  for (const j of p.pieces) {
    if (zone === 'ear') {
      // ear-local (inside the scaled ear group): rim around the back from lobe (a=0) to top (a=1)
      const th = -Math.PI / 2 + j.a * Math.PI;
      const k = 1 - Math.min(1, j.b) * 0.5;
      const pos = new THREE.Vector3(side * 0.03, 0.07 * Math.sin(th) * k, -0.048 * Math.cos(th) * k + (j.b > 1 ? 0.03 : 0));
      items.push({ j, pos, out: new THREE.Vector3(side, 0, 0.2) });
    } else if (zone === 'nose' && nose) {
      const pos = j.a === 0 && j.b === 0 ? new THREE.Vector3(0, nose.y - 0.02, nose.z - 0.004) : j.b >= 1 ? new THREE.Vector3(0, nose.y + 0.1, nose.z - 0.015) : new THREE.Vector3(j.a * nose.w * 1.15, nose.y + j.b * 0.04, nose.z - 0.006);
      items.push({ j, pos, out: new THREE.Vector3(j.a * 0.6, j.a === 0 && j.b === 0 ? -0.6 : 0, 1) });
    } else if (zone === 'brow' && brow) {
      const x = j.a * (brow.ex - brow.er * 0.95 + j.b * brow.er * 2.1);
      const y = brow.ey + 0.004 + (j.b > 1 ? 0.03 : 0);
      items.push({ j, pos: new THREE.Vector3(x, y, surfaceZ(brow.h, x, y) + 0.008), out: new THREE.Vector3(j.a * 0.3, 0.2, 1) });
    } else if (zone === 'lip' && lip) {
      const x = j.a * lip.w * 0.9;
      const y = lip.y + (j.b >= 1 ? 0.034 : j.b > 0 ? 0 : -0.036);
      items.push({ j, pos: new THREE.Vector3(x, y, surfaceZ(lip.h, x, y) + 0.005), out: new THREE.Vector3(j.a * 0.3, 0, 1) });
    } else if (zone === 'tongue' && tongue) {
      const c = new THREE.CatmullRomCurve3(tongue).getPoint(Math.min(1, Math.max(0, j.a)));
      items.push({ j, pos: c.add(new THREE.Vector3(j.b * 0.018, 0.004, 0.012)), out: new THREE.Vector3(0, 0.4, 1) });
    }
  }
  return (
    <group>
      {items.map((it, i) => (
        <Piece key={i} j={it.j} pos={it.pos} out={it.out} metal={p.metal} gem={p.gem} scale={zone === 'ear' ? 1.6 : 1} />
      ))}
    </group>
  );
}
