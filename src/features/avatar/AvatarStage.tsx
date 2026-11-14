import { forwardRef, Suspense, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import type { AvatarConfig, Pose } from './config';
import { AvatarFigure } from './AvatarFigure';

export interface AvatarStageHandle {
  /** Renders the current frame to a PNG. 'bust' frames the head for profile photos. */
  capture: (framing?: 'full' | 'bust') => Promise<Blob>;
}

/** Procedural soft-box environment (no downloads) for gentle reflections on skin, eyes and fabric. */
function StudioEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.45;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Capturer({ apiRef }: { apiRef: React.MutableRefObject<AvatarStageHandle['capture'] | null> }) {
  const { gl, scene, camera } = useThree();
  apiRef.current = async (framing = 'full') => {
    const cam = camera as import('three').PerspectiveCamera;
    const prev = { pos: cam.position.clone(), fov: cam.fov };
    if (framing === 'bust') {
      cam.position.set(0, 2.02, 2.75);
      cam.fov = 30;
      cam.lookAt(0, 1.9, 0);
    }
    cam.updateProjectionMatrix();
    gl.render(scene, cam);
    const blob = await new Promise<Blob>((resolve, reject) => gl.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error('Capture failed'))), 'image/png'));
    cam.position.copy(prev.pos);
    cam.fov = prev.fov;
    cam.lookAt(0, 1.22, 0);
    cam.updateProjectionMatrix();
    return blob;
  };
  return null;
}

export const AvatarStage = forwardRef<AvatarStageHandle, { configs: AvatarConfig[]; poses?: (Pose | undefined)[]; interactive?: boolean; className?: string }>(function AvatarStage({ configs, poses = [], interactive = true, className }, ref) {
  const apiRef = useRef<AvatarStageHandle['capture'] | null>(null);
  useImperativeHandle(ref, () => ({ capture: (f) => apiRef.current!(f) }), []);
  const duo = configs.length > 1;
  return (
    <Canvas
      className={className}
      shadows
      dpr={[1, 1.75]}
      gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 1.4, duo ? 6.9 : 5.5], fov: 30 }}
      onCreated={({ camera }) => camera.lookAt(0, 1.22, 0)}
    >
      {/* Warm studio: soft key, cream fill, cool rim to separate the silhouette */}
      <hemisphereLight args={['#fff1e0', '#2a1a12', 0.6]} />
      <directionalLight position={[2.2, 4, 3.2]} intensity={2.1} color="#ffe6cc" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
      <directionalLight position={[-2.5, 1.8, 2.5]} intensity={0.55} color="#ffd2b8" />
      <directionalLight position={[-2, 3, -3.5]} intensity={1.5} color="#bcd4ff" />
      <directionalLight position={[2.5, 1, -3]} intensity={0.7} color="#ff9a5c" />
      <Suspense fallback={null}>
        {configs.map((c, i) => (
          <group key={i} position={[duo ? (i === 0 ? -0.55 : 0.55) : 0, 0, 0]} rotation={[0, duo ? (i === 0 ? 0.35 : -0.35) : 0, 0]}>
            <AvatarFigure config={c} poseOverride={poses[i]} />
          </group>
        ))}
      </Suspense>
      <ContactShadows position={[0, 0, 0]} opacity={0.55} scale={6} blur={2.6} far={3} color="#1a0d06" />
      {interactive && <OrbitControls target={[0, 1.22, 0]} enablePan={false} minDistance={2.2} maxDistance={7} minPolarAngle={0.6} maxPolarAngle={1.75} enableDamping dampingFactor={0.08} />}
      <StudioEnvironment />
      <Capturer apiRef={apiRef} />
    </Canvas>
  );
});
