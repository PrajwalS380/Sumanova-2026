import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { createRoot, extend, useThree, type ReconcilerRoot } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Figure } from '../render/Figure';
import { prepareLook } from '../render/lookParts';
import { DEFAULT_LOOK, type Look } from '../look/config';

/**
 * Variant preview cards. A single hidden WebGL canvas renders one preview at
 * a time on a warm clay mannequin, and results are cached as image URLs, so
 * scrolling a 100-item grid never creates 100 GL contexts.
 */
export type ThumbFrame = 'head' | 'face' | 'upper' | 'lower' | 'feet' | 'full' | 'sticker' | 'seated' | 'bag' | 'dress';

const SIZE = 192;
const CAMS: Record<ThumbFrame, { pos: [number, number, number]; target: [number, number, number]; fov: number }> = {
  head: { pos: [0.35, 2.06, 1.55], target: [0, 1.99, 0], fov: 30 },
  face: { pos: [0, 1.98, 0.95], target: [0, 1.94, 0], fov: 30 },
  upper: { pos: [0, 1.6, 2.7], target: [0, 1.46, 0], fov: 30 },
  lower: { pos: [0, 0.66, 2.9], target: [0, 0.66, 0], fov: 30 },
  feet: { pos: [0.55, 0.3, 1.05], target: [0, 0.12, 0.05], fov: 30 },
  /** Three-quarter view of the bag side (bags hang at the avatar's right hip; backpacks sit behind). */
  bag: { pos: [-1.75, 1.15, 0.75], target: [-0.36, 1.0, -0.04], fov: 30 },
  /** Shoulders to shins, so prints on dresses read clearly. */
  dress: { pos: [0, 1.12, 3.5], target: [0, 1.06, 0], fov: 30 },
  full: { pos: [0, 1.26, 4.8], target: [0, 1.2, 0], fov: 30 },
  /** Knees up, with head-room for raised arms (chat stickers). */
  sticker: { pos: [0, 1.5, 3.9], target: [0, 1.45, 0], fov: 30 },
  seated: { pos: [0, 1.05, 3.6], target: [0, 1.0, 0], fov: 30 },
};

export const CLAY = '#efe4d6';
/** Neutral mannequin the variant is shown on. */
export function mannequin(): Look {
  const l: Look = structuredClone(DEFAULT_LOOK);
  l.skin = CLAY;
  l.pick.hair = null;
  l.pick.top = null;
  l.pick.bottom = null;
  l.pick.shoes = null;
  l.pick.lashes = null;
  l.color = { eyes: '#8a8078', brows: '#5a4e45', lips: '#d8c4b4' };
  l.expression = 'neutral';
  return l;
}

const cache = new Map<string, string>();

/**
 * Rendered previews are also kept in the browser's Cache Storage so the studio
 * opens instantly on later visits. Bump the version whenever the renderer
 * changes how variants look.
 */
const STORE = 'snv-thumbs-v9';
const storeKey = (key: string) => `/__thumb/${encodeURIComponent(key)}`;
async function fromStore(key: string): Promise<string | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const res = await (await caches.open(STORE)).match(storeKey(key));
    return res ? URL.createObjectURL(await res.blob()) : null;
  } catch {
    return null;
  }
}
function toStore(key: string, blob: Blob) {
  try {
    if (typeof caches === 'undefined') return;
    void caches.open(STORE).then((c) => c.put(storeKey(key), new Response(blob, { headers: { 'content-type': blob.type } }))).catch(() => undefined);
  } catch {
    /* storage unavailable (private mode) — memory cache still works */
  }
}
let pruned = false;
function pruneOldStores() {
  if (pruned || typeof caches === 'undefined') return;
  pruned = true;
  void caches.keys().then((ks) => ks.filter((k) => k.startsWith('snv-thumbs-') && k !== STORE).forEach((k) => void caches.delete(k))).catch(() => undefined);
}
type Job = { key: string; look: Look; frame: ThumbFrame; faceless: boolean; size: number; resolve: (url: string) => void };
const queue: Job[] = [];
let running = false;
let root: ReconcilerRoot<HTMLCanvasElement> | null = null;
let canvas: HTMLCanvasElement | null = null;
let ready: ((gl: THREE.WebGLRenderer, scene: THREE.Scene) => void) | null = null;

