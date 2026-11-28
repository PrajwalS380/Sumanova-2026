import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Dices, Download, Heart, Loader2, Redo2, Shirt, Undo2, Users2, UserRound, X, Ban, Plus } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { saveMedia } from '@/lib/saveMedia';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { hasWebGL } from './config';
import { AvatarStage, type AvatarStageHandle } from './AvatarStage';
import { Avatar2D } from './Avatar2D';
import { avatarApi, FASHION_SLOTS, type SavedOutfit } from './api';
import { PRESETS } from './look/presets';
import { DEFAULT_LOOK, OPTIONAL, SLOTS, normalizeLook, randomLook, type ColorKey, type Look, type Slot } from './look/config';
import { isHidden } from './look/hidden';
import { prepareLook } from './render/lookParts';
import { CATEGORIES, EXPRESSIONS, POSES, type Category, type Mode } from './editor/categories';
import { mannequin, useThumb } from './editor/thumbs';
import { HairControls, HairSearch, useFavs } from './editor/HairControls';
import { HAIRSTYLES, type HairTune } from './look/hair';

const FACE_SLOTS: Slot[] = ['head', 'eyes', 'lashes', 'brows', 'nose', 'mouth', 'nosePierce', 'browPierce', 'lipPierce', 'tonguePierce'];

const MODES: { id: Mode; label: string; icon: typeof Shirt }[] = [
  { id: 'style', label: 'Style', icon: Shirt },
  { id: 'face', label: 'Face & body', icon: UserRound },
  { id: 'saved', label: 'Looks', icon: Heart },
];

