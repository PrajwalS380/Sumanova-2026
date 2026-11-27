import { SLOTS, type Look, type Slot } from '@/features/avatar/look/config';
import { mannequin, renderThumb, type ThumbFrame } from '@/features/avatar/editor/thumbs';

/**
 * Duplicate checker: renders every variant of a slot exactly like the studio grid does
 * (optionally with the user's colour override) and reports pairs that look the same.
 *   ?dupes=outer&frame=upper[&color=bfe3f2]
 */
const N = 192; // full thumbnail resolution: downscaling averages fine prints into a flat colour
/** Share of pixels that must visibly differ for two previews to count as different items. */
const MIN_CHANGED = Number(new URLSearchParams(location.search).get('min') ?? 0.003);
async function signature(url: string): Promise<Float32Array> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.fillStyle = '#808080';
  g.fillRect(0, 0, N, N);
  g.drawImage(img, 0, 0, N, N);
  const d = g.getImageData(0, 0, N, N).data;
  const out = new Float32Array(N * N * 3);
  for (let i = 0; i < N * N; i++) for (let k = 0; k < 3; k++) out[i * 3 + k] = d[i * 4 + k];
  return out;
}
/** Fraction of pixels whose colour visibly differs (max channel difference > 18/255). */
const dist = (a: Float32Array, b: Float32Array) => {
  let n = 0;
  for (let i = 0; i < a.length; i += 3) if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > 18) n++;
  return n / (a.length / 3);
};

export async function runDupes(slot: Slot, frame: ThumbFrame, color: string | null) {
  const list = SLOTS[slot] as readonly { id: number; name: string }[];
  const sigs: Float32Array[] = [];
  for (const v of list) {
    const l: Look = mannequin();
    l.pick[slot] = v.id;
    if (slot === 'dress') l.pick.top = l.pick.bottom = null;
    if (slot === 'bag') l.pose = 'celebrating';
    const ck = (['top', 'outer', 'bottom', 'dress', 'shoes', 'socks', 'bag', 'hat'] as const).find((k) => k === slot);
    if (ck) l.color[ck] = color;
    const url = await renderThumb(`dupe:${slot}:${v.id}:${color}`, l, frame, slot !== 'hair');
    sigs.push(await signature(url));
    if (new URLSearchParams(location.search).get('show')) {
      const im = document.createElement('img');
      im.src = url;
      im.width = 96;
      im.title = String(v.id);
      document.body.appendChild(im);
    }
    document.title = `${v.id + 1}/${list.length}`;
  }
  // Greedy: walk the catalogue in order; an item that looks like an earlier *shown* item is hidden.
  const pairs: string[] = [];
  const hidden: number[] = [];
  const shown: number[] = [];
  let min = Infinity;
  for (let i = 0; i < sigs.length; i++) {
    let twin = -1;
    for (const j of shown) {
      const d = dist(sigs[i], sigs[j]);
      min = Math.min(min, d);
      if (d < MIN_CHANGED) {
        twin = j;
        pairs.push(`${j} ${list[j].name}  ==  ${i} ${list[i].name}  (${(d * 100).toFixed(1)}% differs)`);
        break;
      }
    }
    if (twin >= 0) hidden.push(i);
    else shown.push(i);
  }
  (window as unknown as { __dupes: unknown }).__dupes = { slot, color, count: list.length, minDiff: min, pairs, hidden };
  document.title = 'done';
}

/** ?thumbs=slot&frame=feet&ids=0,1,2 → show the real studio thumbnails in a grid (visual check). */
export async function showThumbs(slot: Slot, frame: ThumbFrame, ids: number[], color: string | null) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;background:#e3e8f6;padding:6px';
  document.body.appendChild(wrap);
  const list = SLOTS[slot] as readonly { id: number; name: string }[];
  for (const id of ids) {
    const l: Look = mannequin();
    l.pick[slot] = id;
    if (slot === 'dress') l.pick.top = l.pick.bottom = null;
    if (slot === 'bag') l.pose = 'celebrating';
    const ck = (['top', 'outer', 'bottom', 'dress', 'shoes', 'socks', 'bag', 'hat'] as const).find((k) => k === slot);
    if (ck) l.color[ck] = color;
    // same as the studio cards: face features show on face categories
    const skin = new URLSearchParams(location.search).get('skin');
    if (skin) l.skin = '#' + skin;
    const face = ['head', 'eyes', 'lashes', 'brows', 'nose', 'mouth', 'nosePierce', 'browPierce', 'lipPierce', 'tonguePierce'].includes(slot);
    if (slot === 'eyes') l.color.eyes = color ?? '#5a3a22';
    if (slot === 'brows') l.color.brows = color ?? '#2a1d16';
    if (slot === 'mouth') l.color.lips = color ?? (skin ? null : '#b8676a');
    if (slot === 'beard') l.color.beard = color ?? '#3b2618';
    const size = Number(new URLSearchParams(location.search).get('size') ?? 192);
    const url = await renderThumb(`show:${slot}:${id}:${color}:${frame}:${size}:${skin}`, l, frame, slot !== 'hair' && !face, size);
    const fig = document.createElement('figure');
    fig.style.cssText = `margin:0;width:${size}px;font:11px sans-serif;text-align:center;background:radial-gradient(circle at 50% 32%,#fff,#e3e8f6);border-radius:16px`;
    fig.innerHTML = `<img src="${url}" width="${size}" height="${size}"><figcaption>${id} ${list[id].name}</figcaption>`;
    wrap.appendChild(fig);
  }
  document.title = 'done';
}

/** ?presetImages=1 → render every starter character full-body on transparent (public/presets/N.webp). */
export async function presetImages() {
  const { PRESETS } = await import('@/features/avatar/look/presets');
  const out: string[] = [];
  // ?ids=1,2&poses=waving,peace → just those characters in those poses (welcome page art)
  const q = new URLSearchParams(location.search);
  const ids = q.get('ids') ? q.get('ids')!.split(',').map(Number) : PRESETS.map((_, i) => i);
  const poses = q.get('poses')?.split(',') ?? [];
  for (let k = 0; k < ids.length; k++) {
    const i = ids[k];
    const look = poses[k] ? { ...PRESETS[i].look, pose: poses[k] as never } : PRESETS[i].look;
    const url = await renderThumb(`preset:${i}:${poses[k] ?? ''}`, look, 'fullroomy', false, 640);
    const blob = await (await fetch(url)).blob();
    out.push(await new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(blob); }));
  }
  (window as unknown as { __presets: string[] }).__presets = out;
  document.title = 'done';
}
