import * as THREE from 'three';
import type { BodyP } from '../look/face';
import { BONE_COUNT, PARENT, B, softenArmpits, bodyParts, footParts, handParts, joints, fingerBone, nailPrims, type Joints } from './anatomy';
import { Field } from './sdf';
import { GeoCache, meshField } from './mesh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** A fresh skeleton (per figure instance) whose rest pose matches the sculpted meshes. */
export function createRig(J: Joints) {
  const group = new THREE.Group();
  const bones: THREE.Bone[] = [];
  for (let i = 0; i < BONE_COUNT; i++) {
    const b = new THREE.Bone();
    b.name = 'b' + i;
    bones.push(b);
  }
  for (let i = 0; i < BONE_COUNT; i++) {
    const p = PARENT[i];
    const wp = J.pos[i];
    if (p < 0) {
      bones[i].position.set(wp[0], wp[1], wp[2]);
      group.add(bones[i]);
    } else {
      const pp = J.pos[p];
      bones[i].position.set(wp[0] - pp[0], wp[1] - pp[1], wp[2] - pp[2]);
      bones[p].add(bones[i]);
    }
  }
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  return { group, bones, skeleton };
}

const bodyKey = (bp: BodyP) => `${bp.width.toFixed(3)}|${bp.height.toFixed(3)}|${bp.belly.toFixed(3)}|${bp.shoulders.toFixed(3)}|${bp.hips.toFixed(3)}|${bp.fem ?? 0}`;
const jointCache = new GeoCache<Joints>(32);
export const jointsFor = (bp: BodyP) => jointCache.get(bodyKey(bp), () => joints(bp));

const bodyGeo = new GeoCache<THREE.BufferGeometry>(12);
/** The continuous skin mesh (cached per body shape). */
export function bodyGeometry(bp: BodyP): THREE.BufferGeometry {
  return bodyGeo.get(bodyKey(bp), () => {
    const J = jointsFor(bp);
    const f = new Field(bodyParts(J), 0.04);
    return softenArmpits(meshField(f, { cell: 0.0105, skin: 0.025 }), J);
  });
}

const handGeo = new GeoCache<THREE.BufferGeometry>(12);
/** Both hands as one mesh, finely meshed (fingers need ~3 mm cells). */
export function handsGeometry(bp: BodyP): THREE.BufferGeometry {
  return handGeo.get(bodyKey(bp), () => {
    const J = jointsFor(bp);
    // each hand on its own small grid (one grid spanning both would be mostly empty space)
    const one = (side: -1 | 1) => meshField(new Field(handParts(J, side), 0.015, 0.04), { cell: 0.0034, skin: 0.008, pad: 0.004 });
    return mergeGeometries([one(-1), one(1)]);
  });
}

const nailGeo = new GeoCache<THREE.BufferGeometry>(12);
/** Fingernails for both hands (a lighter, glossier skin tone in the renderer). */
export function nailsGeometry(bp: BodyP): THREE.BufferGeometry {
  return nailGeo.get(bodyKey(bp), () => {
    const J = jointsFor(bp);
    const one = (side: -1 | 1) => meshField(new Field([{ prims: nailPrims(J, side) }], 0.004, 0.01), { cell: 0.0018, skin: 0.003, pad: 0.002 });
    return mergeGeometries([one(-1), one(1)]);
  });
}

const feetGeo = new GeoCache<THREE.BufferGeometry>(12);
/** Both bare feet (heel, arch, ball, five toes), finely meshed. Hidden under socks / shoes. */
export function feetGeometry(bp: BodyP): THREE.BufferGeometry {
  return feetGeo.get(bodyKey(bp), () => {
    const J = jointsFor(bp);
    const one = (side: -1 | 1) => meshField(new Field(footParts(J, side), 0.02, 0.04), { cell: 0.004, skin: 0.01, pad: 0.004 });
    return mergeGeometries([one(-1), one(1)]);
  });
}

// ---------------------------------------------------------------------------- gestures

export type Gesture = 'relaxed' | 'open' | 'fist' | 'point' | 'peace' | 'thumbsup' | 'wave' | 'pocket';

/** Finger curl (radians) per finger [thumb, index, middle, ring, pinky], [base, tip]. */
const CURL: Record<Gesture, [number, number][]> = {
  // natural rest: a soft cascade — index nearly straight, each finger toward the pinky a bit more curled
  relaxed: [[0.15, 0.15], [0.16, 0.22], [0.22, 0.3], [0.28, 0.36], [0.34, 0.44]],
  open: [[0.0, 0.05], [0.05, 0.05], [0.04, 0.05], [0.05, 0.06], [0.06, 0.08]],
  wave: [[-0.1, 0.0], [0.0, 0.02], [0.0, 0.02], [0.02, 0.03], [0.04, 0.05]],
  fist: [[0.55, 0.7], [1.45, 1.6], [1.5, 1.65], [1.5, 1.6], [1.45, 1.55]],
  point: [[0.55, 0.7], [0.0, 0.05], [1.5, 1.65], [1.5, 1.6], [1.45, 1.55]],
  peace: [[0.6, 0.8], [0.0, 0.04], [0.0, 0.04], [1.5, 1.6], [1.45, 1.55]],
  thumbsup: [[-0.25, -0.1], [1.45, 1.6], [1.5, 1.65], [1.5, 1.6], [1.45, 1.55]],
  pocket: [[0.2, 0.2], [0.4, 0.5], [0.45, 0.55], [0.5, 0.55], [0.55, 0.6]],
};
/** Sideways spread of each finger (radians) per gesture. */
const SPREAD: Partial<Record<Gesture, number[]>> = {
  open: [0.25, 0.1, 0.02, -0.06, -0.14],
  wave: [0.35, 0.14, 0.03, -0.09, -0.2],
  peace: [0.1, 0.16, -0.14, 0, 0],
};

/** Thumb [swing out/forward (x), fold toward the palm (z), tip bend] per gesture. */
const THUMB: Record<Gesture, [number, number, number]> = {
  relaxed: [-0.22, 0.16, 0.15],
  open: [-0.55, -0.1, 0.05],
  wave: [-0.65, -0.15, 0.0],
  fist: [-0.25, 0.75, 0.55],
  point: [-0.25, 0.8, 0.5],
  peace: [-0.25, 0.85, 0.55],
  thumbsup: [-1.35, 0.0, -0.05],
  pocket: [-0.2, 0.25, 0.25],
};

/** Pose the fingers of one hand. */
export function applyGesture(bones: THREE.Bone[], side: -1 | 1, g: Gesture) {
  const s = side < 0 ? 0 : 1;
  const palmIn = -side; // curl direction: toward the palm (+x for the left hand)
  const curl = CURL[g];
  const spread = SPREAD[g];
  for (let f = 0; f < 5; f++) {
    const b0 = bones[fingerBone(s, f, 0)], b1 = bones[fingerBone(s, f, 1)];
    if (f === 0) {
      // the thumb swings forward/out (x) and folds across the palm (z)
      const [rx, rz, tip] = THUMB[g];
      b0.rotation.set(rx, 0, palmIn * rz);
      b1.rotation.set(0, 0, palmIn * tip);
    } else {
      b0.rotation.set(spread ? -spread[f] : 0, 0, palmIn * curl[f][0]); // −x rotation fans toward the front (+z)
      b1.rotation.set(0, 0, palmIn * curl[f][1]);
    }
  }
}

export { B };
