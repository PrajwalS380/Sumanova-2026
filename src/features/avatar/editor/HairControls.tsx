import { useEffect, useRef, useState } from 'react';
import { Heart, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Look } from '../look/config';
import { CURL_PATTERNS, HAIRSTYLES, PLACES, type PlaceT, HAIR_OPTIONS, PATTERN_HINT, PATTERN_SPEC, hairControls, type CurlPattern, type EdgeT, type FringeT, type HairTex, type HairTune, type PaintT, type PartT } from '../look/hair';
import { HAIR } from '../look/palettes';

/**
 * Hair adjustments for the chosen style. Only the controls that make sense for it are shown
 * (no parting on a buzz cut, no fringe on cornrows, …). Every change regrows the real 3D groom.
 */

const TEX_LABEL: Record<HairTex, string> = { straight: 'Straight', wavy: 'Wavy', curly: 'Curly', coily: 'Coily', textured: 'Textured' };
const PART_LABEL: Record<PartT, string> = { none: 'None', left: 'Left', right: 'Right', middle: 'Middle', zigzag: 'Zigzag' };
const FRINGE_LABEL: Record<FringeT, string> = { none: 'None', straight: 'Straight', curtain: 'Curtain', side: 'Side', wispy: 'Wispy', textured: 'Textured' };
const EDGE_LABEL: Record<EdgeT, string> = { clean: 'Clean', soft: 'Soft', laid: 'Laid' };
/** decoration colours: silk reds / pinks / marigold, gold and silver for beads, a few brights */
const DECO_COLOURS = ['#c2185b', '#e0306b', '#d32f2f', '#f57c00', '#ffb300', '#c9a24a', '#b0b7bf', '#2e7d32', '#1565c0', '#6a1b9a', '#ffffff', '#111111'];
const PATTERN_LABEL = Object.fromEntries(CURL_PATTERNS.map((k) => [k, k])) as Record<CurlPattern, string>;
const PAINT_LABEL: Record<PaintT, string> = { none: 'Solid', twotone: 'Two-tone', ombre: 'Ombré', highlights: 'Highlights', streaks: 'Streaks', split: 'Split dye', lowlights: 'Lowlights' };

