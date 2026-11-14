import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { lathe, mix } from '../sculpt';
import { headFromParams } from '../sculptV2';
import { variant, type Look, type Pose, type ColorKey } from '../look/config';
import type { Wear } from '../look/fashion';
import { Face, SkinMat } from './Face';
import { Hair } from './Hair';
import { Glasses, Hat, HeadExtra } from './Accessories';
import { Bag, Cloth, DressGarment, PantLeg, Shoe, Sock, TorsoGarment, pantsStyle, sleeveStyle, sockHeight, torsoProfile } from './Clothes';

const HEAD_Y = 1.98;
const BASE_TEE: Wear = { cut: 'Tank', pattern: 'solid', c1: '#e9e2d6', c2: '#e9e2d6', c3: '#e9e2d6' };
const BASE_SHORTS: Wear = { cut: 'Shorts', pattern: 'solid', c1: '#4a433d', c2: '#4a433d', c3: '#4a433d' };

function wear(look: Look, slot: 'top' | 'outer' | 'bottom' | 'dress' | 'shoes' | 'socks' | 'bag' | 'hat' | 'glasses'): Wear | null {
  const v = variant(look, slot);
  if (!v) return null;
  const c = slot === 'glasses' ? null : look.color[slot as ColorKey];
  return c ? { ...v.p, c1: c } : v.p;
}

/** Eye placement, shared with glasses. */
export function eyeMetrics(look: Look, hx: { rx: number }) {
  const e = variant(look, 'eyes')!.p;
  return { ex: 0.132 * (hx.rx / 0.35) * (1 + look.tune.eyeGap * 0.14), ey: -0.025, er: 0.08 * e.size * (1 + look.tune.eyeSize * 0.16) };
}

