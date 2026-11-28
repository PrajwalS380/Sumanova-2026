import { withHairAtRest } from './render/hairMotion';
import { forwardRef, Suspense, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import type { Look, Pose } from './look/config';
import { Figure } from './render/Figure';

export interface AvatarStageHandle {
  /** Renders the current frame to a PNG. 'bust' frames the head for profile photos. */
  capture: (framing?: 'full' | 'bust') => Promise<Blob>;
}

export type Framing = 'full' | 'head' | 'upper' | 'feet';
const FRAMES: Record<Framing, { pos: [number, number, number]; target: [number, number, number] }> = {
  full: { pos: [0, 1.42, 5.6], target: [0, 1.26, 0] },
  head: { pos: [0, 2.18, 2.3], target: [0, 2.11, 0] },
  upper: { pos: [0, 2.0, 3.7], target: [0, 1.83, 0] },
  feet: { pos: [0, 0.55, 2.6], target: [0, 0.35, 0] },
};

type Controls = { target: THREE.Vector3; update: () => void };

/** Procedural soft-box environment (no downloads) for gentle reflections on skin, eyes and fabric. */
function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.6;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Smoothly glides the camera between framings (face close-up vs full body). */
function CameraRig({ framing, controls }: { framing: Framing; controls: React.MutableRefObject<Controls | null> }) {
  const { camera } = useThree();
  const goal = useRef({ pos: new THREE.Vector3(...FRAMES[framing].pos), target: new THREE.Vector3(...FRAMES[framing].target), t: 0 });
  useEffect(() => {
    goal.current.pos.set(...FRAMES[framing].pos);
    goal.current.target.set(...FRAMES[framing].target);
    goal.current.t = 1;
  }, [framing]);
  useFrame((_, dt) => {
    const g = goal.current;
    if (g.t <= 0) return;
    const k = 1 - Math.pow(0.0015, dt);
    camera.position.lerp(g.pos, k);
    const c = controls.current;
    if (c) {
      c.target.lerp(g.target, k);
      c.update();
    } else camera.lookAt(g.target);
    if (camera.position.distanceTo(g.pos) < 0.005) g.t = 0;
  });
  return null;
}

function Capturer({ apiRef }: { apiRef: React.MutableRefObject<AvatarStageHandle['capture'] | null> }) {
  const { gl, scene, camera } = useThree();
  apiRef.current = async (framing = 'full') => {
    const cam = camera as THREE.PerspectiveCamera;
    const prev = { pos: cam.position.clone(), q: cam.quaternion.clone() };
    if (framing === 'bust') {
      // face close-up for the round profile picture
      cam.position.set(0, 2.16, 1.75);
      cam.lookAt(0, 2.09, 0);
    } else {
      // whole figure, head to toe
      cam.position.set(0, 1.25, 5.6);
      cam.lookAt(0, 1.2, 0);
    }
    cam.updateProjectionMatrix();
    // hair at rest in the picture (never caught mid-swing)
    const blob = await withHairAtRest(async () => {
      gl.render(scene, cam);
      return new Promise<Blob>((resolve, reject) => gl.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error('Capture failed'))), 'image/png'));
    });
    cam.position.copy(prev.pos);
    cam.quaternion.copy(prev.q);
    cam.updateProjectionMatrix();
    return blob;
  };
  return null;
}

export const AvatarStage = forwardRef<AvatarStageHandle, { configs: Look[]; poses?: (Pose | undefined)[]; interactive?: boolean; className?: string; framing?: Framing; /** turn the figure (radians) — inspection views */ turn?: number; /** explicit camera — inspection close-ups */ cam?: { pos: [number, number, number]; target: [number, number, number] }; /** anatomy review: no clothes */ bare?: boolean }>(function AvatarStage({ configs, poses = [], interactive = true, className, framing = 'full', turn = 0, cam, bare = false }, ref) {
  const apiRef = useRef<AvatarStageHandle['capture'] | null>(null);
  const controls = useRef<Controls | null>(null);
  useImperativeHandle(ref, () => ({ capture: (f) => apiRef.current!(f) }), []);
  const duo = configs.length > 1;
  const start = cam ?? (duo ? { pos: [0, 1.4, 6.9] as [number, number, number], target: [0, 1.22, 0] as [number, number, number] } : FRAMES[framing]);
  return (
    <Canvas
      className={className}
      shadows
      dpr={[1, 1.75]}
      gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: start.pos, fov: 30 }}
      onCreated={({ camera }) => camera.lookAt(...start.target)}
    >
      {/* Cinematic three-point light: warm key, soft frontal fill, cool + warm rims that outline the silhouette. */}
      <hemisphereLight args={['#fff6ec', '#6a5446', 0.95]} />
      <directionalLight position={[2.2, 3.6, 3.4]} intensity={2.3} color="#fff0e0" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
      <directionalLight position={[-2.6, 1.9, 3]} intensity={1.0} color="#ffe2d2" />
      <directionalLight position={[-2, 3, -3.5]} intensity={1.8} color="#c4dcff" />
      <directionalLight position={[2.5, 1.4, -3]} intensity={0.9} color="#ffb07a" />
      <Suspense fallback={null}>
        {configs.map((c, i) => (
          <group key={i} position={[duo ? (i === 0 ? -0.55 : 0.55) : 0, 0, 0]} rotation={[0, duo ? (i === 0 ? 0.35 : -0.35) : turn, 0]}>
            <Figure look={c} poseOverride={poses[i]} bare={bare} />
          </group>
        ))}
      </Suspense>
      <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={6} blur={2.6} far={3} color="#1a0d06" />
      {interactive && <OrbitControls ref={controls as never} target={start.target} enablePan={false} minDistance={1.2} maxDistance={7} minPolarAngle={0.6} maxPolarAngle={1.75} enableDamping dampingFactor={0.08} />}
      {!duo && !cam && <CameraRig framing={framing} controls={controls} />}
      <StudioEnvironment />
      <Capturer apiRef={apiRef} />
    </Canvas>
  );
});