export function HairControls({ look, onHair, onHi, onDeco, onColor }: { look: Look; onHair: (t: HairTune) => void; onHi: (c: string | null) => void; /** decoration colour (paranda, ribbons, beads) */ onDeco?: (c: string | null) => void; /** roots / lengths / tips colours (sumanova-us-110) */ onColor?: (key: 'hair' | 'hairMid' | 'hairTip', c: string | null) => void }) {
  const id = look.pick.hair;
  if (id == null) return null;
  const style = HAIRSTYLES[id];
  const p = style.p;
  const c = hairControls(p);
  const t = look.hair ?? {};
  const set = (patch: Partial<HairTune>) => onHair({ ...t, ...patch });
  const paint = t.paint ?? p.paint;
  // curl pattern chips for the chosen texture family (wavy → 2A–2C, curly → 3A–3C, coily → 4A–4C)
  const texNow = t.pattern ? PATTERN_SPEC[t.pattern].tex : t.tex ?? p.tex;
  const patterns = CURL_PATTERNS.filter((k) => k !== '1' && PATTERN_SPEC[k].tex === texNow);
  const patNow: CurlPattern = t.pattern ?? (p.pattern && PATTERN_SPEC[p.pattern].tex === texNow ? p.pattern : patterns.includes((texNow === 'wavy' ? '2B' : texNow === 'curly' ? '3B' : '4A') as CurlPattern) ? ((texNow === 'wavy' ? '2B' : texNow === 'curly' ? '3B' : '4A') as CurlPattern) : '1');
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
      {c.length && <Slider label="Length" value={t.length ?? 0} min={-1} debounce onChange={(v) => set({ length: v })} />}
      {c.volume && <Slider label="Volume" value={t.volume ?? 0} min={-1} debounce onChange={(v) => set({ volume: v })} />}
      {/* salon: shape each region on its own (regrows the groom; 150 ms debounce) */}
      {c.top && <Slider label="Top" value={t.top ?? 0} min={-1} debounce onChange={(v) => set({ top: v })} />}
      {c.sides && <Slider label="Sides" value={t.sides ?? 0} min={-1} debounce onChange={(v) => set({ sides: v })} />}
      {c.back && <Slider label="Back" value={t.back ?? 0} min={-1} debounce onChange={(v) => set({ back: v })} />}
      {c.fringeLen && (t.fringe ?? p.fringe) !== 'none' && <Slider label="Fringe length" value={t.fringeLen ?? 0} min={-1} debounce onChange={(v) => set({ fringeLen: v })} />}
      {c.messy && <Slider label="Messy" value={t.messy ?? 0} min={-1} debounce onChange={(v) => set({ messy: v })} />}
      {c.layers && <Slider label="Layers" value={t.layers ?? 0} min={-1} debounce onChange={(v) => set({ layers: v })} />}
      {c.tex && <Chips label="Texture" options={HAIR_OPTIONS.tex} labels={TEX_LABEL} value={texNow} onPick={(v) => set({ tex: v, pattern: undefined })} />}
      {c.tex && patterns.length > 0 && (
        <div>
          <Chips label="Curl pattern" options={patterns} labels={PATTERN_LABEL} value={patNow} onPick={(v) => set({ pattern: v, tex: PATTERN_SPEC[v].tex })} />
          <p className="mt-1 text-[11px] font-semibold text-ink-mute">{PATTERN_HINT[patNow]}</p>
        </div>
      )}
      {c.part && <Chips label="Parting" options={HAIR_OPTIONS.part} labels={PART_LABEL} value={t.part ?? p.part} onPick={(v) => set({ part: v })} />}
      {c.line && <Slider label="Hairline" value={t.line ?? 0} min={-1} onChange={(v) => set({ line: v })} />}
      {c.edges && <Chips label="Edges" options={HAIR_OPTIONS.edges} labels={EDGE_LABEL} value={t.edges ?? p.edges} onPick={(v) => set({ edges: v })} />}
      {c.fringe && <Chips label="Fringe" options={HAIR_OPTIONS.fringe} labels={FRINGE_LABEL} value={t.fringe ?? p.fringe} onPick={(v) => set({ fringe: v })} />}
      {p.deco && p.deco !== 'none' && p.deco !== 'gajra' && onDeco && (
        <div>
          <p className="eyebrow mb-1.5">Decoration</p>
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
            <button onClick={() => onDeco(null)} aria-label="Automatic" className={cn('h-8 shrink-0 rounded-2xl bg-ink/[0.06] px-2.5 text-[11px] font-bold ring-2', look.color.hairDeco == null ? 'ring-ember-amber' : 'ring-ink/10')}>Auto</button>
            {DECO_COLOURS.map((h) => (
              <button key={h} onClick={() => onDeco(h)} aria-label={h} className={cn('h-8 w-8 shrink-0 rounded-2xl ring-2', look.color.hairDeco === h ? 'ring-ember-amber' : 'ring-ink/10')} style={{ background: h }} />
            ))}
          </div>
        </div>
      )}
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
      {c.paint && onColor && <ColourPanel look={look} t={t} set={set} onColor={onColor} onHi={onHi} />}
      <Slider label="Shine" value={t.gloss ?? 0.6} min={0} onChange={(v) => set({ gloss: v })} />
    </div>
  );
}

const PLACE_LABEL: Record<PlaceT, string> = { none: 'None', moneypiece: 'Money-piece', peekaboo: 'Peekaboo', framing: 'Face-framing', streak: 'Streak', halo: 'Halo', tips: 'Dip-dye' };
/** natural hair colours (the first 19 of the rail) vs fun colours (the rest) */
const NATURAL = HAIR.slice(0, 19), FUN = HAIR.slice(19);

/**
 * Salon colour (sumanova-us-110): roots / lengths / tips with blend and shadow root, an accent
 * placed where you want it, and a grey blend. All GPU uniforms — instant, no regrow.
 */
