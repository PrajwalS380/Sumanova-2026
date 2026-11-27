import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { createPortal, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Look, Pose } from '../look/config';
import type { BodyP } from '../look/face';
import { B, HEAD_SCALE, HEAD_Y, REST_ARM } from '../sculpt3d/anatomy';
import { applyGesture, createRig, jointsFor, type Gesture } from '../sculpt3d/rig';
import { useSculpt } from '../sculpt3d/async';
import { SkinMat, nailTone } from './Face';

const I4 = new THREE.Matrix4();
/** Leg length factor (hip to ankle), a slimmer, taller stylised-adult silhouette. */
export const LEG_STRETCH = 1.07;

/** A mesh skinned to the figure's skeleton (bound once, in the rest pose). */
export function Skinned({ geometry, skeleton, children, shadow = true }: { geometry: THREE.BufferGeometry; skeleton: THREE.Skeleton; children: ReactNode; shadow?: boolean }) {
  return (
    <skinnedMesh
      geometry={geometry}
      frustumCulled={false}
      castShadow={shadow}
      receiveShadow
      ref={(m: THREE.SkinnedMesh | null) => {
        if (m && m.skeleton !== skeleton) m.bind(skeleton, I4);
      }}
    >
      {children}
    </skinnedMesh>
  );
}

interface PoseSpec {
  armL: [number, number]; armR: [number, number]; // [abduction z, forward x]
  foreL: [number, number]; foreR: [number, number]; // [z, x]
  twistL?: number; twistR?: number; // forearm twist (y)
  rollL?: number; rollR?: number; // upper-arm inward roll (y)
  handL?: [number, number, number]; handR?: [number, number, number];
  legL: number; legR: number; knee: number;
  gL: Gesture; gR: Gesture;
}

function poseSpec(pose: Pose): PoseSpec {
  const v: PoseSpec = { armL: [0.12, 0.03], armR: [-0.12, 0.03], foreL: [0.06, -0.16], foreR: [-0.06, -0.16], rollL: 0.12, rollR: -0.12, legL: 0, legR: 0, knee: 0, gL: 'relaxed', gR: 'relaxed' };
  switch (pose) {
    case 'waving':
      return { ...v, armR: [-2.45, 0.1], foreR: [-0.5, 0], gR: 'wave', twistR: -0.3 };
    case 'celebrating':
      return { ...v, armL: [2.55, 0.1], armR: [-2.55, 0.1], foreL: [0.25, 0], foreR: [-0.25, 0], gL: 'open', gR: 'open' };
    case 'thumbsup':
      return { ...v, armR: [-0.25, -0.55], foreR: [0, -1.3], twistR: 0, gR: 'thumbsup' };
    case 'sitting':
      return { ...v, legL: -1.45, legR: -1.45, knee: 1.45, armL: [0.16, -0.35], armR: [-0.16, -0.35], foreL: [0, -0.55], foreR: [0, -0.55] };
    case 'pointing':
      return { ...v, armR: [-0.3, -1.25], foreR: [0, -0.25], twistR: -1.4, gR: 'point' };
    case 'peace':
      return { ...v, armR: [-0.55, -0.35], foreR: [0, -2.2], twistR: -1.3, gR: 'peace', handR: [0, 0, -0.2] };
    case 'crossed':
      return { ...v, armL: [0.3, -0.22], armR: [-0.3, -0.3], rollL: 1.05, rollR: -1.05, foreL: [0, -1.75], foreR: [0, -1.68], gL: 'fist', gR: 'fist' };
    case 'pockets':
      return { ...v, armL: [0.34, 0.05], armR: [-0.34, 0.05], foreL: [-0.62, -0.3], foreR: [0.62, -0.3], gL: 'pocket', gR: 'pocket' };
    default:
      return v;
  }
}

/**
 * The sculpted body: one continuous skin mesh + finely sculpted hands, posed by a skeleton.
 * `head` hangs off the head bone; `children` (clothes) receive the skeleton.
 */