function Snap({ frame, onReady }: { frame: ThumbFrame; onReady: (gl: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera) => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const c = CAMS[frame];
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(...c.pos);
    cam.fov = c.fov;
    cam.lookAt(...c.target);
    cam.updateProjectionMatrix();
    if (!scene.environment) {
      const pm = new THREE.PMREMGenerator(gl);
      scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.5;
    }
    onReady(gl, scene, cam);
  });
  return null;
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const job = queue.shift()!;
    const hit = cache.get(job.key);
    if (hit) {
      job.resolve(hit);
      continue;
    }
    pruneOldStores();
    const stored = await fromStore(job.key);
    if (stored) {
      cache.set(job.key, stored);
      job.resolve(stored);
      continue;
    }
    try {
      if (!canvas) {
        extend(THREE as unknown as Record<string, new (...args: unknown[]) => unknown>);
        canvas = document.createElement('canvas');
        canvas.width = canvas.height = job.size;
        root = createRoot(canvas);
        root.configure({ size: { width: job.size, height: job.size, top: 0, left: 0 }, dpr: 1, frameloop: 'never', gl: { preserveDrawingBuffer: true, alpha: true, antialias: true }, camera: { fov: 30 } });
      } else if (canvas.width !== job.size) {
        canvas.width = canvas.height = job.size;
        root!.configure({ size: { width: job.size, height: job.size, top: 0, left: 0 } });
      }
      // every sculpted piece must be ready before the single still frame is taken
      await prepareLook(job.look, job.frame === 'head' || job.frame === 'face' ? 'head' : undefined);
      const url = await new Promise<string>((resolve) => {
        const onReady = (gl: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera) => {
          gl.setClearColor(0x000000, 0);
          gl.render(scene, cam);
          canvas!.toBlob(
            (blob) => {
              if (!blob) return resolve(canvas!.toDataURL('image/webp', 0.85));
              toStore(job.key, blob);
              resolve(URL.createObjectURL(blob));
            },
            'image/webp',
            0.85,
          );
        };
        const headOnly = job.frame === 'head' || job.frame === 'face';
        root!.render(
          <>
            <hemisphereLight args={['#fff6ec', '#6a5446', 1.0]} />
            <directionalLight position={[2.2, 3.6, 3.4]} intensity={2.2} color="#fff0e0" />
            <directionalLight position={[-2.6, 1.9, 3]} intensity={0.9} color="#ffe2d2" />
            <directionalLight position={[-2, 3, -3.5]} intensity={1.4} color="#c4dcff" />
            <group key={job.key}>
              <Figure look={job.look} animate={false} only={headOnly ? 'head' : undefined} faceless={job.faceless} />
            </group>
            <Snap frame={job.frame} onReady={onReady} />
          </>,
        );
      });
      cache.set(job.key, url);
      job.resolve(url);
    } catch {
      job.resolve('');
    }
    // let the UI breathe between renders
    await new Promise((r) => setTimeout(r, 0));
  }
  running = false;
}
void ready;

/** Render one preview now (used by the duplicate checker in e2e/avatar-harness). */
export function renderThumb(key: string, look: Look, frame: ThumbFrame, faceless = false, size = SIZE): Promise<string> {
  return new Promise((resolve) => {
    queue.push({ key, look, frame, faceless, size, resolve });
    void pump();
  });
}

/** Returns a preview image URL for a look, rendering it lazily (when `enabled`). */
export function useThumb(key: string, make: () => Look, frame: ThumbFrame, enabled: boolean, faceless = false, size = SIZE) {
  const [url, setUrl] = useState(() => cache.get(key) ?? '');
  useEffect(() => {
    if (!enabled) return;
    const hit = cache.get(key);
    if (hit) {
      setUrl(hit);
      return;
    }
    let alive = true;
    queue.unshift({ key, look: make(), frame, faceless, size, resolve: (u) => alive && setUrl(u) });
    void pump();
    return () => {
      alive = false;
      const i = queue.findIndex((j) => j.key === key);
      if (i >= 0) queue.splice(i, 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return url;
}
