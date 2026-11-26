import { useEffect, useState } from 'react';
import { Heart, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Look } from '../look/config';
import { HAIRSTYLES, HAIR_OPTIONS, hairControls, type FringeT, type HairTex, type HairTune, type PaintT, type PartT } from '../look/hair';
import { HAIR } from '../look/palettes';

/**
 * Hair adjustments for the chosen style. Only the controls that make sense for it are shown
 * (no parting on a buzz cut, no fringe on cornrows, …). Every change regrows the real 3D groom.
 */

const TEX_LABEL: Record<HairTex, string> = { straight: 'Straight', wavy: 'Wavy', curly: 'Curly', coily: 'Coily', textured: 'Textured' };
const PART_LABEL: Record<PartT, string> = { none: 'None', left: 'Left', right: 'Right', middle: 'Middle', zigzag: 'Zigzag' };
const FRINGE_LABEL: Record<FringeT, string> = { none: 'None', straight: 'Straight', curtain: 'Curtain', side: 'Side', wispy: 'Wispy', textured: 'Textured' };
const PAINT_LABEL: Record<PaintT, string> = { none: 'Solid', twotone: 'Two-tone', ombre: 'Ombré', highlights: 'Highlights', streaks: 'Streaks', split: 'Split dye', lowlights: 'Lowlights' };

export function HairControls({ look, onHair, onHi }: { look: Look; onHair: (t: HairTune) => void; onHi: (c: string | null) => void }) {
  const id = look.pick.hair;
  if (id == null) return null;
  const style = HAIRSTYLES[id];
  const p = style.p;
  const c = hairControls(p);
  const t = look.hair ?? {};
  const set = (patch: Partial<HairTune>) => onHair({ ...t, ...patch });
  const paint = t.paint ?? p.paint;
  return (
    <div className="space-y-3 rounded-tile bg-ink/[0.035] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-extrabold text-ink">{style.name}</p>
          <p className="text-[11px] font-semibold text-ink-mute">{style.family}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <FavButton id={id} />
          {Object.keys(t).length > 0 && (
            <button onClick={() => onHair({})} className="rounded-xl bg-ink/[0.06] px-3 py-1.5 text-xs font-bold text-ink-soft active:scale-95">Reset</button>
          )}
        </div>
      </div>
      {c.length && <Slider label="Length" value={t.length ?? 0} min={-1} onChange={(v) => set({ length: v })} />}
      {c.volume && <Slider label="Volume" value={t.volume ?? 0} min={-1} onChange={(v) => set({ volume: v })} />}
      {c.tex && <Chips label="Texture" options={HAIR_OPTIONS.tex} labels={TEX_LABEL} value={t.tex ?? p.tex} onPick={(v) => set({ tex: v })} />}
      {c.part && <Chips label="Parting" options={HAIR_OPTIONS.part} labels={PART_LABEL} value={t.part ?? p.part} onPick={(v) => set({ part: v })} />}
      {c.fringe && <Chips label="Fringe" options={HAIR_OPTIONS.fringe} labels={FRINGE_LABEL} value={t.fringe ?? p.fringe} onPick={(v) => set({ fringe: v })} />}
      {c.paint && <Chips label="Colour effect" options={HAIR_OPTIONS.paint} labels={PAINT_LABEL} value={paint} onPick={(v) => set({ paint: v })} />}
      {(paint === 'highlights' || paint === 'streaks' || paint === 'lowlights') && (
        <div>
          <p className="eyebrow mb-1.5">{paint === 'lowlights' ? 'Lowlight colour' : 'Highlight colour'}</p>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
            <button onClick={() => onHi(null)} aria-label="Automatic" className={cn('h-8 shrink-0 rounded-2xl bg-ink/[0.06] px-2.5 text-[11px] font-bold ring-2', look.color.hairHi == null ? 'ring-ember-amber' : 'ring-transparent')}>Auto</button>
            {HAIR.map((h) => (
              <button key={h} onClick={() => onHi(h)} aria-label={h} className={cn('h-8 w-8 shrink-0 rounded-2xl ring-2', look.color.hairHi === h ? 'ring-ember-amber' : 'ring-ink/10')} style={{ background: h }} />
            ))}
          </div>
        </div>
      )}
      <Slider label="Shine" value={t.gloss ?? 0.6} min={0} onChange={(v) => set({ gloss: v })} />
    </div>
  );
}

function Slider({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1 flex justify-between">
        {label}
        <span className="tabular-nums normal-case tracking-normal text-ink-soft">{min < 0 && value > 0 ? '+' : ''}{Math.round(value * 100)}</span>
      </span>
      <input type="range" min={min} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </label>
  );
}

function Chips<T extends string>({ label, options, labels, value, onPick }: { label: string; options: T[]; labels: Record<T, string>; value: T; onPick: (v: T) => void }) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {options.map((o) => (
          <button key={o} onClick={() => onPick(o)} aria-pressed={value === o} className={cn('shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors active:scale-95', value === o ? 'bg-ember-cream text-noir' : 'bg-white text-ink-mute ring-1 ring-ink/[0.06]')}>
            {labels[o]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------- favourites & search

const FAV_KEY = 'snv-hair-favs';
const favListeners = new Set<() => void>();
export function readFavs(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}
function writeFavs(list: number[]) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
  } catch {
    /* private mode: favourites just don't persist */
  }
  favListeners.forEach((f) => f());
}
export function useFavs() {
  const [favs, setFavs] = useState(readFavs);
  useEffect(() => {
    const f = () => setFavs(readFavs());
    favListeners.add(f);
    return () => void favListeners.delete(f);
  }, []);
  return favs;
}

function FavButton({ id }: { id: number }) {
  const favs = useFavs();
  const on = favs.includes(id);
  return (
    <button onClick={() => writeFavs(on ? favs.filter((f) => f !== id) : [...favs, id])} aria-pressed={on} aria-label={on ? 'Remove from favourites' : 'Add to favourites'} className={cn('grid h-8 w-8 place-items-center rounded-xl active:scale-90', on ? 'bg-ember-cream text-noir' : 'bg-ink/[0.06] text-ink-soft')}>
      <Heart className={cn('h-4 w-4', on && 'fill-current')} />
    </button>
  );
}

/** Search box for the hairstyle grid. */
export function HairSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="mb-2 flex items-center gap-2 rounded-2xl bg-ink/[0.05] px-3 py-2">
      <Search className="h-4 w-4 shrink-0 text-ink-mute" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search 110 hairstyles" className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint" />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search" className="text-ink-mute">
          <X className="h-4 w-4" />
        </button>
      )}
    </label>
  );
}