export const Figure = memo(function Figure({ look, animate = true, poseOverride, mirror = false, only, faceless = false }: { look: Look; animate?: boolean; poseOverride?: Pose; mirror?: boolean; only?: 'head'; faceless?: boolean }) {
  const pose = poseOverride ?? look.pose;
  const body = variant(look, 'body')!.p;
  const h = useMemo(() => headFromParams(variant(look, 'head')!.p, look.tune.face), [look]);
  const skin = look.skin;
  const b = body.width;
  const H = body.height;
  const dress = wear(look, 'dress');
  const top = dress ? null : wear(look, 'top') ?? (wear(look, 'outer') ? null : BASE_TEE);
  const outer = wear(look, 'outer');
  const bottom = dress ? null : wear(look, 'bottom') ?? BASE_SHORTS;
  const shoes = wear(look, 'shoes');
  const socks = wear(look, 'socks');
  const bag = wear(look, 'bag');
  const hat = wear(look, 'hat');
  const glasses = wear(look, 'glasses');
  const seated = pose === 'sitting';
  const sleeveSrc = outer ?? top ?? dress ?? BASE_TEE;
  const sl = sleeveStyle(sleeveSrc.cut);
  const ps = bottom ? pantsStyle(bottom.cut) : null;
  const em = eyeMetrics(look, h);

  const refs = {
    root: useRef<THREE.Group>(null), body: useRef<THREE.Group>(null), head: useRef<THREE.Group>(null),
    armL: useRef<THREE.Group>(null), armR: useRef<THREE.Group>(null), foreL: useRef<THREE.Group>(null), foreR: useRef<THREE.Group>(null),
    legL: useRef<THREE.Group>(null), legR: useRef<THREE.Group>(null), kneeL: useRef<THREE.Group>(null), kneeR: useRef<THREE.Group>(null),
  };
  const base = useMemo(() => {
    const v = { armL: 0.09, armR: -0.09, foreL: 0.05, foreR: -0.05, armLx: -0.06, armRx: -0.06, foreLx: -0.22, foreRx: -0.22, legL: 0, legR: 0, knee: 0 };
    if (pose === 'waving') Object.assign(v, { armR: -2.5, foreR: -0.55, foreRx: 0 });
    if (pose === 'celebrating') Object.assign(v, { armL: 2.6, armR: -2.6, foreL: 0.2, foreR: -0.2, foreLx: 0, foreRx: 0 });
    if (pose === 'thumbsup') Object.assign(v, { armR: -0.2, armRx: -0.5, foreRx: -1.35, foreR: 0 });
    if (pose === 'sitting') Object.assign(v, { legL: -1.45, legR: -1.45, knee: 1.45, armL: 0.18, armR: -0.18, armLx: -0.35, armRx: -0.35, foreLx: -0.5, foreRx: -0.5 });
    return v;
  }, [pose]);

  useFrame(({ clock }) => {
    if (!animate) return;
    const t = clock.getElapsedTime();
    const s = (f: number, a: number, ph = 0) => Math.sin(t * f + ph) * a;
    const swing = pose === 'walking' ? s(4, 0.45) : pose === 'dancing' ? s(5, 0.55) : 0;
    const r = refs;
    if (r.body.current) {
      r.body.current.position.y = (pose === 'dancing' ? Math.abs(s(5, 0.05)) : s(1.5, 0.006)) + (seated ? -0.4 : 0);
      r.body.current.rotation.z = pose === 'dancing' ? s(2.5, 0.07) : 0;
      r.body.current.rotation.y = pose === 'dancing' ? s(1.25, 0.25) : 0;
    }
    if (r.head.current) {
      r.head.current.rotation.y = pose === 'standing' || pose === 'sitting' ? s(0.45, 0.16) + s(0.23, 0.08) : pose === 'waving' ? 0.12 : 0;
      r.head.current.rotation.z = pose === 'dancing' ? s(2.5, -0.1) : s(0.6, 0.035);
      r.head.current.rotation.x = look.expression === 'sad' || look.expression === 'crying' ? 0.14 : look.expression === 'sleeping' ? 0.2 : s(0.5, 0.025) - 0.02;
    }
    if (r.armL.current) {
      r.armL.current.rotation.z = -(base.armL + (pose === 'celebrating' ? s(6, 0.15) : pose === 'dancing' ? 0.9 + s(5, 0.4) : s(1.5, 0.015)));
      r.armL.current.rotation.x = base.armLx + (pose === 'walking' ? swing : 0);
    }
    if (r.armR.current) {
      r.armR.current.rotation.z = -(base.armR + (pose === 'waving' ? s(6, 0.22) : pose === 'celebrating' ? s(6, -0.15, 1) : pose === 'dancing' ? -0.9 + s(5, 0.4, Math.PI) : s(1.5, -0.015)));
      r.armR.current.rotation.x = base.armRx + (pose === 'walking' ? -swing : 0);
    }
    if (r.foreR.current) {
      r.foreR.current.rotation.z = -(base.foreR + (pose === 'waving' ? s(6, 0.35, 1) : 0));
      r.foreR.current.rotation.x = base.foreRx;
    }
    if (r.foreL.current) {
      r.foreL.current.rotation.z = -base.foreL;
      r.foreL.current.rotation.x = base.foreLx;
    }
    if (r.legL.current) r.legL.current.rotation.x = base.legL + (pose === 'walking' ? -swing * 0.8 : pose === 'dancing' ? s(5, 0.15) : 0);
    if (r.legR.current) r.legR.current.rotation.x = base.legR + (pose === 'walking' ? swing * 0.8 : pose === 'dancing' ? s(5, -0.15) : 0);
    if (r.kneeL.current) r.kneeL.current.rotation.x = base.knee + (pose === 'walking' ? Math.max(0, s(4, 0.5)) : 0);
    if (r.kneeR.current) r.kneeR.current.rotation.x = base.knee + (pose === 'walking' ? Math.max(0, s(4, -0.5)) : 0);
    if (r.root.current) r.root.current.position.y = pose === 'walking' ? Math.abs(s(8, 0.025)) : 0;
  });

  const torsoSkin = useMemo(() => lathe(torsoProfile(body, 1.0, -0.004), 40), [body]);
  const hips = useMemo(() => lathe([[0.0, 0.8], [0.17 * body.hips, 0.81], [0.232 * body.hips, 0.88], [0.25 * body.hips, 0.96], [0.242 * body.hips, 1.04], [0.0, 1.05]], 40), [body]);

  const head = (
    <group ref={refs.head} position={[0, HEAD_Y, 0.01]}>
      <Face
        h={h}
        skin={skin}
        eyes={variant(look, 'eyes')!.p}
        lashes={variant(look, 'lashes')?.p ?? null}
        brows={variant(look, 'brows')!.p}
        nose={variant(look, 'nose')!.p}
        mouth={variant(look, 'mouth')!.p}
        ears={variant(look, 'ears')!.p}
        beard={variant(look, 'beard')?.p ?? null}
        colors={{ eyes: look.color.eyes ?? '#4e2f1f', brows: look.color.brows ?? '#2f1d14', beard: look.color.beard ?? look.color.hair ?? '#2f1d14', lips: look.color.lips ?? null, shadow: look.color.shadow ?? null, blush: look.color.blush ?? null, liner: look.color.liner ?? null }}
        tune={look.tune}
        expression={look.expression}
        animate={animate}
        faceless={faceless}
        piercings={{ earL: variant(look, 'earL')?.p ?? null, earR: variant(look, 'earR')?.p ?? null, nose: variant(look, 'nosePierce')?.p ?? null, brow: variant(look, 'browPierce')?.p ?? null, lip: variant(look, 'lipPierce')?.p ?? null, tongue: variant(look, 'tonguePierce')?.p ?? null }}
        hearing={{ L: variant(look, 'hearingL')?.p ?? null, R: variant(look, 'hearingR')?.p ?? null }}
      />
      {look.pick.hair != null && <Hair h={h} p={variant(look, 'hair')!.p} color={look.color.hair ?? '#2a1d16'} tip={look.color.hairTip ?? null} seed={look.pick.hair} hatOn={!!hat} />}
      {hat && <Hat w={hat} h={h} />}
      {glasses && <Glasses w={glasses} h={h} {...em} />}
      {look.pick.headExtra != null && <HeadExtra p={variant(look, 'headExtra')!.p} h={h} />}
    </group>
  );
  if (only === 'head') return head;

  return (
    <group ref={refs.root} scale={[mirror ? -H : H, H, H]}>
      {seated && (
        <mesh position={[0, 0.28, -0.06]} receiveShadow castShadow>
          <cylinderGeometry args={[0.36, 0.32, 0.56, 40]} />
          <meshPhysicalMaterial color="#2a211c" roughness={0.6} sheen={1} sheenColor="#5a4636" />
        </mesh>
      )}
      <group ref={refs.body}>
        {/* Legs */}
        {[-1, 1].map((side) => {
          const short = !dress && ps?.short;
          return (
            <group key={side} ref={side < 0 ? refs.legL : refs.legR} position={[side * 0.115 * b * body.hips, 0.88, 0]}>
              <mesh position={[0, -0.19, 0]} castShadow>
                <capsuleGeometry args={[0.094 * Math.min(b, 1.12), 0.26, 8, 20]} />
                <SkinMat color={skin} />
              </mesh>
              {bottom && ps && <PantLeg w={bottom} r0={ps.thighR * Math.min(b, 1.12)} r1={short ? ps.thighR * 0.98 : (ps.thighR + ps.ankleR) / 2 + 0.005} y0={0.08} y1={short ? -0.3 : -0.42} />}
              <group ref={side < 0 ? refs.kneeL : refs.kneeR} position={[0, -0.4, 0]}>
                <mesh position={[0, -0.2, 0]} castShadow>
                  <capsuleGeometry args={[0.08, 0.3, 8, 20]} />
                  <SkinMat color={skin} />
                </mesh>
                {socks && <Sock w={socks} height={sockHeight(socks.cut)} />}
                {bottom && ps && !short && <PantLeg w={bottom} r0={(ps.thighR + ps.ankleR) / 2 + 0.005} r1={ps.ankleR} y0={0.03} y1={ps.cuff ? -0.38 : -0.42} flareOut={bottom.cut === 'Flared jeans' ? 0.03 : 0} />}
                {bottom && ps?.cuff && (
                  <mesh position={[0, -0.4, 0]}>
                    <cylinderGeometry args={[0.082, 0.082, 0.05, 24]} />
                    <Cloth color={mix(bottom.c1, '#000000', 0.1)} />
                  </mesh>
                )}
                {bottom && ps?.cargo && (
                  <mesh position={[side * 0.1, 0.05, 0.0]}>
                    <boxGeometry args={[0.03, 0.12, 0.09]} />
                    <Cloth w={bottom} shade={-0.08} />
                  </mesh>
                )}
                {shoes ? <Shoe w={shoes} skin={skin} /> : (
                  <mesh position={[0, -0.415, 0.035]} scale={[0.07, 0.045, 0.13]}>
                    <sphereGeometry args={[1, 18, 12]} />
                    <SkinMat color={skin} />
                  </mesh>
                )}
              </group>
            </group>
          );
        })}

        {/* Pelvis + torso */}
        <mesh geometry={hips} scale={[b, 1, 0.7]} castShadow>
          {bottom ? <Cloth w={bottom} /> : <SkinMat color={skin} />}
        </mesh>
        <mesh geometry={torsoSkin} scale={[b, 1, 0.66]}>
          <SkinMat color={skin} />
        </mesh>
        {dress && <DressGarment w={dress} body={body} />}
        {top && <TorsoGarment w={top} body={body} layer={0} />}
        {outer && <TorsoGarment w={outer} body={body} layer={1} />}
        {bag && <Bag w={bag} width={b} />}

        {/* Arms */}
        {[-1, 1].map((side) => {
          const sleeveCol = sleeveSrc;
          const R = 0.072 * Math.min(b, 1.1);
          const wide = sl.wide;
          return (
            <group key={side} ref={side < 0 ? refs.armL : refs.armR} position={[side * (0.255 * b * body.shoulders + 0.035), 1.53, 0]}>
              <mesh castShadow>
                <sphereGeometry args={[0.088 * Math.min(b, 1.1) * (sl.len === 'none' ? 0.9 : 1 + sl.puff * 0.3), 24, 18]} />
                {sl.len === 'none' ? <SkinMat color={skin} /> : <Cloth w={sleeveCol} />}
              </mesh>
              <mesh position={[0, -0.16, 0]} castShadow>
                <capsuleGeometry args={[R, 0.22, 8, 20]} />
                <SkinMat color={skin} />
              </mesh>
              {sl.len !== 'none' && (
                <mesh position={[0, sl.len === 'short' ? -0.07 : -0.16, 0]}>
                  <cylinderGeometry args={[R * 1.2 * wide, R * 1.28 * wide * (1 + sl.puff * 0.2), sl.len === 'short' ? 0.15 : 0.34, 24, 1, true]} />
                  <Cloth w={sleeveCol} side={THREE.DoubleSide} />
                </mesh>
              )}
              <group ref={side < 0 ? refs.foreL : refs.foreR} position={[0, -0.32, 0]}>
                <mesh>
                  <sphereGeometry args={[0.068, 18, 14]} />
                  {sl.len === 'long' ? <Cloth w={sleeveCol} /> : <SkinMat color={skin} />}
                </mesh>
                <mesh position={[0, -0.13, 0]} castShadow>
                  <capsuleGeometry args={[0.064, 0.2, 8, 20]} />
                  <SkinMat color={skin} />
                </mesh>
                {(sl.len === 'long' || sl.len === 'elbow') && (
                  <mesh position={[0, sl.len === 'elbow' ? -0.02 : -0.12, 0]}>
                    <cylinderGeometry args={[0.078 * wide * (1 + sl.puff * 0.3), 0.074 * wide * (1 + sl.puff * 0.2), sl.len === 'elbow' ? 0.08 : 0.26, 24, 1, true]} />
                    <Cloth w={sleeveCol} side={THREE.DoubleSide} />
                  </mesh>
                )}
                <Hand skin={skin} side={side} thumbsUp={pose === 'thumbsup' && side > 0} wave={pose === 'waving' && side > 0} />
              </group>
            </group>
          );
        })}

        <mesh position={[0, 1.68, 0]} castShadow>
          <cylinderGeometry args={[0.072, 0.085, 0.16, 24]} />
          <SkinMat color={skin} />
        </mesh>
        {head}
      </group>
    </group>
  );
});

