import { variant, type ColorKey, type Look } from '../look/config';
import type { Wear } from '../look/fashion';
import { headFromParams } from '../sculptV2';
import { sculpt } from '../sculpt3d/async';
import type { Job } from '../sculpt3d/jobs';

export const BASE_TEE: Wear = { cut: 'Tank', pattern: 'solid', c1: '#e9e2d6', c2: '#e9e2d6', c3: '#e9e2d6' };
export const BASE_SHORTS: Wear = { cut: 'Shorts', pattern: 'solid', c1: '#4a433d', c2: '#4a433d', c3: '#4a433d' };

export function wear(look: Look, slot: 'top' | 'outer' | 'bottom' | 'dress' | 'shoes' | 'socks' | 'bag' | 'hat' | 'glasses'): Wear | null {
  const v = variant(look, slot);
  if (!v) return null;
  const c = slot === 'glasses' ? null : look.color[slot as ColorKey];
  return c ? { ...v.p, c1: c } : v.p;
}

/** What the figure wears (with the underwear defaults when a slot is empty). */
export function outfit(look: Look) {
  const dress = wear(look, 'dress');
  const outer = wear(look, 'outer');
  const top = dress ? null : wear(look, 'top') ?? (outer ? null : BASE_TEE);
  const bottom = dress ? null : wear(look, 'bottom') ?? BASE_SHORTS;
  return { dress, outer, top, bottom, shoes: wear(look, 'shoes'), socks: wear(look, 'socks'), bag: wear(look, 'bag'), hat: wear(look, 'hat'), glasses: wear(look, 'glasses') };
}

/** Every sculpted piece a look needs (body, hands, garments, hair). */
export function lookJobs(look: Look, only?: 'head'): Job[] {
  const o = outfit(look);
  const jobs: Job[] = [];
  if (look.pick.hair != null) {
    const h = headFromParams(variant(look, 'head')!.p, look.tune.face);
    jobs.push({ k: 'hair', h, p: variant(look, 'hair')!.p, seed: look.pick.hair, hatOn: !!o.hat });
  }
  if (only === 'head') return jobs;
  const bp = variant(look, 'body')!.p;
  jobs.push({ k: 'body', bp }, { k: 'hands', bp });
  if (o.top) jobs.push({ k: 'top', bp, cut: o.top.cut, layer: 0 });
  if (o.outer) jobs.push({ k: 'top', bp, cut: o.outer.cut, layer: 1, under: o.top?.cut });
  if (o.bottom) jobs.push({ k: 'bottom', bp, cut: o.bottom.cut });
  if (o.dress) jobs.push({ k: 'dress', bp, cut: o.dress.cut });
  if (o.socks) jobs.push({ k: 'socks', bp, cut: o.socks.cut });
  if (o.shoes) jobs.push({ k: 'shoes', bp, cut: o.shoes.cut });
  return jobs;
}

/** Resolve once every piece of a look is sculpted (before thumbnails / captures). */
export function prepareLook(look: Look, only?: 'head'): Promise<void> {
  return Promise.all(lookJobs(look, only).map((j) => sculpt(j).catch(() => undefined))).then(() => undefined);
}
