import { memo, useMemo } from 'react';
import { createPortal } from '@react-three/fiber';
import { headFromParams } from '../sculptV2';
import { variant, type Look, type Pose } from '../look/config';
import { B } from '../sculpt3d/anatomy';
import { Face } from './Face';
import { Glasses, Hat, HeadExtra } from './Accessories';
import { Bag } from './Clothes';
import { SculptBody } from './SculptBody';
import { SculptClothes } from './SculptClothes';
import { SculptHair } from './SculptHair';
import { outfit } from './lookParts';

/** Head centre when only the head is drawn (head thumbnails, Avatar Cam). */
const HEAD_ONLY_Y = 1.98;
/** The bag accessory was authored in the old body space, which sat this much higher. */
const OLD_LIFT = 0.88 * (1.14 - 1);

/** Eye placement, shared with glasses. */
export function eyeMetrics(look: Look, hx: { rx: number }) {
  const e = variant(look, 'eyes')!.p;
  return { ex: 0.127 * (hx.rx / 0.35) * (1 + look.tune.eyeGap * 0.14), ey: -0.025, er: 0.071 * e.size * (1 + look.tune.eyeSize * 0.16) };
}

/**
 * The avatar: a sculpted, skinned body (one continuous skin, real hands), sculpted clothes and
 * hair, and the expressive face. Pieces appear as soon as they're sculpted (off the UI thread).
 */
export const Figure = memo(function Figure({ look, animate = true, poseOverride, mirror = false, only, faceless = false }: { look: Look; animate?: boolean; poseOverride?: Pose; mirror?: boolean; only?: 'head'; faceless?: boolean }) {
  const pose = poseOverride ?? look.pose;
  const body = variant(look, 'body')!.p;
  const h = useMemo(() => headFromParams(variant(look, 'head')!.p, look.tune.face), [look]);
  const o = outfit(look);
  const em = eyeMetrics(look, h);

  const headInner = (
    <>
      <Face
        h={h}
        skin={look.skin}
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
      {look.pick.hair != null && <SculptHair h={h} p={variant(look, 'hair')!.p} color={look.color.hair ?? '#2a1d16'} tip={look.color.hairTip ?? null} seed={look.pick.hair} hatOn={!!o.hat} />}
      {o.hat && <Hat w={o.hat} h={h} />}
      {o.glasses && <Glasses w={o.glasses} h={h} {...em} />}
      {look.pick.headExtra != null && <HeadExtra p={variant(look, 'headExtra')!.p} h={h} />}
    </>
  );
  if (only === 'head') return <group position={[0, HEAD_ONLY_Y, 0.01]}>{headInner}</group>;

  const H = body.height;
  const seated = pose === 'sitting';
  return (
    <group scale={[mirror ? -H : H, H, H]}>
      {seated && (
        <mesh position={[0, 0.28, -0.06]} receiveShadow castShadow>
          <cylinderGeometry args={[0.36, 0.32, 0.56, 40]} />
          <meshPhysicalMaterial color="#2a211c" roughness={0.6} sheen={1} sheenColor="#5a4636" />
        </mesh>
      )}
      <SculptBody
        look={look}
        body={body}
        pose={pose}
        animate={animate}
        head={headInner}
        clothes={(sk, bones) => (
          <>
            <SculptClothes body={body} top={o.top} outer={o.outer} bottom={o.bottom} dress={o.dress} socks={o.socks} shoes={o.shoes} skeleton={sk} />
            {o.bag && createPortal(<group position={[0, OLD_LIFT - 1.05, 0]}><Bag w={o.bag} width={body.width} /></group>, bones[B.pelvis])}
          </>
        )}
      />
    </group>
  );
});