function Hand({ skin, side, thumbsUp, wave }: { skin: string; side: number; thumbsUp: boolean; wave: boolean }) {
  return (
    <group position={[0, -0.31, 0]} rotation={[0, wave ? side * -0.4 : 0, 0]} scale={1.25}>
      <mesh scale={[0.05, 0.066, 0.03]} castShadow>
        <sphereGeometry args={[1, 18, 14]} />
        <SkinMat color={skin} />
      </mesh>
      {[-1.5, -0.5, 0.5, 1.5].map((k) => (
        <mesh key={k} position={[k * 0.0105, thumbsUp ? -0.03 : -0.062, thumbsUp ? 0.02 : 0]} rotation={[thumbsUp ? -1.4 : 0.1, 0, 0]}>
          <capsuleGeometry args={[0.0085, thumbsUp ? 0.016 : 0.028 - Math.abs(k) * 0.003, 4, 8]} />
          <SkinMat color={skin} />
        </mesh>
      ))}
      <mesh position={[side * -0.042, thumbsUp ? 0.05 : -0.01, 0.018]} rotation={[thumbsUp ? 0 : 0.2, 0, thumbsUp ? 0 : side * 0.5]}>
        <capsuleGeometry args={[0.012, thumbsUp ? 0.04 : 0.028, 4, 8]} />
        <SkinMat color={skin} />
      </mesh>
    </group>
  );
}
