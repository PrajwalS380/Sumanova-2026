import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Crop, Download, Infinity as InfinityIcon, Paintbrush, RotateCw, Send, Smile, Timer, Trash2, Type, Undo2, X } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/providers/ToastProvider';
import { FILTERS, filterById } from '@/lib/snaps/filters';
import { saveMedia } from '@/lib/saveMedia';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { STICKERS } from '@/features/chat/themes';
import type { Captured } from '@/features/camera/CameraScreen';
import { cropRotate, exportImage, exportOverlay, TEXT_FONT, type OverlayItem, type Stroke } from './compose';
import { SendSheet, type Prepared } from './SendSheet';

type Tool = 'none' | 'text' | 'draw' | 'crop';
const COLORS = ['#ffffff', '#0b0b14', '#a78bfa', '#2dd4bf', '#fb7185', '#fbbf24', '#38bdf8', '#4ade80'];
const DURATIONS = [3, 5, 10, 0] as const; // 0 = no limit
const ASPECTS: { label: string; value: number | null }[] = [
  { label: 'Original', value: null },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '9:16', value: 9 / 16 },
];

export default function MediaEditor({ captured, onClose }: { captured: Captured; onClose: () => void }) {
  const toast = useToast();
  const isVideo = captured.kind === 'video';
  const [src, setSrc] = useState(() => URL.createObjectURL(captured.blob));
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [filterId, setFilterId] = useState(captured.filter);
  const [items, setItems] = useState<OverlayItem[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<Tool>('none');
  const [color, setColor] = useState('#ffffff');
  const [brush, setBrush] = useState(0.012);
  const [editing, setEditing] = useState<OverlayItem | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [stickers, setStickers] = useState(false);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(5);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState(false);
  const [overTrash, setOverTrash] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const drawCanvas = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const drawing = useRef<Stroke | null>(null);
  const filterSwipe = useRef<number | null>(null);

  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  // Fit the media inside the screen, preserving aspect ratio, so overlay fractions map 1:1 to pixels.
  useLayoutEffect(() => {
    if (!natural) return;
    const fit = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const r = natural.w / natural.h;
      const w = Math.min(vw, vh * r);
      setBox({ w, h: w / r });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [natural]);

  // Redraw strokes on the live canvas.
  useEffect(() => {
    const c = drawCanvas.current;
    if (!c || !box.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = box.w * dpr;
    c.height = box.h * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of strokes) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * box.w;
      ctx.beginPath();
      s.points.forEach((p, i) => (i ? ctx.lineTo(p.x * box.w, p.y * box.h) : ctx.moveTo(p.x * box.w, p.y * box.h)));
      if (s.points.length === 1) ctx.lineTo(s.points[0].x * box.w + 0.1, s.points[0].y * box.h);
      ctx.stroke();
    }
  }, [strokes, box]);

  const rel = useCallback((e: { clientX: number; clientY: number }) => {
    const r = stage.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  }, []);

  // ---------- stage pointer handling: draw / move items / swipe filters ----------
  function onStageDown(e: React.PointerEvent) {
    if (tool === 'draw') {
      (e.target as Element).setPointerCapture(e.pointerId);
      drawing.current = { color, width: brush, points: [rel(e)] };
      setStrokes((s) => [...s, drawing.current!]);
      return;
    }
    if (tool === 'none') filterSwipe.current = e.clientX;
    setSelected(null);
  }
  function onStageMove(e: React.PointerEvent) {
    if (tool === 'draw' && drawing.current) {
      drawing.current.points.push(rel(e));
      setStrokes((s) => [...s.slice(0, -1), { ...drawing.current! }]);
      return;
    }
    const d = drag.current;
    if (d) {
      const p = rel(e);
      setItems((list) => list.map((it) => (it.id === d.id ? { ...it, x: p.x - d.dx, y: p.y - d.dy } : it)));
      const r = stage.current!.getBoundingClientRect();
      setOverTrash(e.clientY > r.bottom - 90 && Math.abs(e.clientX - (r.left + r.width / 2)) < 60);
    }
  }
  function onStageUp(e: React.PointerEvent) {
    drawing.current = null;
    const d = drag.current;
    if (d) {
      if (overTrash) {
        haptic(12);
        setItems((list) => list.filter((it) => it.id !== d.id));
      }
      drag.current = null;
      setOverTrash(false);
      return;
    }
    if (tool === 'none' && filterSwipe.current !== null) {
      const dx = e.clientX - filterSwipe.current;
      filterSwipe.current = null;
      if (Math.abs(dx) > 60) {
        const i = FILTERS.findIndex((f) => f.id === filterId);
        setFilterId(FILTERS[(i + (dx < 0 ? 1 : -1) + FILTERS.length) % FILTERS.length].id);
        haptic(5);
      }
    }
  }

  function startItemDrag(e: React.PointerEvent, it: OverlayItem) {
    if (tool === 'draw') return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const p = rel(e);
    drag.current = { id: it.id, dx: p.x - it.x, dy: p.y - it.y };
    setSelected(it.id);
  }

  function addText() {
    const it: OverlayItem = { id: crypto.randomUUID(), type: 'text', content: '', x: 0.5, y: 0.42, size: 0.07, color, style: 'pill' };
    setEditing(it);
    setTool('text');
  }
  function commitText(it: OverlayItem) {
    setEditing(null);
    setTool('none');
    if (!it.content.trim()) return setItems((l) => l.filter((x) => x.id !== it.id));
    setItems((l) => (l.some((x) => x.id === it.id) ? l.map((x) => (x.id === it.id ? it : x)) : [...l, it]));
  }
  function resize(id: string, factor: number) {
    setItems((l) => l.map((it) => (it.id === id ? { ...it, size: Math.min(0.4, Math.max(0.03, it.size * factor)) } : it)));
  }

  async function applyCrop() {
    if (isVideo) return setTool('none');
    if (rotation === 0 && aspect === null) return setTool('none');
    setBusy(true);
    try {
      const blob = await cropRotate(src, rotation, aspect);
      setNatural(null);
      setSrc(URL.createObjectURL(blob));
      setStrokes([]);
      setItems([]);
      setRotation(0);
      setAspect(null);
      setTool('none');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function prepare(): Promise<Prepared> {
    if (!natural) throw new Error('Still loading');
    if (isVideo) {
      const overlay = await exportOverlay(strokes, items, natural.w, natural.h);
      return { kind: 'video', blob: captured.blob, overlay, meta: { filter: filterId, width: natural.w, height: natural.h, duration: captured.duration }, duration: null };
    }
    const blob = await exportImage(src, filterId, strokes, items);
    return { kind: 'image', blob, overlay: null, meta: { width: natural.w, height: natural.h }, duration: duration || null };
  }

  async function save() {
    setBusy(true);
    try {
      const p = await prepare();
      const r = await saveMedia(p.blob, `sumanova-${Date.now()}.${p.kind === 'video' ? (p.blob.type.includes('mp4') ? 'mp4' : 'webm') : 'webp'}`);
      if (r === 'saved') toast(p.overlay ? 'Video saved (text & drawings stay in the snap)' : 'Saved to your device', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function openSend() {
    setBusy(true);
    try {
      setPrepared(await prepare());
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const f = filterById(filterId);
  const previewRotation = tool === 'crop' ? rotation : 0;

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] grid place-items-center overflow-hidden bg-black">
      {/* Stage */}
      <div
        ref={stage}
        className="relative touch-none select-none overflow-hidden"
        style={{ width: box.w || '100%', height: box.h || '100%', transform: `rotate(${previewRotation}deg)`, transition: 'transform .25s' }}
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onPointerCancel={onStageUp}
      >
        {isVideo ? (
          <video src={src} autoPlay loop playsInline muted={false} onLoadedMetadata={(e) => setNatural({ w: e.currentTarget.videoWidth || 720, h: e.currentTarget.videoHeight || 1280 })} className="h-full w-full object-contain" style={{ filter: f.css }} />
        ) : (
          <img src={src} alt="" onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} className="h-full w-full object-contain" style={{ filter: f.css }} draggable={false} />
        )}
        {f.tint && <div className="pointer-events-none absolute inset-0" style={{ background: f.tint }} />}
        <canvas ref={drawCanvas} className="pointer-events-none absolute inset-0 h-full w-full" />
        {tool === 'crop' && aspect && <CropGuide aspect={aspect} box={box} />}
        {items.map((it) => (
          <div
            key={it.id}
            onPointerDown={(e) => startItemDrag(e, it)}
            onDoubleClick={() => it.type === 'text' && (setEditing(it), setTool('text'))}
            className={cn('absolute -translate-x-1/2 -translate-y-1/2 cursor-move whitespace-pre text-center', selected === it.id && 'outline-dashed outline-1 outline-white/60')}
            style={{ left: `${it.x * 100}%`, top: `${it.y * 100}%`, fontSize: it.size * box.w, lineHeight: 1.2, ...itemStyle(it) }}
          >
            {it.content}
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/50 to-transparent px-3 pb-8 pt-safe">
        <EdBtn label="Discard" onClick={onClose}><X className="h-6 w-6" /></EdBtn>
        <div className="flex flex-col gap-2">
          <EdBtn label="Text" active={tool === 'text'} onClick={addText}><Type className="h-5 w-5" /></EdBtn>
          <EdBtn label="Draw" active={tool === 'draw'} onClick={() => setTool(tool === 'draw' ? 'none' : 'draw')}><Paintbrush className="h-5 w-5" /></EdBtn>
          <EdBtn label="Stickers" onClick={() => setStickers(true)}><Smile className="h-5 w-5" /></EdBtn>
          {!isVideo && <EdBtn label="Crop & rotate" active={tool === 'crop'} onClick={() => setTool(tool === 'crop' ? 'none' : 'crop')}><Crop className="h-5 w-5" /></EdBtn>}
          {!isVideo && (
            <EdBtn label={`Snap timer ${duration || 'no limit'}`} onClick={() => setDuration((d) => DURATIONS[(DURATIONS.indexOf(d) + 1) % DURATIONS.length])}>
              <span className="relative">
                {duration ? <Timer className="h-5 w-5" /> : <InfinityIcon className="h-5 w-5" />}
                {duration > 0 && <span className="absolute -bottom-2 -right-2 rounded-full bg-aurora-violet px-1 text-[9px] font-bold">{duration}s</span>}
              </span>
            </EdBtn>
          )}
          {tool === 'draw' && strokes.length > 0 && <EdBtn label="Undo" onClick={() => setStrokes((s) => s.slice(0, -1))}><Undo2 className="h-5 w-5" /></EdBtn>}
        </div>
      </div>

      {/* Tool trays */}
      <AnimatePresence>
        {tool === 'draw' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-28 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 p-2 backdrop-blur-md">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)} aria-label={`Colour ${c}`} className={cn('h-7 w-7 rounded-full ring-2 transition-transform', color === c ? 'scale-110 ring-white' : 'ring-white/20')} style={{ background: c }} />
            ))}
            <input type="range" min={0.004} max={0.04} step={0.002} value={brush} onChange={(e) => setBrush(Number(e.target.value))} aria-label="Brush size" className="ml-1 w-20 accent-white" />
          </motion.div>
        )}
        {tool === 'crop' && !isVideo && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute bottom-28 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/55 p-1.5 backdrop-blur-md">
            {ASPECTS.map((a) => (
              <button key={a.label} onClick={() => setAspect(a.value)} className={cn('rounded-full px-3 py-1.5 text-xs font-semibold', aspect === a.value ? 'bg-white text-black' : 'text-white')}>{a.label}</button>
            ))}
            <button onClick={() => setRotation((r) => r + 90)} aria-label="Rotate" className="grid h-8 w-8 place-items-center rounded-full text-white"><RotateCw className="h-4 w-4" /></button>
            <button onClick={() => void applyCrop()} aria-label="Apply crop" className="grid h-8 w-8 place-items-center rounded-full bg-aurora-gradient text-white"><Check className="h-4 w-4" /></button>
          </motion.div>
        )}
        {selected && tool === 'none' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute bottom-28 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/55 p-1.5 backdrop-blur-md">
            <button onClick={() => resize(selected, 0.85)} className="h-8 w-8 rounded-full text-lg text-white" aria-label="Smaller">−</button>
            <button onClick={() => resize(selected, 1.18)} className="h-8 w-8 rounded-full text-lg text-white" aria-label="Bigger">+</button>
            <button onClick={() => { setItems((l) => l.filter((x) => x.id !== selected)); setSelected(null); }} className="grid h-8 w-8 place-items-center rounded-full text-aurora-coral" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trash target while dragging */}
      <AnimatePresence>
        {drag.current && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: overTrash ? 1.25 : 1 }} exit={{ scale: 0 }} className={cn('absolute bottom-10 left-1/2 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full', overTrash ? 'bg-aurora-coral' : 'bg-black/50')}>
            <Trash2 className="h-6 w-6 text-white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      {tool === 'none' && !selected && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-4 pb-safe pt-10">
          <button onClick={() => void save()} disabled={busy} className="flex h-12 items-center gap-2 rounded-2xl bg-white/15 px-4 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-md disabled:opacity-50">
            <Download className="h-5 w-5" /> Save
          </button>
          <span className="rounded-full bg-black/40 px-3 py-1 text-xs text-white/85">{f.name} · swipe for filters</span>
          <button onClick={() => void openSend()} disabled={busy} className="flex h-12 items-center gap-2 rounded-2xl bg-aurora-gradient px-5 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
            Send <Send className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Text editor */}
      <AnimatePresence>{editing && <TextEditor item={editing} onDone={commitText} />}</AnimatePresence>

      <Sheet open={stickers} onClose={() => setStickers(false)} title="Stickers">
        <div className="grid grid-cols-6 gap-1 px-4 pb-6">
          {STICKERS.map((s) => (
            <button key={s} onClick={() => { setItems((l) => [...l, { id: crypto.randomUUID(), type: 'sticker', content: s, x: 0.5, y: 0.5, size: 0.18, color: '#fff', style: 'plain' }]); setStickers(false); haptic(8); }} className="grid aspect-square place-items-center rounded-2xl text-4xl hover:bg-white/5 active:scale-90" aria-label={`Add ${s}`}>
              {s}
            </button>
          ))}
        </div>
      </Sheet>

      <SendSheet prepared={prepared} onClose={() => setPrepared(null)} onSent={onClose} />
    </motion.div>,
    document.body,
  );
}

function itemStyle(it: OverlayItem): React.CSSProperties {
  if (it.type === 'sticker') return {};
  const base: React.CSSProperties = { fontFamily: TEXT_FONT, fontWeight: 700 };
  if (it.style === 'pill')
    return { ...base, color: it.color === '#ffffff' ? '#fff' : '#0b0b14', background: it.color === '#ffffff' ? 'rgba(7,8,20,.72)' : it.color, padding: '0.25em 0.45em', borderRadius: '0.8em' };
  if (it.style === 'glow') return { ...base, color: it.color, textShadow: `0 0 0.3em ${it.color}, 0 0 0.6em ${it.color}` };
  return { ...base, color: it.color, textShadow: '0 2px 8px rgba(0,0,0,.45)' };
}

function TextEditor({ item, onDone }: { item: OverlayItem; onDone: (it: OverlayItem) => void }) {
  const [it, setIt] = useState(item);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const styles: OverlayItem['style'][] = ['pill', 'plain', 'glow'];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 flex flex-col bg-black/60 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 pt-safe">
        <button onClick={() => setIt({ ...it, style: styles[(styles.indexOf(it.style) + 1) % styles.length] })} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold capitalize">{it.style}</button>
        <button onClick={() => onDone(it)} className="rounded-full bg-aurora-gradient px-4 py-1.5 text-sm font-semibold">Done</button>
      </div>
      <div className="grid flex-1 place-items-center px-6">
        <textarea
          ref={ref}
          value={it.content}
          onChange={(e) => setIt({ ...it, content: e.target.value.slice(0, 120) })}
          rows={3}
          placeholder="Say something…"
          className="w-full resize-none bg-transparent text-center text-3xl font-bold outline-none placeholder:text-white/40"
          style={{ fontFamily: TEXT_FONT, color: it.style === 'pill' ? '#fff' : it.color }}
        />
      </div>
      <div className="flex justify-center gap-2 pb-safe pt-3">
        {COLORS.map((c) => (
          <button key={c} onClick={() => setIt({ ...it, color: c })} aria-label={`Colour ${c}`} className={cn('mb-4 h-8 w-8 rounded-full ring-2', it.color === c ? 'scale-110 ring-white' : 'ring-white/25')} style={{ background: c }} />
        ))}
      </div>
    </motion.div>
  );
}

function CropGuide({ aspect, box }: { aspect: number; box: { w: number; h: number } }) {
  let w = box.w;
  let h = box.h;
  if (w / h > aspect) w = h * aspect;
  else h = w / aspect;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="rounded-sm ring-2 ring-white" style={{ width: w, height: h, boxShadow: '0 0 0 9999px rgba(0,0,0,.55)' }} />
    </div>
  );
}

function EdBtn({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={() => { haptic(6); onClick(); }} aria-label={label} aria-pressed={active} className={cn('pointer-events-auto grid h-11 w-11 place-items-center rounded-full text-white backdrop-blur-md transition-colors active:scale-90', active ? 'bg-white text-black' : 'bg-black/35')}>
      {children}
    </button>
  );
}
