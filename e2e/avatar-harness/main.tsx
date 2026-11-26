import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { AvatarStage, type Framing } from '@/features/avatar/AvatarStage';
import { DEFAULT_LOOK, type Look, type Slot } from '@/features/avatar/look/config';
import { rng } from '@/features/avatar/look/rng';
import { HAIR, SKIN, LIPS } from '@/features/avatar/look/palettes';
import { PRESETS } from '@/features/avatar/look/presets';

/**
 * Visual harness.
 *   ?slot=hair&from=0&n=12   → n variants of one slot on the default look
 *   ?random=12&seed=3        → random full looks
 *   ?frame=head|full|upper|feet
 */
const q = new URLSearchParams(location.search);
if (q.get('presetImages')) void import('./dupes').then((m) => m.presetImages());
if (q.get('thumbs')) void import('./dupes').then((m) => m.showThumbs(q.get('thumbs') as Slot, (q.get('frame') ?? 'upper') as never, q.get('ids')!.split(',').map(Number), q.get('color') ? '#' + q.get('color') : null));
if (q.get('dupes')) void import('./dupes').then((m) => m.runDupes(q.get('dupes') as Slot, (q.get('frame') ?? 'upper') as never, q.get('color') ? '#' + q.get('color') : null));
const frame = (q.get('frame') ?? 'full') as Framing;
const n = +(q.get('n') ?? 8);
const looks: Look[] = [];
if (q.get('presets')) {
  const from = +(q.get('from') ?? 0);
  looks.push(...PRESETS.slice(from, from + n).map((p) => p.look));
} else if (q.get('slot')) {
  const slot = q.get('slot') as Slot;
  const from = +(q.get('from') ?? 0);
  const ids = q.get('ids') ? q.get('ids')!.split(',').map(Number) : Array.from({ length: n }, (_, i) => from + i);
  for (const id of ids) {
    const l: Look = structuredClone(DEFAULT_LOOK);
    l.pick[slot] = id;
    if (q.get('expr')) l.expression = q.get('expr') as Look['expression'];
    if (slot === 'dress') {
      l.pick.top = null;
      l.pick.bottom = null;
    }
    if (q.get('tip')) l.color.hairTip = q.get('tip');
    // e.g. &top=70 to test a jacket over a specific top
    if (q.get('top')) l.pick.top = q.get('top') === 'none' ? null : +q.get('top')!;
    if (q.get('outer')) l.pick.outer = +q.get('outer')!;
    if (q.get('ctop')) l.color.top = '#' + q.get('ctop');
    if (q.get('couter')) l.color.outer = '#' + q.get('couter');
    looks.push(l);
  }
} else {
  const r = rng(+(q.get('seed') ?? 1));
  for (let i = 0; i < +(q.get('random') ?? 8); i++) {
    const l: Look = structuredClone(DEFAULT_LOOK);
    const R = (k: number) => Math.floor(r() * k);
    l.skin = SKIN[R(100)];
    for (const s of ['head', 'eyes', 'brows', 'nose', 'mouth', 'ears', 'body', 'hair', 'top', 'bottom', 'shoes'] as Slot[]) l.pick[s] = R(100);
    l.pick.beard = r() < 0.4 ? R(100) : null;
    l.pick.lashes = r() < 0.6 ? R(100) : null;
    l.pick.outer = r() < 0.5 ? R(100) : null;
    l.pick.glasses = r() < 0.3 ? R(100) : null;
    l.pick.hat = r() < 0.15 ? R(100) : null;
    if (r() < 0.25) {
      l.pick.dress = R(100);
      l.pick.top = null;
      l.pick.bottom = null;
      l.pick.outer = null;
    }
    l.color.hair = HAIR[R(HAIR.length)];
    l.color.brows = l.color.hair;
    l.color.beard = l.color.hair;
    l.color.lips = LIPS[R(12)];
    looks.push(l);
  }
}
const size = +(q.get('size') ?? 300);
// ?switch=outer:0,13 → start on the first variant and swap to the second after 3s (live-edit check).
const sw = q.get('switch')?.split(':');
function App() {
  const [, force] = (React as typeof import('react')).useState(0);
  (React as typeof import('react')).useEffect(() => {
    if (!sw) return;
    const [slot, ids] = sw;
    const [a, b] = ids.split(',').map(Number);
    looks.forEach((l) => (l.pick[slot as Slot] = a));
    force(1);
    const t = setTimeout(() => {
      looks.forEach((l, i) => (looks[i] = { ...l, pick: { ...l.pick, [slot]: b } }));
      force(2);
    }, 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {looks.map((l, i) => (
        <div key={i} style={{ width: size, height: size * (frame === 'head' ? 1 : 1.3), position: 'relative' }}>
          <AvatarStage configs={[q.get('bare') ? { ...l, pick: { ...l.pick, hair: q.get('hair') ? l.pick.hair : null } } : l]} bare={!!q.get('bare')} poses={[(q.get('poses') ? q.get('poses')!.split(',')[i] : q.get('pose')) as never]} interactive={false} framing={frame} turn={q.get('turns') ? +q.get('turns')!.split(',')[i] : +(q.get('turn') ?? 0)} cam={q.get('cam') ? (() => { const n = q.get('cam')!.split(',').map(Number); return { pos: [n[0], n[1], n[2]] as [number, number, number], target: [n[3], n[4], n[5]] as [number, number, number] }; })() : undefined} />
          <span style={{ position: 'absolute', left: 6, top: 4, color: '#aaa', font: '11px sans-serif' }}>{i + +(q.get('from') ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}
if (!q.get('dupes') && !q.get('thumbs') && !q.get('presetImages')) createRoot(document.getElementById('root')!).render(<App />);