export function SculptBody({ look, body, pose, animate, head, clothes, skirt = 0, feet = true }: { /** bare feet visible (no socks / shoes) */ feet?: boolean; look: Look; body: BodyP; pose: Pose; animate: boolean; head: ReactNode; clothes?: (skeleton: THREE.Skeleton, bones: THREE.Bone[]) => ReactNode; /** extra arm spread so hands clear a wide skirt (radians) */ skirt?: number }) {
  const J = jointsFor(body);
  const rig = useMemo(() => createRig(J), [J]);
  const skinGeo = useSculpt({ k: 'body', bp: body })?.[0]?.geo ?? null;
  const handRes = useSculpt({ k: 'hands', bp: body });
  const handGeo = handRes?.[0]?.geo ?? null;
  const nailGeo = handRes?.find((p) => p.role === 'trim')?.geo ?? null;
  const footGeo = useSculpt(feet ? { k: 'feet', bp: body } : null)?.[0]?.geo ?? null;
  const spec = useMemo(() => {
    const sp = poseSpec(pose);
    // arms that hang by the sides open out just enough to clear a skirt / long coat
    if (skirt > 0 && Math.abs(sp.armL[0]) < 0.4) sp.armL = [sp.armL[0] + skirt, sp.armL[1]];
    if (skirt > 0 && Math.abs(sp.armR[0]) < 0.4) sp.armR = [sp.armR[0] - skirt, sp.armR[1]];
    return sp;
  }, [pose, skirt]);
  const { bones } = rig;
  const legLift = (J.pos[B.thighL][1] - J.pos[B.footL][1]) * (LEG_STRETCH - 1);

  function apply(t: number) {
    const s = (f: number, a: number, ph = 0) => Math.sin(t * f + ph) * a;
    const swing = pose === 'walking' ? s(4, 0.45) : pose === 'dancing' ? s(5, 0.55) : 0;
    const breathe = s(1.5, 0.015);
    const uaL = bones[B.upperArmL], uaR = bones[B.upperArmR];
    uaL.rotation.set(spec.armL[1] + (pose === 'walking' ? swing : 0), spec.rollL ?? 0, -(spec.armL[0] - REST_ARM + (pose === 'celebrating' ? s(6, 0.12) : pose === 'dancing' ? 0.9 + s(5, 0.4) : breathe)));
    uaR.rotation.set(spec.armR[1] + (pose === 'walking' ? -swing : 0), spec.rollR ?? 0, -(spec.armR[0] + REST_ARM + (pose === 'waving' ? s(6, 0.2) : pose === 'celebrating' ? s(6, -0.12, 1) : pose === 'dancing' ? -0.9 + s(5, 0.4, Math.PI) : -breathe)));
    bones[B.foreArmL].rotation.set(spec.foreL[1], spec.twistL ?? 0, -spec.foreL[0]);
    bones[B.foreArmR].rotation.set(spec.foreR[1], spec.twistR ?? 0, -(spec.foreR[0] + (pose === 'waving' ? s(6, 0.3, 1) : 0)));
    bones[B.handL].rotation.set(...(spec.handL ?? [0, 0, 0]));
    bones[B.handR].rotation.set(...(spec.handR ?? [0, 0, 0]));
    bones[B.thighL].rotation.x = spec.legL + (pose === 'walking' ? -swing * 0.8 : pose === 'dancing' ? s(5, 0.15) : 0);
    bones[B.thighR].rotation.x = spec.legR + (pose === 'walking' ? swing * 0.8 : pose === 'dancing' ? s(5, -0.15) : 0);
    bones[B.shinL].rotation.x = spec.knee + (pose === 'walking' ? Math.max(0, s(4, 0.5)) : 0);
    bones[B.shinR].rotation.x = spec.knee + (pose === 'walking' ? Math.max(0, s(4, -0.5)) : 0);
    // feet stay level when sitting
    bones[B.footL].rotation.x = bones[B.footR].rotation.x = pose === 'sitting' ? 0 : 0;
    const pel = bones[B.pelvis];
    // longer legs: each thigh bone is stretched along its length (thigh + shin skin and trousers stretch
    // with it), the feet are scaled back to normal height, and the body rises so the soles stay on the ground
    for (const b of [B.thighL, B.thighR]) bones[b].scale.set(1, LEG_STRETCH, 1);
    for (const b of [B.footL, B.footR]) bones[b].scale.set(1, 1 / LEG_STRETCH, 1);
    pel.position.y = J.pos[B.pelvis][1] + legLift * (pose === 'sitting' ? 0.52 : 1) + (pose === 'dancing' ? Math.abs(s(5, 0.05)) : 0) + (pose === 'walking' ? Math.abs(s(8, 0.02)) : 0) + (pose === 'sitting' ? -0.4 : 0);
    // relaxed stance: weight on the left leg, hips tilt a touch, the free leg turns out slightly
    const rest = pose === 'standing';
    pel.rotation.set(0, pose === 'dancing' ? s(1.25, 0.25) : rest ? 0.06 : 0, pose === 'dancing' ? s(2.5, 0.07) : rest ? 0.035 : 0);
    if (rest) {
      bones[B.thighL].rotation.z = -0.035;
      bones[B.thighR].rotation.z = -0.075;
      bones[B.thighR].rotation.y = -0.12;
      bones[B.shinR].rotation.x = 0.1;
      bones[B.thighR].rotation.x -= 0.04;
    } else {
      bones[B.thighL].rotation.z = bones[B.thighR].rotation.z = bones[B.thighR].rotation.y = 0;
    }
    bones[B.chest].rotation.set(s(1.5, 0.008), rest ? -0.05 : 0, rest ? -0.03 : 0);
    const hd = bones[B.head];
    hd.rotation.y = pose === 'standing' || pose === 'sitting' ? s(0.45, 0.16) + s(0.23, 0.08) : pose === 'waving' ? 0.12 : 0;
    hd.rotation.z = pose === 'dancing' ? s(2.5, -0.1) : s(0.6, 0.035);
    hd.rotation.x = look.expression === 'sad' || look.expression === 'crying' ? 0.14 : look.expression === 'sleeping' ? 0.2 : s(0.5, 0.025) - 0.02;
  }
  useLayoutEffect(() => {
    applyGesture(bones, -1, spec.gL);
    applyGesture(bones, 1, spec.gR);
    apply(0.3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rig, spec, look.expression]);
  useFrame(({ clock }) => {
    if (animate) apply(clock.getElapsedTime());
  });

  const hb = J.pos[B.head];
  return (
    <group>
      <primitive object={rig.group} />
      {skinGeo && (
        <Skinned geometry={skinGeo} skeleton={rig.skeleton}>
          <SkinMat color={look.skin} />
        </Skinned>
      )}
      {handGeo && (
        <Skinned geometry={handGeo} skeleton={rig.skeleton}>
          <SkinMat color={look.skin} />
        </Skinned>
      )}
      {nailGeo && (
        <Skinned geometry={nailGeo} skeleton={rig.skeleton}>
          <SkinMat color={nailTone(look.skin)} nail />
        </Skinned>
      )}
      {feet && footGeo && (
        <Skinned geometry={footGeo} skeleton={rig.skeleton}>
          <SkinMat color={look.skin} />
        </Skinned>
      )}
      {clothes?.(rig.skeleton, bones)}
      {createPortal(
        <group position={[0, HEAD_Y - hb[1], 0.01 - hb[2]]} scale={HEAD_SCALE}>
          {head}
        </group>,
        bones[B.head],
      )}
    </group>
  );
}
