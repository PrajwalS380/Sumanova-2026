import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, OPTIONAL, SLOTS, normalizeLook, randomLook, type Slot } from './config';
import { DEFAULT_AVATAR, randomAvatar } from '../config';
import { SKIN } from './palettes';

describe('avatar v2 catalogue', () => {
  it('every face, hair and wardrobe category has 100 variants with unique ids', () => {
    const exactly100: Slot[] = ['head', 'eyes', 'lashes', 'brows', 'nose', 'mouth', 'ears', 'body', 'hair', 'beard', 'earL', 'nosePierce', 'browPierce', 'lipPierce', 'tonguePierce', 'headExtra', 'top', 'outer', 'bottom', 'dress', 'shoes', 'socks', 'bag', 'hat', 'glasses'];
    for (const s of exactly100) {
      const list = SLOTS[s] as readonly { id: number; name: string }[];
      expect(list.length, s).toBe(100);
      list.forEach((v, i) => expect(v.id, `${s}[${i}]`).toBe(i));
    }
    expect(SKIN).toHaveLength(100);
    expect(new Set(SKIN).size).toBeGreaterThan(95);
  });

  it('variant parameters are finite numbers', () => {
    for (const s of ['head', 'eyes', 'brows', 'nose', 'mouth', 'ears', 'body', 'hair', 'beard'] as Slot[]) {
      for (const v of SLOTS[s] as unknown as readonly { p: Record<string, unknown> }[]) {
        for (const [k, val] of Object.entries(v.p)) if (typeof val === 'number') expect(Number.isFinite(val), `${s}.${k}`).toBe(true);
      }
    }
  });

  it('random looks survive a round trip through normalisation', () => {
    for (let i = 0; i < 40; i++) {
      const l = randomLook();
      expect(normalizeLook(JSON.parse(JSON.stringify(l)))).toEqual(normalizeLook(l));
    }
  });

  it('rejects junk from the server', () => {
    const n = normalizeLook({ v: 2, skin: 'javascript:alert(1)', pick: { hair: 999, top: -1, head: 'x', beard: null }, color: { hair: '<b>' }, tune: { eyeSize: 50 }, expression: 'evil', pose: 'flying' });
    expect(n.skin).toBe(DEFAULT_LOOK.skin);
    expect(n.pick.hair).toBe(DEFAULT_LOOK.pick.hair);
    expect(n.pick.head).toBe(0);
    expect(n.pick.beard).toBeNull();
    expect(n.color.hair).toBe(DEFAULT_LOOK.color.hair);
    expect(n.tune.eyeSize).toBe(1);
    expect(n.expression).toBe('happy');
    expect(n.pose).toBe('standing');
  });

  it('only optional slots may be empty', () => {
    const n = normalizeLook({ v: 2, pick: { head: null, eyes: null, hair: null } });
    expect(n.pick.head).toBe(0);
    expect(n.pick.eyes).toBe(0);
    expect(OPTIONAL).toContain('hair');
    expect(n.pick.hair).toBeNull();
  });

  it('migrates first-generation avatars', () => {
    const old = { ...DEFAULT_AVATAR, hair: { style: 'afro' as const, color: '#141010' }, facialHair: { style: 'full' as const, color: '#141010' }, accessories: { ...DEFAULT_AVATAR.accessories, glasses: 'round' as const } };
    const n = normalizeLook(old);
    expect(n.v).toBe(2);
    expect(SLOTS.hair[n.pick.hair!].family).toBe('Afro');
    expect(SLOTS.beard[n.pick.beard!].family).toBe('Full beard');
    expect(SLOTS.glasses[n.pick.glasses!].family).toBe('Round');
    expect(n.color.hair).toBe('#141010');
    for (let i = 0; i < 20; i++) expect(normalizeLook(randomAvatar()).v).toBe(2);
  });
});