export default function AvatarStudio() {
  const { session, profile, setProfile } = useAuth();
  const me = session!.user.id;
  const toast = useToast();
  const navigate = useNavigate();
  const stage = useRef<AvatarStageHandle>(null);
  const [hist, setHist] = useState<{ list: Look[]; i: number }>({ list: [DEFAULT_LOOK], i: 0 });
  const look = hist.list[hist.i];
  const [saved, setSaved] = useState<Look | null>(null);
  const [mode, setMode] = useState<Mode>(() => {
    const q = new URLSearchParams(location.search).get('mode');
    return MODES.some((m) => m.id === q) ? (q as Mode) : 'style';
  });
  const [catId, setCatId] = useState('top');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [outfits, setOutfits] = useState<{ id: string; name: string; outfit: SavedOutfit }[]>([]);
  const [gl] = useState(hasWebGL);
  const cat = CATEGORIES.find((c) => c.id === catId) ?? CATEGORIES[0];

  useEffect(() => {
    try {
      sessionStorage.removeItem('snv-after-auth');
    } catch {
      /* storage blocked */
    }
    void avatarApi
      .get(me)
      .then((a) => {
        // Picked on the "Choose your avatar" step → start from that character and edit it.
        const picked = Number(new URLSearchParams(location.search).get('preset'));
        const preset = Number.isInteger(picked) && PRESETS[picked] ? PRESETS[picked] : null;
        // Made from a selfie (selfie → avatar screen) → start from that look.
        let fromSelfie: Look | null = null;
        try {
          const raw = new URLSearchParams(location.search).get('from') === 'selfie' ? sessionStorage.getItem('snv-selfie-look') : null;
          if (raw) fromSelfie = normalizeLook(JSON.parse(raw));
          sessionStorage.removeItem('snv-selfie-look');
        } catch {
          fromSelfie = null;
        }
        // First visit without a pick: start from a ready-made character and show the character picker.
        const l = fromSelfie ?? (preset ? structuredClone(preset.look) : a ?? structuredClone(PRESETS[Math.floor(Math.random() * PRESETS.length)].look));
        if (!a && !preset && !fromSelfie) setMode('saved');
        setHist({ list: [l], i: 0 });
        setSaved(a);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    void avatarApi.outfits().then(setOutfits).catch(() => undefined);
  }, [me]);

  const commit = useCallback((next: Look | ((l: Look) => Look)) => {
    haptic(4);
    setHist((h) => {
      const cur = h.list[h.i];
      const n = typeof next === 'function' ? next(cur) : next;
      const list = [...h.list.slice(0, h.i + 1), n].slice(-60);
      return { list, i: list.length - 1 };
    });
  }, []);

  const pick = (slot: Slot, id: number | null) =>
    commit((l) => {
      const n: Look = { ...l, pick: { ...l.pick, [slot]: id } };
      if (slot === 'dress' && id != null) n.pick = { ...n.pick, top: null, bottom: null };
      if ((slot === 'top' || slot === 'bottom') && id != null) n.pick = { ...n.pick, dress: null };
      return n;
    });
  const setColor = (key: ColorKey | 'skin', v: string | null) => commit((l) => (key === 'skin' ? { ...l, skin: v ?? l.skin } : { ...l, color: { ...l.color, [key]: v } }));

  const switchMode = (m: Mode) => {
    setMode(m);
    const first = CATEGORIES.find((c) => c.mode === m);
    if (first) setCatId(first.id);
  };

  async function save() {
    setSaving(true);
    try {
      await avatarApi.save(me, look);
      setSaved(look);
      // Your avatar is your picture everywhere: publish the face (profile picture) and the full body (map, profiles).
      if (gl && stage.current) {
        await prepareLook(look);
        const face = await stage.current.capture('bust');
        const body = await stage.current.capture('full');
        const urls = await avatarApi.publishImages(me, face, body, !!profile?.photo_mode);
        if (profile) setProfile({ ...profile, avatar_url: profile.photo_mode ? profile.avatar_url : urls.face, avatar_face_url: urls.face, avatar_body_url: urls.body });
      }
      haptic([10, 40, 10]);
      toast('Avatar saved ✦', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveOutfit() {
    const pickPart: SavedOutfit['pick'] = {};
    const colorPart: SavedOutfit['color'] = {};
    for (const s of FASHION_SLOTS) pickPart[s] = look.pick[s] ?? null;
    for (const k of ['top', 'outer', 'bottom', 'dress', 'shoes', 'socks', 'bag', 'hat', 'shadow', 'blush', 'lips'] as ColorKey[]) colorPart[k] = look.color[k] ?? null;
    try {
      await avatarApi.saveOutfit(me, `Look ${outfits.length + 1}`, { pick: pickPart, color: colorPart });
      setOutfits(await avatarApi.outfits());
      toast('Look saved to your wardrobe', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  async function exportImage() {
    if (!stage.current) return;
    try {
      await prepareLook(look);
      await saveMedia(await stage.current.capture('full'), `sumanova-avatar-${Date.now()}.png`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const dirty = JSON.stringify(look) !== JSON.stringify(saved);
  const preview = useMemo<Look>(() => (cat.id === 'tonguePierce' ? { ...look, expression: 'tongue' } : look), [look, cat.id]);
  const rail = cat.color ?? null;

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-noir">
      <header className="relative z-10 flex items-center gap-2 px-3 pt-safe">
        <button onClick={() => navigate(-1)} aria-label="Close" className={STUDIO_BTN}><X className="h-5 w-5" /></button>
        <h1 className="flex-1 text-center text-lg font-extrabold">My avatar</h1>
        <button onClick={() => commit((l) => ({ ...randomLook(), pose: l.pose }))} aria-label="Random look" className={STUDIO_BTN}><Dices className="h-5 w-5" /></button>
        <Link to="/avatar/duo" aria-label="Duo stickers" className={STUDIO_BTN}><Users2 className="h-5 w-5" /></Link>
        <button onClick={() => void save()} disabled={saving || (!dirty && !!saved)} className="flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-extrabold text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {saved && !dirty ? 'Saved' : 'Save'}
        </button>
      </header>

      {/* Stage */}
      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="grid h-full place-items-center"><Loader2 className="h-7 w-7 animate-spin text-ink-mute" /></div>
        ) : gl ? (
          <AvatarStage ref={stage} configs={[preview]} framing={cat.stage} className="!h-full !w-full touch-none" />
        ) : (
          <div className="grid h-full place-items-center"><Avatar2D config={look} size={200} /></div>
        )}
        <div className="absolute bottom-3 left-3 flex gap-1.5">
          <button onClick={() => setHist((h) => ({ ...h, i: Math.max(0, h.i - 1) }))} disabled={hist.i === 0} aria-label="Undo" className="glass grid h-10 w-10 place-items-center rounded-2xl disabled:opacity-35"><Undo2 className="h-5 w-5" /></button>
          <button onClick={() => setHist((h) => ({ ...h, i: Math.min(h.list.length - 1, h.i + 1) }))} disabled={hist.i >= hist.list.length - 1} aria-label="Redo" className="glass grid h-10 w-10 place-items-center rounded-2xl disabled:opacity-35"><Redo2 className="h-5 w-5" /></button>
        </div>
        {rail && <ColorRail palette={rail.palette} value={look.color[rail.key] ?? null} allowNone={rail.allowNone} onPick={(c) => setColor(rail.key, c)} second={cat.color2 ? { ...cat.color2, value: look.color[cat.color2.key] ?? null, onPick: (c: string | null) => setColor(cat.color2!.key, c) } : undefined} />}
      </div>

      {/* Panel */}
      <div className="glass-strong relative z-20 flex h-[50vh] shrink-0 flex-col rounded-t-[28px] pb-safe">
        <div className="flex justify-center pt-2"><span className="h-1 w-9 rounded-full bg-ink/15" /></div>
        <div role="tablist" className="mx-3 mt-2 grid grid-cols-3 rounded-2xl bg-ink/[0.04] p-1">
          {MODES.map((m) => (
            <button key={m.id} role="tab" aria-selected={mode === m.id} onClick={() => switchMode(m.id)} className={cn('relative flex items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-bold transition-colors', mode === m.id ? 'text-noir' : 'text-ink-mute')}>
              {mode === m.id && <motion.span layoutId="studio-mode" className="absolute inset-0 rounded-xl bg-ember-cream" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
              <m.icon className="relative h-4 w-4" />
              <span className="relative">{m.label}</span>
            </button>
          ))}
        </div>

        {mode !== 'saved' && (
          <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto px-3 pb-1">
            {CATEGORIES.filter((c) => c.mode === mode).map((c) => (
              <button key={c.id} onClick={() => setCatId(c.id)} aria-pressed={catId === c.id} className={cn('flex w-[64px] shrink-0 flex-col items-center gap-1 rounded-2xl py-2 transition-colors', catId === c.id ? 'bg-ink/[0.08] text-ink' : 'text-ink-mute')}>
                <c.icon className={cn('h-5 w-5', catId === c.id && 'text-ember-amber')} />
                <span className="w-full truncate px-0.5 text-center text-[10px] font-semibold">{c.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-2">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={mode === 'saved' ? 'saved' : cat.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
              {mode === 'saved' ? (
                <SavedPanel
                  outfits={outfits}
                  onWear={(o) => commit((l) => ({ ...l, pick: { ...l.pick, ...o.pick }, color: { ...l.color, ...o.color } }))}
                  onStart={(l) => commit(() => structuredClone(l))}
                  onSave={() => void saveOutfit()}
                  onExport={() => void exportImage()}
                  gl={gl}
                />
              ) : (
                <CategoryPanel cat={cat} look={look} onPick={pick} onColor={setColor} onTune={(k, v) => commit((l) => ({ ...l, tune: { ...l.tune, [k]: v } }))} onSpecial={(k, v) => commit((l) => ({ ...l, [k]: v }))} onHair={(t) => commit((l) => ({ ...l, hair: Object.keys(t).length ? t : undefined }))} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const STUDIO_BTN = 'grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/85 text-ink active:scale-90';

/* ------------------------------------------------------------------ panels */

function CategoryPanel({ cat, look, onPick, onColor, onTune, onSpecial, onHair }: { cat: Category; look: Look; onPick: (s: Slot, id: number | null) => void; onColor: (k: ColorKey | 'skin', v: string | null) => void; onTune: (k: 'eyeSize' | 'eyeGap' | 'face', v: number) => void; onSpecial: (k: 'expression' | 'pose', v: string) => void; onHair: (t: HairTune) => void }) {
  if (cat.special) {
    const list = cat.special === 'expression' ? EXPRESSIONS : POSES;
    const cur = cat.special === 'expression' ? look.expression : look.pose;
    return (
      <div className="grid grid-cols-3 gap-2">
        {list.map(([id, emoji, label]) => (
          <button key={id} onClick={() => onSpecial(cat.special!, id)} aria-pressed={cur === id} className={cn('flex flex-col items-center gap-1 rounded-2xl py-3 transition-all active:scale-95', cur === id ? 'bg-ember-cream text-noir' : 'bg-ink/[0.05] text-ink-soft')}>
            <span className="text-2xl">{emoji}</span>
            <span className="text-xs font-semibold">{label}</span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {cat.sliders?.map((s) => <TuneSlider key={s.key} label={s.label} value={look.tune[s.key]} onChange={(v) => onTune(s.key, v)} />)}
      {cat.id === 'hair' && <HairControls look={look} onHair={onHair} onHi={(c) => onColor('hairHi', c)} onDeco={(c) => onColor('hairDeco', c)} />}
      {cat.swatches && <SwatchGrid palette={cat.swatches.palette} value={cat.swatches.key === 'skin' ? look.skin : look.color[cat.swatches.key] ?? null} allowNone={cat.swatches.allowNone} onPick={(c) => onColor(cat.swatches!.key, c)} />}
      {cat.slot && <VariantGrid cat={cat} slot={cat.slot} look={look} onPick={(id) => onPick(cat.slot!, id)} />}
    </div>
  );
}

function VariantGrid({ cat, slot, look, onPick }: { cat: Category; slot: Slot; look: Look; onPick: (id: number | null) => void }) {
  const current = look.pick[slot] ?? null;
  // Look-alike items are left out (the one you're wearing always stays visible).
  const all = SLOTS[slot] as readonly { id: number; name: string; family: string }[];
  const list = useMemo(() => all.filter((v) => !isHidden(slot, v.id) || v.id === current), [all, slot, current]);
  const families = useMemo(() => Array.from(new Set(list.map((v) => v.family))), [list]);
  const [fam, setFam] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const favs = useFavs();
  const isHair = slot === 'hair';
  const query = q.trim().toLowerCase();
  // hair: tags (Textured / Indian) and curl patterns ("4c", "3b") are searchable and filterable
  const hairMeta = (id: number) => {
    const hp = isHair ? HAIRSTYLES[id]?.p : undefined;
    return { tags: hp?.tags ?? [], pattern: hp?.pattern?.toLowerCase() ?? '' };
  };
  const matchFam = (v: { id: number; family: string }) =>
    fam === '♥' ? favs.includes(v.id) : fam === '#textured' ? hairMeta(v.id).tags.includes('textured') : fam === '#indian' ? hairMeta(v.id).tags.includes('indian') : !fam || v.family === fam;
  const matchQuery = (v: { id: number; name: string; family: string }) => {
    if (!query) return true;
    const m = hairMeta(v.id);
    return v.name.toLowerCase().includes(query) || v.family.toLowerCase().includes(query) || m.tags.some((t) => t.includes(query)) || (!!m.pattern && m.pattern === query);
  };
  const shown = list.filter((v) => matchFam(v) && matchQuery(v));
  const color = cat.color ? look.color[cat.color.key] ?? null : null;
  const tip = slot === 'hair' ? look.color.hairTip ?? null : null;
  return (
    <div>
      {isHair && <HairSearch value={q} onChange={setQ} />}
      {families.length > 1 && (
        <div className="no-scrollbar -mx-3 mb-3 flex gap-1.5 overflow-x-auto px-3">
          <FamilyChip on={!fam} onClick={() => setFam(null)}>All {list.length}</FamilyChip>
          {isHair && <FamilyChip on={fam === '♥'} onClick={() => setFam('♥')}>♥ Favourites {favs.length}</FamilyChip>}
          {isHair && <FamilyChip on={fam === '#textured'} onClick={() => setFam('#textured')}>Textured</FamilyChip>}
          {isHair && <FamilyChip on={fam === '#indian'} onClick={() => setFam('#indian')}>Indian</FamilyChip>}
          {families.map((f) => (
            <FamilyChip key={f} on={fam === f} onClick={() => setFam(f)}>{f}</FamilyChip>
          ))}
        </div>
      )}
      <div className={cn('grid gap-2', cat.thumb === 'face' || cat.thumb === 'feet' ? 'grid-cols-3' : 'grid-cols-4')}>
        {OPTIONAL.includes(slot) && (
          <button onClick={() => onPick(null)} aria-pressed={current === null} aria-label="None" className={cn('grid aspect-square place-items-center rounded-2xl bg-ink/[0.04] ring-1 transition-all active:scale-95', current === null ? 'ring-2 ring-ember-amber' : 'ring-ink/[0.06]')}>
            <Ban className="h-6 w-6 text-ink-faint" />
          </button>
        )}
        {shown.map((v) => (
          <VariantCard key={v.id} slot={slot} id={v.id} name={v.name} frame={cat.thumb} color={color} tip={tip} active={current === v.id} onClick={() => onPick(v.id)} />
        ))}
      </div>
    </div>
  );
}

function FamilyChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn('shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors', on ? 'bg-ember-cream text-noir' : 'bg-ink/[0.05] text-ink-mute')}>
      {children}
    </button>
  );
}

const VariantCard = memo(function VariantCard({ slot, id, name, frame, color, tip, active, onClick }: { slot: Slot; id: number; name: string; frame: Category['thumb']; color: string | null; tip: string | null; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const key = `${slot}:${id}:${color ?? ''}:${tip ?? ''}`;
  const url = useThumb(
    key,
    () => {
      const l = mannequin();
      l.pick[slot] = id;
      if (slot === 'dress') l.pick.top = l.pick.bottom = null;
      if (slot === 'tonguePierce') l.expression = 'tongue';
      if (slot === 'bag') l.pose = 'celebrating'; // arms up, so the bag isn't hidden behind the arm
      if (slot === 'lashes') l.color.liner = color;
      if (slot === 'hair' || slot === 'beard') l.color[slot] = color ?? '#3b2618';
      if (slot === 'hair') l.color.hairTip = tip;
      if (slot === 'eyes') l.color.eyes = color ?? '#5a3a22';
      if (slot === 'brows') l.color.brows = color ?? '#2a1d16';
      if (slot === 'mouth') l.color.lips = color ?? '#b8676a';
      const ck = (['top', 'outer', 'bottom', 'dress', 'shoes', 'socks', 'bag', 'hat'] as const).find((k) => k === slot);
      if (ck) l.color[ck] = color;
      return l;
    },
    frame,
    visible,
    !FACE_SLOTS.includes(slot),
  );
  return (
    <button ref={ref} onClick={onClick} aria-pressed={active} aria-label={name} title={name} className={cn('relative aspect-square overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_32%,#ffffff,#e3e8f6)] ring-1 transition-all active:scale-95', active ? 'ring-2 ring-ember-amber' : 'ring-ink/[0.06]')}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" draggable={false} /> : <span className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)] bg-[length:200%_100%]" />}
      {active && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ember-amber text-noir"><Check className="h-3.5 w-3.5" /></span>}
      {slot === 'hair' && <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-white/95 to-white/0 px-1 pb-1 pt-3 text-center text-[9.5px] font-bold leading-tight text-ink">{name}</span>}
    </button>
  );
});

function SwatchGrid({ palette, value, allowNone, onPick }: { palette: string[]; value: string | null; allowNone?: boolean; onPick: (c: string | null) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2.5">
      {allowNone && (
        <button onClick={() => onPick(null)} aria-label="None" aria-pressed={value === null} className={cn('grid aspect-square place-items-center rounded-full bg-ink/[0.05] ring-2', value === null ? 'ring-ember-amber' : 'ring-transparent')}>
          <Ban className="h-5 w-5 text-ink-faint" />
        </button>
      )}
      {palette.map((c) => (
        <button key={c} onClick={() => onPick(c)} aria-label={`Colour ${c}`} aria-pressed={value === c} className={cn('aspect-square rounded-full ring-2 ring-offset-2 ring-offset-noir-800 transition-transform active:scale-90', value === c ? 'ring-ember-amber' : 'ring-transparent')} style={{ background: c }} />
      ))}
    </div>
  );
}

function ColorRail({ palette, value, allowNone, onPick, second }: { palette: string[]; value: string | null; allowNone?: boolean; onPick: (c: string | null) => void; second?: { palette: string[]; value: string | null; allowNone?: boolean; label?: string; onPick: (c: string | null) => void } }) {
  const [which, setWhich] = useState<0 | 1>(0);
  const cur = which === 1 && second ? second : { palette, value, allowNone, onPick };
  return (
    <div className="absolute right-2 top-2 bottom-3 flex w-12 flex-col items-center gap-2">
      {second && (
        <div className="glass flex flex-col overflow-hidden rounded-full text-[9px] font-bold">
          <button onClick={() => setWhich(0)} className={cn('px-2 py-1.5', which === 0 ? 'bg-ember-cream text-noir' : 'text-ink-mute')}>Base</button>
          <button onClick={() => setWhich(1)} className={cn('px-2 py-1.5', which === 1 ? 'bg-ember-cream text-noir' : 'text-ink-mute')}>{second.label ?? 'Tips'}</button>
        </div>
      )}
      <div className="no-scrollbar glass flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto rounded-full p-1.5">
        {cur.allowNone && (
          <button onClick={() => cur.onPick(null)} aria-label="Default colour" className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-ink/[0.06] ring-2', cur.value === null ? 'ring-ember-amber' : 'ring-transparent')}>
            <Ban className="h-4 w-4 text-ink-faint" />
          </button>
        )}
        {cur.palette.map((c) => (
          <button key={c} onClick={() => cur.onPick(c)} aria-label={`Colour ${c}`} className={cn('h-8 w-8 shrink-0 rounded-full ring-2 transition-transform active:scale-90', cur.value === c ? 'scale-110 ring-ember-amber' : 'ring-ink/10')} style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

function TuneSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block rounded-2xl bg-ink/[0.04] px-4 py-3">
      <span className="eyebrow mb-2 flex justify-between">
        {label}
        <span className="tabular-nums normal-case tracking-normal text-ink-soft">{value > 0 ? '+' : ''}{Math.round(value * 100)}</span>
      </span>
      <input type="range" min={-1} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </label>
  );
}

function SavedPanel({ outfits, onWear, onStart, onSave, onExport, gl }: { outfits: { id: string; name: string; outfit: SavedOutfit }[]; onWear: (o: SavedOutfit) => void; onStart: (l: Look) => void; onSave: () => void; onExport: () => void; gl: boolean }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow mb-2 px-1">Start from a character</p>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <PresetCard key={p.name} name={p.name} look={p.look} onClick={() => onStart(p.look)} />
          ))}
        </div>
        <p className="mt-2 px-1 text-xs text-ink-mute">Tap one to try it on — everything stays editable, and Undo brings your old look back.</p>
      </div>
      <div className="glass overflow-hidden rounded-3xl">
        {gl && (
          <button onClick={onExport} className="flex w-full items-center gap-3 border-t border-ink/5 px-4 py-3.5 text-left text-[15px]">
            <Download className="h-5 w-5 text-ink-mute" /> Save image to device
          </button>
        )}
      </div>
      <div>
        <p className="eyebrow mb-2 px-1">My looks</p>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={onSave} className="flex aspect-[4/5] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-ink/20 text-xs font-semibold text-ink-mute">
            <Plus className="h-5 w-5" /> Save outfit
          </button>
          {outfits.map((o) => (
            <SavedCard key={o.id} name={o.name} outfit={o.outfit} onClick={() => onWear(o.outfit)} />
          ))}
        </div>
        {outfits.length === 0 && <p className="mt-3 px-1 text-xs text-ink-mute">Save outfits you love and switch between them in one tap (up to 20).</p>}
      </div>
    </div>
  );
}

function PresetCard({ name, look, onClick }: { name: string; look: Look; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const url = useThumb('preset:' + name + ':' + JSON.stringify(look.pick).length, () => structuredClone(look), 'full', visible);
  return (
    <button ref={ref} onClick={onClick} aria-label={`Start from ${name}`} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_30%,#ffffff,#e3e8f6)] ring-1 ring-ink/[0.06] transition-transform active:scale-95">
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/90 to-transparent px-1.5 pb-1 pt-3 text-center text-[11px] font-semibold text-ink">{name}</span>
    </button>
  );
}

function SavedCard({ name, outfit, onClick }: { name: string; outfit: SavedOutfit; onClick: () => void }) {
  const key = 'saved:' + JSON.stringify(outfit);
  const url = useThumb(
    key,
    () => {
      const l = mannequin();
      l.pick = { ...l.pick, ...outfit.pick };
      l.color = { ...l.color, ...outfit.color };
      return l;
    },
    'full',
    true,
    true,
  );
  return (
    <button onClick={onClick} className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_50%_32%,#ffffff,#e3e8f6)] ring-1 ring-ink/[0.06] active:scale-95">
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/90 to-transparent px-2 pb-1.5 pt-4 text-[11px] font-semibold text-ink">{name}</span>
    </button>
  );
}
