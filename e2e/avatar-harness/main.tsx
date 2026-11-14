import { createRoot } from 'react-dom/client';
import { AvatarStage, type Framing } from '@/features/avatar/AvatarStage';
import { DEFAULT_LOOK, type Look, type Slot } from '@/features/avatar/look/config';
import { rng } from '@/features/avatar/look/rng';
import { HAIR, SKIN, LIPS } from '@/features/avatar/look/palettes';

/**
 * Visual harness.
 *   ?slot=hair&from=0&n=12   → n variants of one slot on the default look
 *   ?random=12&seed=3        → random full looks
 *   ?frame=head|full|upper|feet
 */
const q = new URLSearchParams(location.search);
const frame = (q.get('frame') ?? 'full') as Framing;
const n = +(q.get('n') ?? 8);
const looks: Look[] = [];
if (q.get('slot')) {
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
function App() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {looks.map((l, i) => (
        <div key={i} style={{ width: size, height: size * (frame === 'head' ? 1 : 1.3), position: 'relative' }}>
          <AvatarStage configs={[l]} interactive={false} framing={frame} />
          <span style={{ position: 'absolute', left: 6, top: 4, color: '#aaa', font: '11px sans-serif' }}>{i + +(q.get('from') ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
