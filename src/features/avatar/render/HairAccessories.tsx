import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useSculpt } from '../sculpt3d/async';
import { readAnchors, type AccAnchorIn, type AccItemIn } from '../sculpt3d/hairAccGeo';
import { ANCHORS_UNDER_HAT, HAIR_ACCESSORIES, accAnchor, type AnchorK, type Finish } from '../look/hairAcc';
import type { Look } from '../look/config';
import { MOTION_APPLY, MOTION_HEAD, MOTION_ROT, type MotionUniforms } from './SculptHair';

/** one worn accessory: catalogue id, wanted place, colour override (hairAcc1 / hairAcc2 colour key) */
export interface WornAcc { id: number; at?: AnchorK | null; color?: string | null }

const FINISH: Record<Finish, [number, number]> = { gloss: [0.28, 0], matte: [0.8, 0], metal: [0.25, 0.85], pearl: [0.3, 0.05], satin: [0.45, 0], petal: [0.65, 0] };

/** the anchors one accessory sits on (a headband uses the whole arc; beads every braid end) */
export function pickAnchors(kind: AccItemIn['kind'], all: AccAnchorIn[], want: AnchorK | null | undefined, hatOn: boolean, headY: number): AccAnchorIn[] {
  const usable = hatOn ? all.filter((a) => ANCHORS_UNDER_HAT.includes(a.k) && a.at[1] < 0.1 * headY) : all;
  const k = accAnchor(kind, new Set(usable.map((a) => a.k)), want);
  if (!k) return [];
  const of = usable.filter((a) => a.k === k);
  if (k === 'headbandArc') return of;
  // beads on up to 12 braid ends, spread over all of them (box braids have dozens)
  if (k === 'braidEnd') return kind === 'beads' ? of.filter((_, i) => i % Math.max(1, Math.ceil(of.length / 12)) === 0).slice(0, 12) : of.slice(0, 2);
  return of.slice(0, k === 'tie' || k === 'bunTop' ? 2 : 1);
}

/** the accessory job's items for what a look wears on these anchors */
export function accItems(worn: WornAcc[], all: AccAnchorIn[], hatOn: boolean, headY: number): AccItemIn[] {
  return worn.flatMap((w, slot) => {
    const v = HAIR_ACCESSORIES[w.id];
    if (!v) return [];
    const at = pickAnchors(v.p.kind, all, w.at, hatOn, headY);
    return at.length ? [{ kind: v.p.kind, style: v.p.style, slot: slot as 0 | 1, anchors: at }] : [];
  });
}

/** the hair accessories a look wears */
export function wornAcc(look: Look): WornAcc[] | null {
  const out: WornAcc[] = [];
  for (const k of ['hairAcc1', 'hairAcc2'] as const) {
    const id = look.pick[k];
    if (id != null) out.push({ id, at: look.accAt?.[k] ?? null, color: look.color[k] ?? null });
  }
  return out.length ? out : null;
}

/**
 * Hair accessories (sumanova-us-110): sculpted in the worker on the groom's anchors, drawn as ONE
 * mesh inside the head group; colours / finishes are uniforms picked per vertex (accSlot), pieces on
 * a tail or braid swing with it (the hair's motion uniforms).
 */
export function HairAccessories({ anchors, worn, hatOn, R, headY, mu }: { anchors: THREE.BufferGeometry | null | undefined; worn: WornAcc[]; hatOn: boolean; R: number; headY: number; mu: MotionUniforms }) {
  const all = useMemo(() => readAnchors(anchors), [anchors]);
  const items = useMemo(() => accItems(worn, all, hatOn, headY), [worn, all, hatOn, headY]);
  const res = useSculpt(items.length ? { k: 'hairAcc', items, R } : null);
  const u = useMemo(() => ({
    uAccC: { value: [0, 1, 2, 3].map(() => new THREE.Color()) },
    uAccF: { value: [0, 1, 2, 3].map(() => new THREE.Vector2(0.5, 0)) },
  }), []);
  worn.forEach((w, slot) => {
    const v = HAIR_ACCESSORIES[w.id];
    if (!v) return;
    u.uAccC.value[slot * 2].set(w.color ?? v.p.c1);
    u.uAccC.value[slot * 2 + 1].set(v.p.c2);
    const [r, m] = FINISH[v.p.finish];
    u.uAccF.value[slot * 2].set(r, m);
    // second colours: pearls are pearly, centres / leaves soft, metal parts stay metal
    u.uAccF.value[slot * 2 + 1].set(v.p.finish === 'metal' && v.p.kind !== 'barrette' && v.p.kind !== 'beads' ? r : 0.35, v.p.finish === 'metal' && v.p.kind === 'claw' ? m : v.p.kind === 'beads' && v.p.style === 1 ? 0.8 : 0.05);
  });
  const mat = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({ roughness: 0.5, metalness: 0, clearcoat: 0.25, sheen: 0.3 });
    m.defines = { HAIR_MOTION: '', HAIR_TT: '1.0' };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, mu, u);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float accSlot; varying float vAccSlot;' + MOTION_HEAD)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + MOTION_ROT + '\nobjectNormal = rotV(objectNormal, hRot);')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAccSlot = accSlot;\n' + MOTION_APPLY);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uAccC[4]; uniform vec2 uAccF[4]; varying float vAccSlot;')
        .replace('#include <color_fragment>', '#include <color_fragment>\nint si = int(vAccSlot + 0.5);\nvec3 accC = si == 0 ? uAccC[0] : si == 1 ? uAccC[1] : si == 2 ? uAccC[2] : uAccC[3];\nvec2 accF = si == 0 ? uAccF[0] : si == 1 ? uAccF[1] : si == 2 ? uAccF[2] : uAccF[3];\ndiffuseColor.rgb = accC;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = accF.x;')
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = accF.y;');
    };
    return m;
  }, [mu, u]);
  useEffect(() => () => mat.dispose(), [mat]);
  const geo = items.length ? res?.find((p) => p.role === 'main')?.geo : undefined;
  return geo ? <mesh geometry={geo} material={mat} castShadow /> : null;
}
