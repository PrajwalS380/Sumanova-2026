import { forwardRef, Suspense, useImperativeHandle, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import type { AvatarConfig, Pose } from './config';
import { AvatarFigure } from './AvatarFigure';

export interface AvatarStageHandle {
  /** Renders the current frame to a PNG. 'bust' frames the head for profile photos. */
  capture: (framing?: 'full' | 'bust') => Promise<Blob>;
}

function Capturer({ apiRef }: { apiRef: React.MutableRefObject<AvatarStageHandle['capture'] | null> }) {
  const { gl, scene, camera } = useThree();
  apiRef.current = async (framing = 'full') => {
    const cam = camera as import('three').PerspectiveCamera;
    const prev = { pos: cam.position.clone(), fov: cam.fov };
    if (framing === 'bust') {
      cam.position.set(0, 1.95, 2.3);
      cam.fov = 30;
      cam.lookAt(0, 1.9, 0);
    }
    cam.updateProjectionMatrix();
    gl.render(scene, cam);
    const blob = await new Promise<Blob>((resolve, reject) => gl.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error('Capture failed'))), 'image/png'));
    cam.position.copy(prev.pos);
    cam.fov = prev.fov;
    cam.lookAt(0, 1.18, 0);
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
      camera={{ position: [0, 1.35, duo ? 6.8 : 5.6], fov: 30 }}
      onCreated={({ camera }) => camera.lookAt(0, 1.18, 0)}
    >
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#c4b5fd', '#0d0f22', 0.6]} />
      <directionalLight position={[2.5, 4, 3]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-3, 2, -2]} intensity={0.6} color="#2dd4bf" />
      <pointLight position={[0, 2, 2.5]} intensity={0.35} color="#fb7185" />
      <Suspense fallback={null}>
        {configs.map((c, i) => (
          <group key={i} position={[duo ? (i === 0 ? -0.55 : 0.55) : 0, 0, 0]} rotation={[0, duo ? (i === 0 ? 0.35 : -0.35) : 0, 0]}>
            <AvatarFigure config={c} poseOverride={poses[i]} />
          </group>
        ))}
      </Suspense>
      <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={6} blur={2.4} far={3} />
      {interactive && <OrbitControls target={[0, 1.18, 0]} enablePan={false} minDistance={2.2} maxDistance={7} minPolarAngle={0.6} maxPolarAngle={1.75} enableDamping dampingFactor={0.08} />}
      <Capturer apiRef={apiRef} />
    </Canvas>
  );
});