function ColourPanel({ look, t, set, onColor, onHi }: { look: Look; t: HairTune; set: (p: Partial<HairTune>) => void; onColor: (key: 'hair' | 'hairMid' | 'hairTip', c: string | null) => void; onHi: (c: string | null) => void }) {
  const [stop, setStop] = useState<'hair' | 'hairMid' | 'hairTip'>('hair');
  const [fun, setFun] = useState(() => !NATURAL.includes(look.color.hair ?? NATURAL[3]));
  const rail = fun ? FUN : NATURAL;
  const cur = stop === 'hair' ? look.color.hair : stop === 'hairMid' ? look.color.hairMid : look.color.hairTip;
  const place = t.place ?? 'none';
  const swatch = (k: 'hair' | 'hairMid' | 'hairTip', label: string) => {
    const col = (k === 'hair' ? look.color.hair : k === 'hairMid' ? look.color.hairMid : look.color.hairTip) ?? look.color.hair ?? '#3b2618';
    return (
      <button onClick={() => setStop(k)} aria-pressed={stop === k} className={cn('flex flex-1 items-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-bold ring-2 active:scale-95', stop === k ? 'bg-white ring-ember-amber' : 'bg-white ring-ink/[0.06]')}>
        <span className="h-5 w-5 shrink-0 rounded-lg ring-1 ring-ink/10" style={{ background: col }} />
        {label}
      </button>
    );
  };
  return (
    <div className="space-y-3 rounded-2xl bg-white/60 p-2.5 ring-1 ring-ink/[0.05]">
      <p className="eyebrow">Colour</p>
      <div className="flex gap-1.5">
        {swatch('hair', 'Roots')}
        {swatch('hairMid', 'Lengths')}
        {swatch('hairTip', 'Tips')}
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => setFun(false)} aria-pressed={!fun} className={cn('rounded-xl px-3 py-1 text-[11px] font-bold', !fun ? 'bg-ember-cream text-noir' : 'bg-white text-ink-mute ring-1 ring-ink/[0.06]')}>Natural colours</button>
        <button onClick={() => setFun(true)} aria-pressed={fun} className={cn('rounded-xl px-3 py-1 text-[11px] font-bold', fun ? 'bg-ember-cream text-noir' : 'bg-white text-ink-mute ring-1 ring-ink/[0.06]')}>Fun colours</button>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
        {stop !== 'hair' && (
          <button onClick={() => onColor(stop, null)} className={cn('h-8 shrink-0 rounded-2xl bg-ink/[0.06] px-2.5 text-[11px] font-bold ring-2', cur == null ? 'ring-ember-amber' : 'ring-ink/10')}>Same as roots</button>
        )}
        {rail.map((h) => (
          <button key={h} onClick={() => onColor(stop, h)} aria-label={h} className={cn('h-8 w-8 shrink-0 rounded-2xl ring-2', cur === h ? 'ring-ember-amber' : 'ring-ink/10')} style={{ background: h }} />
        ))}
      </div>
      <Slider label="Blend" value={t.blend ?? 0.5} min={0} onChange={(v) => set({ blend: v })} />
      <Slider label="Shadow root" value={t.rootLen ?? 0} min={0} onChange={(v) => set({ rootLen: v })} />
      <Slider label="Grey blend" value={t.grey ?? 0} min={0} onChange={(v) => set({ grey: v })} />
      <Chips label="Placement" options={PLACES} labels={PLACE_LABEL} value={place} onPick={(v) => set({ place: v })} />
      {place !== 'none' && (
        <>
          <Slider label="Amount" value={t.placeAmt ?? 0.5} min={0} onChange={(v) => set({ placeAmt: v })} />
          <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
            {(fun ? FUN : HAIR).map((h) => (
              <button key={h} onClick={() => onHi(h)} aria-label={h} className={cn('h-8 w-8 shrink-0 rounded-2xl ring-2', look.color.hairHi === h ? 'ring-ember-amber' : 'ring-ink/10')} style={{ background: h }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** a slider; `debounce`: shape sliders report 150 ms after the last move (each change regrows the hair) */
function Slider({ label, value, min, onChange, debounce = false }: { label: string; value: number; min: number; onChange: (v: number) => void; debounce?: boolean }) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const change = (v: number) => {
    setLocal(v);
    if (!debounce) return onChange(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), 150);
  };
  value = local;
  const onChangeLocal = change;
  return (
    <label className="block">
      <span className="eyebrow mb-1 flex justify-between">
        {label}
        <span className="tabular-nums normal-case tracking-normal text-ink-soft">{min < 0 && value > 0 ? '+' : ''}{Math.round(value * 100)}</span>
      </span>
      <input type="range" min={min} max={1} step={0.05} value={value} onChange={(e) => onChangeLocal(Number(e.target.value))} className="w-full" />
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
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Search ${HAIRSTYLES.length} hairstyles`} className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint" />
      {value && (
        <button onClick={() => onChange('')} aria-label="Clear search" className="text-ink-mute">
          <X className="h-4 w-4" />
        </button>
      )}
    </label>
  );
}
