import * as THREE from 'three';
import type { Wear } from '../look/fashion';
import type { BodyP } from '../look/face';
import { mix } from '../sculpt';
import type { Tone } from '../sculpt3d/garments';
import { useSculpt } from '../sculpt3d/async';
import type { Job, Result } from '../sculpt3d/jobs';
import { Cloth } from './Clothes';
import { Skinned } from './SculptBody';

function toneColor(w: Wear, t: Tone): string {
  switch (t) {
    case 'c1': return w.c1;
    case 'c2': return w.c2;
    case 'c3': return w.c3;
    case 'dark': return mix(w.c1, '#000000', 0.22);
    case 'light': return mix(w.c1, '#ffffff', 0.72);
    case 'metal': return '#c9ccd2';
    default: return w.c1;
  }
}

/** One sculpted garment: patterned fabric shell + coloured trims, skinned to the figure. */
export function Garment({ job, w, skeleton }: { job: Job; w: Wear; skeleton: THREE.Skeleton }) {
  const res = useSculpt(job);
  if (!res) return null;
  const main = res.find((p) => p.role === 'main')?.geo;
  const trims = res.filter((p) => p.role === 'trim') as (Result[number] & { tone: Tone })[];
  return (
    <>
      {main && (
        <Skinned geometry={main} skeleton={skeleton}>
          <Cloth w={w} side={THREE.DoubleSide} rough={w.cut === 'Biker' ? 0.35 : w.cut === 'Puffer' ? 0.45 : 0.82} />
        </Skinned>
      )}
      {trims.map((t, i) =>
        t.tone === 'c1' ? (
          <Skinned key={i} geometry={t.geo} skeleton={skeleton}>
            <Cloth w={w} />
          </Skinned>
        ) : (
          <Skinned key={i} geometry={t.geo} skeleton={skeleton} shadow={false}>
            {t.tone === 'metal' ? <meshStandardMaterial color={toneColor(w, t.tone)} metalness={0.85} roughness={0.25} /> : <Cloth color={toneColor(w, t.tone)} />}
          </Skinned>
        ),
      )}
    </>
  );
}

export function SculptClothes({ body, top, outer, bottom, dress, socks, shoes, skeleton }: { body: BodyP; top: Wear | null; outer: Wear | null; bottom: Wear | null; dress: Wear | null; socks: Wear | null; shoes: Wear | null; skeleton: THREE.Skeleton }) {
  return (
    <>
      {socks && <Garment job={{ k: 'socks', bp: body, cut: socks.cut }} w={socks} skeleton={skeleton} />}
      {shoes && <Garment job={{ k: 'shoes', bp: body, cut: shoes.cut }} w={shoes} skeleton={skeleton} />}
      {bottom && <Garment job={{ k: 'bottom', bp: body, cut: bottom.cut }} w={bottom} skeleton={skeleton} />}
      {dress && <Garment job={{ k: 'dress', bp: body, cut: dress.cut }} w={dress} skeleton={skeleton} />}
      {top && <Garment job={{ k: 'top', bp: body, cut: top.cut, layer: 0 }} w={top} skeleton={skeleton} />}
      {outer && <Garment job={{ k: 'top', bp: body, cut: outer.cut, layer: 1, under: top?.cut }} w={outer} skeleton={skeleton} />}
    </>
  );
}
