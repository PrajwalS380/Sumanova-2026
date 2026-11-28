// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GROUP_SPECS, GROUPS, HairMotion, withHairAtRest, registerHairMotion, hairStill, type HeadPose } from './hairMotion';
import { groomHair } from '../sculpt3d/groom';
import { pack, unpack } from '../sculpt3d/jobs';
import { HAIRSTYLES, hairId } from '../look/hair';
import { HEADS } from '../look/face';
import { headFromParams } from '../sculptV2';

// sumanova-us-108: per-lock secondary motion
const R = 0.26;
const pose = (t: number, yawAt: (t: number) => number = () => 0): HeadPose => {
  const yaw = yawAt(t);
  return { px: 0, py: 2, pz: 0, qx: 0, qy: Math.sin(yaw / 2), qz: 0, qw: Math.cos(yaw / 2), radius: R };
};
const turn = (t: number) => (t < 0.6 ? 0.6 * (t / 0.6) ** 2 * (3 - 2 * t / 0.6) : 0.6);
const run = (fps: number, secs: number, yawAt = turn) => {
  const m = new HairMotion();
  m.breeze = false;
  const n = Math.round(secs * fps);
  for (let i = 0; i <= n; i++) m.step(1 / fps, pose(i / fps, yawAt));
  return m;
};

describe('HairMotion solver', () => {
  it('stays at rest with no motion', () => {
    const m = run(60, 3, () => 0);
    for (const v of m.tip) expect(Math.abs(v)).toBeLessThan(1e-6);
  });

  it('a head turn swings the back hair, which then settles', () => {
    const m = new HairMotion();
    m.breeze = false;
    let peak = 0;
    for (let i = 0; i <= 120; i++) {
      m.step(1 / 60, pose(i / 60, turn));
      peak = Math.max(peak, Math.hypot(m.tip[9], m.tip[11]));
    }
    expect(peak).toBeGreaterThan(0.1);
    for (let i = 121; i <= 300; i++) m.step(1 / 60, pose(i / 60, turn));
    expect(Math.hypot(m.tip[9], m.tip[11])).toBeLessThan(0.02);
  });

  it('looks the same at 30, 60 and 120 fps (fixed sub-step)', () => {
    const a = run(30, 0.9), b = run(60, 0.9), c = run(120, 0.9);
    for (let i = 0; i < GROUPS * 3; i++) {
      expect(Math.abs(a.tip[i] - b.tip[i])).toBeLessThan(0.1); // ≈ 6°, on swings of up to 25°
      expect(Math.abs(c.tip[i] - b.tip[i])).toBeLessThan(0.1);
    }
  });

  it('never exceeds a group\'s max angle, even when shaken hard', () => {
    const m = new HairMotion();
    for (let i = 0; i < 600; i++) m.step(1 / 60, pose(i / 60, (t) => Math.sin(t * 20) * 1.2));
    for (let k = 0; k < GROUPS; k++) {
      expect(Math.abs(m.mid[k * 3])).toBeLessThanOrEqual(GROUP_SPECS[k].max + 1e-6);
      expect(Math.abs(m.mid[k * 3 + 2])).toBeLessThanOrEqual(GROUP_SPECS[k].max + 1e-6);
      expect(Math.abs(m.tip[k * 3])).toBeLessThanOrEqual(GROUP_SPECS[k].max * 1.25 + 1e-6);
    }
  });

  it('restarts from rest after a long gap (tab switch, 1 s hitch)', () => {
    const m = run(60, 0.4);
    expect(Math.hypot(m.tip[9], m.tip[11])).toBeGreaterThan(0.01);
    m.step(1.0, pose(5, turn));
    for (const v of m.tip) expect(v).toBe(0);
  });

  it('groups with weight 0 (short crops) never move', () => {
    const m = new HairMotion();
    for (let k = 0; k <= 4; k++) m.weights[k] = 0;
    for (let i = 0; i < 120; i++) m.step(1 / 60, pose(i / 60, turn));
    for (let k = 0; k <= 4; k++) expect(Math.hypot(m.tip[k * 3], m.tip[k * 3 + 2])).toBe(0);
  });

  it('still captures render every hair at rest, then restore it', async () => {
    const u = { value: 1 };
    const off = registerHairMotion(u);
    await withHairAtRest(() => {
      expect(u.value).toBe(0);
      expect(hairStill()).toBe(true);
    });
    expect(u.value).toBe(1);
    off();
  });
});

describe('groom motion data', () => {
  const h = headFromParams(HEADS[0].p as never, 0 as never);
  const groups = (name: string) => {
    const o = groomHair(h, HAIRSTYLES[hairId(name)].p, 7, false);
    return { o, grp: o.strands!.getAttribute('hairGrp').array as Float32Array, piv: o.strands!.getAttribute('hairPivot').array as Float32Array };
  };

  it('a ponytail swings about its tie point (group 5); gathered scalp hair stays still', () => {
    const { grp, piv } = groups('High ponytail');
    const tail = [...grp.keys()].filter((i) => grp[i] === 5);
    expect(tail.length).toBeGreaterThan(100);
    // every tail vertex shares one pivot (the tie point)
    const p0 = [piv[tail[0] * 3], piv[tail[0] * 3 + 1], piv[tail[0] * 3 + 2]];
    for (const i of tail.slice(0, 50)) expect([piv[i * 3], piv[i * 3 + 1], piv[i * 3 + 2]]).toEqual(p0);
    expect(grp.some((g) => g === -1)).toBe(true);
  });

  it('cornrows never move; a buzz cut has no locks at all', () => {
    expect(groups('Cornrows').grp.every((g) => g === -1)).toBe(true);
    expect(groomHair(h, HAIRSTYLES[hairId('Buzz cut')].p, 7, false).strands).toBeNull();
  });

  it('the worker / cache round-trip keeps hairPivot and hairGrp', () => {
    const { o } = groups('Single braid');
    const back = unpack(pack([{ geo: o.strands!, role: 'main' }]))[0].geo;
    expect(Array.from(back.getAttribute('hairGrp').array)).toEqual(Array.from(o.strands!.getAttribute('hairGrp').array));
    expect(Array.from(back.getAttribute('hairPivot').array)).toEqual(Array.from(o.strands!.getAttribute('hairPivot').array));
    expect(Array.from(back.getAttribute('hairGrp').array as Float32Array).includes(7)).toBe(true);
  });
}, 120000);
