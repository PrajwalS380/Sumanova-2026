import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { BAKED_STYLES } from '../look/bakedHair';
import { HAIRSTYLES, type HairTune } from '../look/hair';

/**
 * Finished, offline-sculpted hairstyles (tools/hair-bake → public/hair/<id>.glb), loaded on demand.
 * Each asset is one fused sculpt with a baked normal map (strand grooves) and per-vertex
 * (occlusion, root→tip, clump id) + strand direction, so the regular hair material can shade it.
 */

export interface BakedHair { geo: THREE.BufferGeometry; normalMap: THREE.Texture | null }

const BAKED_IDS = new Set(BAKED_STYLES.map((n) => HAIRSTYLES.findIndex((v) => v.name === n)).filter((i) => i >= 0));

/** Use the finished asset? Only for headline styles whose shape isn't adjusted (colour / shine are fine). */
export function bakedHairId(id: number | null | undefined, tune: HairTune | undefined, hatOn: boolean): number | null {
  if (id == null || hatOn || !BAKED_IDS.has(id)) return null;
  if (tune && (tune.length || tune.volume || tune.tex || tune.part || tune.fringe)) return null;
  return id;
}

const cache = new Map<number, Promise<BakedHair | null>>();
export function loadBakedHair(id: number): Promise<BakedHair | null> {
  let p = cache.get(id);
  if (!p) {
    const url = `${import.meta.env.BASE_URL ?? '/'}hair/${id}.glb`;
    // assets are meshopt-compressed (gltfpack) — decoded in JS, no extra downloads
    p = new GLTFLoader()
      .setMeshoptDecoder(MeshoptDecoder)
      .loadAsync(url)
      .then((gltf) => {
        let found: BakedHair | null = null;
        gltf.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!found && m.isMesh) {
            const geo = m.geometry;
            // custom attribute from the bake: strand direction (head-local)
            const t = geo.getAttribute('_hairt');
            if (t) {
              geo.setAttribute('hairT', t);
              geo.deleteAttribute('_hairt');
            }
            const mat = m.material as THREE.MeshStandardMaterial;
            found = { geo, normalMap: mat?.normalMap ?? null };
          }
        });
        return found;
      })
      // missing / offline asset: the live groom is used instead
      .catch(() => null);
    cache.set(id, p);
  }
  return p;
}

export function useBakedHair(id: number | null): BakedHair | null | undefined {
  const [state, setState] = useState<{ id: number | null; v: BakedHair | null | undefined }>({ id, v: undefined });
  useEffect(() => {
    if (id == null) return;
    let alive = true;
    void loadBakedHair(id).then((v) => alive && setState({ id, v }));
    return () => {
      alive = false;
    };
  }, [id]);
  if (id == null) return null;
  return state.id === id ? state.v : undefined;
}
