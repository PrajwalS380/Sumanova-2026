import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { createRoot, extend, useThree, type ReconcilerRoot } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Figure } from '../render/Figure';
import { DEFAULT_LOOK, type Look } from '../look/config';

/**
 * Variant preview cards. A single hidden WebGL canvas renders one preview at
 * a time on a warm clay mannequin, and results are cached as image URLs, so
 * scrolling a 100-item grid never creates 100 GL contexts.
 */
export type ThumbFrame = 'head' | 'face' | 'upper' | 'lower' | 'feet' | 'full';

const SIZE = 192;
const CAMS: Record<ThumbFrame, { pos: [number, number, number]; target: [number, number, number]; fov: number }> = {
  head: { pos: [0.35, 2.06, 1.55], target: [0, 1.99, 0], fov: 30 },
  face: { pos: [0, 1.98, 0.95], target: [0, 1.94, 0], fov: 30 },
  upper: { pos: [0, 1.5, 2.6], target: [0, 1.36, 0], fov: 30 },
  lower: { pos: [0, 0.6, 2.7], target: [0, 0.6, 0], fov: 30 },
  feet: { pos: [0.6, 0.35, 1.4], target: [0, 0.18, 0], fov: 30 },
  full: { pos: [0, 1.2, 4.6], target: [0, 1.15, 0], fov: 30 },
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
type Job = { key: string; look: Look; frame: ThumbFrame; faceless: boolean; resolve: (url: string) => void };
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
    try {
      if (!canvas) {
        extend(THREE as unknown as Record<string, new (...args: unknown[]) => unknown>);
        canvas = document.createElement('canvas');
        canvas.width = canvas.height = SIZE;
        root = createRoot(canvas);
        root.configure({ size: { width: SIZE, height: SIZE, top: 0, left: 0 }, dpr: 1, frameloop: 'never', gl: { preserveDrawingBuffer: true, alpha: true, antialias: true }, camera: { fov: 30 } });
      }
      const url = await new Promise<string>((resolve) => {
        const onReady = (gl: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera) => {
          gl.setClearColor(0x000000, 0);
          gl.render(scene, cam);
          resolve(canvas!.toDataURL('image/webp', 0.85));
        };
        const headOnly = job.frame === 'head' || job.frame === 'face';
        root!.render(
          <>
            <hemisphereLight args={['#fff4e8', '#3a2a20', 0.9]} />
            <directionalLight position={[2, 4, 3]} intensity={2.2} color="#fff0e0" />
            <directionalLight position={[-3, 2, -2]} intensity={1.0} color="#cfe0ff" />
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

/** Returns a preview image URL for a look, rendering it lazily (when `enabled`). */
export function useThumb(key: string, make: () => Look, frame: ThumbFrame, enabled: boolean, faceless = false) {
  const [url, setUrl] = useState(() => cache.get(key) ?? '');
  useEffect(() => {
    if (!enabled) return;
    const hit = cache.get(key);
    if (hit) {
      setUrl(hit);
      return;
    }
    let alive = true;
    queue.unshift({ key, look: make(), frame, faceless, resolve: (u) => alive && setUrl(u) });
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
