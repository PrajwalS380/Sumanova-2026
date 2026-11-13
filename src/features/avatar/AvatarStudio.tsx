import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Dices, Download, Loader2, RotateCcw, Save, Shirt, Users2 } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { Toggle } from '@/components/ui/Toggle';
import { saveMedia } from '@/lib/saveMedia';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import type { Profile } from '@/lib/types';
import { CLOTH_COLORS, DEFAULT_AVATAR, EYE_COLORS, HAIR_COLORS, LABELS, LIP_COLORS, OUTFIT_PRESETS, SKIN_TONES, hasWebGL, randomAvatar, type AvatarConfig, type Outfit } from './config';
import { AvatarStage, type AvatarStageHandle } from './AvatarStage';
import { Avatar2D } from './Avatar2D';
import { avatarApi } from './api';

const TABS = ['Face', 'Skin', 'Eyes', 'Nose', 'Mouth', 'Hair', 'Facial hair', 'Body', 'Clothing', 'Accessories', 'Expression', 'Pose', 'Outfits'] as const;
type Tab = (typeof TABS)[number];

export default function AvatarStudio() {
  const { session, profile, setProfile } = useAuth();
  const me = session!.user.id;
  const toast = useToast();
  const navigate = useNavigate();
  const stage = useRef<AvatarStageHandle>(null);
  const [cfg, setCfg] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [saved, setSaved] = useState<AvatarConfig | null>(null);
  const [tab, setTab] = useState<Tab>('Face');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usePhoto, setUsePhoto] = useState(true);
  const [outfits, setOutfits] = useState<{ id: string; name: string; outfit: Outfit }[]>([]);
  const [gl] = useState(hasWebGL);

  useEffect(() => {
    void avatarApi.get(me).then((a) => {
      if (a) {
        setCfg(a);
        setSaved(a);
      } else setCfg(randomAvatar());
      setLoading(false);
    }).catch(() => setLoading(false));
    void avatarApi.outfits().then(setOutfits).catch(() => undefined);
  }, [me]);

  const set = <K extends keyof AvatarConfig>(k: K, v: Partial<AvatarConfig[K]> | AvatarConfig[K]) => {
    haptic(4);
    setCfg((c) => ({ ...c, [k]: typeof v === 'object' && v !== null && !Array.isArray(v) ? { ...(c[k] as object), ...(v as object) } : v }));
  };

  async function save() {
    setSaving(true);
    try {
      await avatarApi.save(me, cfg);
      setSaved(cfg);
      if (usePhoto && gl && stage.current) {
        const png = await stage.current.capture('bust');
        const url = await avatarApi.publishPhoto(me, png);
        if (profile) setProfile({ ...(profile as Profile), avatar_url: url });
      }
      haptic([10, 40, 10]);
      toast('Avatar saved ✦', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function exportImage() {
    if (!stage.current) return;
    try {
      const png = await stage.current.capture('full');
      await saveMedia(png, `sumanova-avatar-${Date.now()}.png`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  }

  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);

  return (
    <div className="fixed inset-0 flex flex-col bg-night">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[60vh]" style={{ background: 'radial-gradient(70% 60% at 50% 35%, rgba(139,92,246,.35), transparent 70%), radial-gradient(50% 40% at 50% 70%, rgba(45,212,191,.18), transparent 70%)' }} />
      <header className="relative z-10 flex items-center gap-2 px-3 pt-safe">
        <button onClick={() => navigate(-1)} aria-label="Back" className="glass grid h-10 w-10 place-items-center rounded-full"><ChevronLeft className="h-5 w-5" /></button>
        <h1 className="flex-1 font-display text-lg font-semibold">Avatar studio</h1>
        <Link to="/avatar/duo" className="glass grid h-10 w-10 place-items-center rounded-full" aria-label="Duo stickers"><Users2 className="h-5 w-5" /></Link>
        <button onClick={() => { haptic(10); setCfg((c) => ({ ...randomAvatar(), pose: c.pose })); }} aria-label="Randomise" className="glass grid h-10 w-10 place-items-center rounded-full"><Dices className="h-5 w-5" /></button>
        <button onClick={() => setCfg(saved ?? DEFAULT_AVATAR)} aria-label="Reset" className="glass grid h-10 w-10 place-items-center rounded-full"><RotateCcw className="h-5 w-5" /></button>
      </header>

      {/* Preview */}
      <div className="relative h-[46vh] shrink-0">
        {loading ? (
          <div className="grid h-full place-items-center"><Loader2 className="h-7 w-7 animate-spin text-ink-mute" /></div>
        ) : gl ? (
          <AvatarStage ref={stage} configs={[cfg]} className="!h-full !w-full touch-none" />
        ) : (
          <div className="grid h-full place-items-center"><Avatar2D config={cfg} size={220} /><p className="absolute bottom-2 text-xs text-ink-mute">3D isn’t available on this device — showing 2D</p></div>
        )}
        {gl && !loading && <p className="pointer-events-none absolute bottom-2 w-full text-center text-[11px] text-ink-faint">Drag to spin 360° · pinch to zoom</p>}
      </div>

      {/* Category chips */}
      <div className="no-scrollbar relative z-10 flex gap-2 overflow-x-auto px-4 py-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn('relative shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors', tab === t ? 'text-white' : 'text-ink-mute')}>
            {tab === t && <motion.span layoutId="avatar-tab" className="absolute inset-0 rounded-full bg-white/12 ring-1 ring-white/15" style={{ backgroundColor: 'rgba(255,255,255,.12)' }} />}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>

      {/* Options */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-28">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="space-y-5 pt-2">
          {tab === 'Face' && (
            <>
              <Chips label="Shape" value={cfg.face.shape} options={LABELS.face} onChange={(v) => set('face', { shape: v })} />
              <Slider label="Width" value={cfg.face.width} min={0.85} max={1.15} onChange={(v) => set('face', { width: v })} />
              <Slider label="Height" value={cfg.face.height} min={0.9} max={1.1} onChange={(v) => set('face', { height: v })} />
              <Slider label="Jawline" value={cfg.face.jaw} min={0} max={1} onChange={(v) => set('face', { jaw: v })} />
              <Slider label="Cheeks" value={cfg.face.cheeks} min={0} max={1} onChange={(v) => set('face', { cheeks: v })} />
              <Slider label="Chin" value={cfg.face.chin} min={0} max={1} onChange={(v) => set('face', { chin: v })} />
              <Slider label="Forehead" value={cfg.face.forehead} min={0} max={1} onChange={(v) => set('face', { forehead: v })} />
            </>
          )}
          {tab === 'Skin' && (
            <>
              <Swatches label="Skin tone" value={cfg.skin} colors={SKIN_TONES} onChange={(v) => set('skin', v)} />
              <Chips label="Undertone" value={cfg.undertone} options={{ warm: 'Warm', neutral: 'Neutral', cool: 'Cool' }} onChange={(v) => set('undertone', v)} />
            </>
          )}
          {tab === 'Eyes' && (
            <>
              <Chips label="Shape" value={cfg.eyes.shape} options={LABELS.eyeShape} onChange={(v) => set('eyes', { shape: v })} />
              <Slider label="Size" value={cfg.eyes.size} min={0.8} max={1.25} onChange={(v) => set('eyes', { size: v })} />
              <Swatches label="Colour" value={cfg.eyes.color} colors={EYE_COLORS} onChange={(v) => set('eyes', { color: v })} />
              <Chips label="Eyebrows" value={cfg.eyes.brow} options={LABELS.brow} onChange={(v) => set('eyes', { brow: v })} />
              <Swatches label="Brow colour" value={cfg.eyes.browColor} colors={HAIR_COLORS} onChange={(v) => set('eyes', { browColor: v })} />
              <Panel><Toggle label="Eyelashes" checked={cfg.eyes.lashes} onChange={(v) => set('eyes', { lashes: v })} /></Panel>
            </>
          )}
          {tab === 'Nose' && (
            <>
              <Chips label="Shape" value={cfg.nose.shape} options={LABELS.nose} onChange={(v) => set('nose', { shape: v })} />
              <Slider label="Size" value={cfg.nose.size} min={0.75} max={1.25} onChange={(v) => set('nose', { size: v })} />
              <Slider label="Width" value={cfg.nose.width} min={0.75} max={1.25} onChange={(v) => set('nose', { width: v })} />
            </>
          )}
          {tab === 'Mouth' && (
            <>
              <Chips label="Lip shape" value={cfg.mouth.shape} options={LABELS.lips} onChange={(v) => set('mouth', { shape: v })} />
              <Slider label="Size" value={cfg.mouth.size} min={0.8} max={1.25} onChange={(v) => set('mouth', { size: v })} />
              <Swatches label="Lip colour" value={cfg.mouth.color} colors={LIP_COLORS} onChange={(v) => set('mouth', { color: v })} />
              <Chips label="Smile" value={cfg.mouth.smile} options={LABELS.smile} onChange={(v) => set('mouth', { smile: v })} />
            </>
          )}
          {tab === 'Hair' && (
            <>
              <Chips label="Style" value={cfg.hair.style} options={LABELS.hair} onChange={(v) => set('hair', { style: v })} />
              <Swatches label="Colour" value={cfg.hair.color} colors={HAIR_COLORS} onChange={(v) => set('hair', { color: v })} />
            </>
          )}
          {tab === 'Facial hair' && (
            <>
              <Chips label="Style" value={cfg.facialHair.style} options={LABELS.facialHair} onChange={(v) => set('facialHair', { style: v })} />
              <Swatches label="Colour" value={cfg.facialHair.color} colors={HAIR_COLORS} onChange={(v) => set('facialHair', { color: v })} />
            </>
          )}
          {tab === 'Body' && (
            <>
              <Slider label="Height" value={cfg.body.height} min={0.92} max={1.08} onChange={(v) => set('body', { height: v })} />
              <Chips label="Build" value={cfg.body.build} options={LABELS.build} onChange={(v) => set('body', { build: v })} />
              <Chips label="Posture" value={cfg.body.posture} options={LABELS.posture} onChange={(v) => set('body', { posture: v })} />
            </>
          )}
          {tab === 'Clothing' && (
            <>
              <Chips label="Top" value={cfg.outfit.top} options={LABELS.top} onChange={(v) => set('outfit', { top: v })} />
              <Swatches label="Top colour" value={cfg.outfit.topColor} colors={CLOTH_COLORS} onChange={(v) => set('outfit', { topColor: v })} />
              <Chips label="Bottom" value={cfg.outfit.bottom} options={LABELS.bottom} onChange={(v) => set('outfit', { bottom: v })} />
              <Swatches label="Bottom colour" value={cfg.outfit.bottomColor} colors={CLOTH_COLORS} onChange={(v) => set('outfit', { bottomColor: v })} />
              <Chips label="Shoes" value={cfg.outfit.shoes} options={LABELS.shoes} onChange={(v) => set('outfit', { shoes: v })} />
              <Swatches label="Shoe colour" value={cfg.outfit.shoeColor} colors={CLOTH_COLORS} onChange={(v) => set('outfit', { shoeColor: v })} />
            </>
          )}
          {tab === 'Accessories' && (
            <>
              <Chips label="Glasses" value={cfg.accessories.glasses} options={LABELS.glasses} onChange={(v) => set('accessories', { glasses: v })} />
              <Chips label="Headwear" value={cfg.accessories.hat} options={LABELS.hat} onChange={(v) => set('accessories', { hat: v })} />
              <Panel>
                <Toggle label="Earrings" checked={cfg.accessories.earrings} onChange={(v) => set('accessories', { earrings: v })} />
                <Toggle label="Necklace" checked={cfg.accessories.necklace} onChange={(v) => set('accessories', { necklace: v })} />
                <Toggle label="Watch" checked={cfg.accessories.watch} onChange={(v) => set('accessories', { watch: v })} />
                <Toggle label="Bag" checked={cfg.accessories.bag} onChange={(v) => set('accessories', { bag: v })} />
                <Toggle label="Bindi" checked={cfg.accessories.bindi} onChange={(v) => set('accessories', { bindi: v })} />
              </Panel>
            </>
          )}
          {tab === 'Expression' && <Chips label="Expression" value={cfg.expression} options={LABELS.expression} onChange={(v) => set('expression', v)} />}
          {tab === 'Pose' && <Chips label="Pose" value={cfg.pose} options={LABELS.pose} onChange={(v) => set('pose', v)} />}
          {tab === 'Outfits' && (
            <>
              <Group label="Presets">
                <div className="grid grid-cols-3 gap-2">
                  {OUTFIT_PRESETS.map((p) => (
                    <OutfitCard key={p.name} name={p.name} outfit={p.outfit} active={JSON.stringify(cfg.outfit) === JSON.stringify(p.outfit)} onClick={() => set('outfit', p.outfit)} />
                  ))}
                </div>
              </Group>
              <Group label={`My outfits · ${outfits.length}/20`}>
                <div className="grid grid-cols-3 gap-2">
                  {outfits.map((o) => <OutfitCard key={o.id} name={o.name} outfit={o.outfit} active={JSON.stringify(cfg.outfit) === JSON.stringify(o.outfit)} onClick={() => set('outfit', o.outfit)} />)}
                  <button
                    onClick={async () => {
                      const name = window.prompt('Name this outfit', `Look ${outfits.length + 1}`)?.trim();
                      if (!name) return;
                      try {
                        await avatarApi.saveOutfit(me, name.slice(0, 30), cfg.outfit);
                        setOutfits(await avatarApi.outfits());
                        toast('Outfit saved', 'success');
                      } catch (e) {
                        toast((e as Error).message, 'error');
                      }
                    }}
                    className="grid aspect-[4/5] place-items-center rounded-2xl border border-dashed border-white/20 text-xs text-ink-mute"
                  >
                    <span className="flex flex-col items-center gap-1"><Shirt className="h-5 w-5" /> Save current</span>
                  </button>
                </div>
              </Group>
            </>
          )}
        </motion.div>
      </div>

      {/* Save bar */}
      <div className="glass-strong absolute inset-x-0 bottom-0 z-20 rounded-t-[2rem] px-4 pb-safe pt-3">
        {gl && <div className="-mx-4 mb-1"><Toggle label="Use as my profile photo" checked={usePhoto} onChange={setUsePhoto} /></div>}
        <div className="flex gap-2">
          {gl && (
            <button onClick={() => void exportImage()} className="glass flex h-12 items-center gap-2 rounded-2xl px-4 text-sm font-semibold" aria-label="Export image"><Download className="h-5 w-5" /></button>
          )}
          <button onClick={() => void save()} disabled={saving || (!dirty && !!saved && !usePhoto)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-aurora-gradient font-semibold shadow-glow disabled:opacity-50">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="h-5 w-5" /> {saved ? (dirty ? 'Save changes' : 'Saved') : 'Save avatar'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">{label}</p>
      {children}
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="glass divide-y divide-white/5 overflow-hidden rounded-3xl">{children}</div>;
}

function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <Group label={label}>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(options) as T[]).map((k) => (
          <button key={k} onClick={() => onChange(k)} aria-pressed={value === k} className={cn('rounded-full px-3.5 py-2 text-sm transition-all active:scale-95', value === k ? 'bg-white text-night font-semibold' : 'bg-white/[0.06] text-ink-soft ring-1 ring-white/10')}>
            {options[k]}
          </button>
        ))}
      </div>
    </Group>
  );
}

function Swatches({ label, value, colors, onChange }: { label: string; value: string; colors: string[]; onChange: (v: string) => void }) {
  return (
    <Group label={label}>
      <div className="flex flex-wrap gap-2.5">
        {colors.map((c) => (
          <button key={c} onClick={() => onChange(c)} aria-label={`${label} ${c}`} aria-pressed={value === c} className={cn('h-9 w-9 rounded-full ring-2 transition-transform', value === c ? 'scale-110 ring-white' : 'ring-white/10')} style={{ background: c }} />
        ))}
      </div>
    </Group>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex justify-between text-xs font-semibold uppercase tracking-wider text-ink-mute">
        {label}
        <span className="tabular-nums normal-case tracking-normal">{Math.round(((value - min) / (max - min)) * 100)}%</span>
      </span>
      <input type="range" min={min} max={max} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-aurora-iris" />
    </label>
  );
}

function OutfitCard({ name, outfit, active, onClick }: { name: string; outfit: Outfit; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('flex aspect-[4/5] flex-col items-center justify-center gap-1 rounded-2xl p-2 text-xs transition-all active:scale-95', active ? 'bg-white/15 ring-2 ring-white' : 'bg-white/[0.05] ring-1 ring-white/10')}>
      <span className="h-8 w-10 rounded-t-xl" style={{ background: outfit.topColor }} />
      <span className="h-6 w-8 rounded-b-md" style={{ background: outfit.bottomColor }} />
      <span className="h-1.5 w-9 rounded-full" style={{ background: outfit.shoeColor }} />
      <span className="mt-1 truncate font-semibold">{name}</span>
    </button>
  );
}
