import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/** Original text-sticker styles drawn on a canvas (no fonts or art from anywhere else). */
export const TEXT_STYLES = [
  { id: 'bubble', label: 'Bubble', fill: '#FFFFFF', stroke: '#111111', shadow: '#FF4F9A', bg: null },
  { id: 'pop', label: 'Pop', fill: '#FFD23F', stroke: '#111111', shadow: '#3D7BFF', bg: null },
  { id: 'neon', label: 'Neon', fill: '#FFFFFF', stroke: '#FF4F9A', shadow: '#FF4F9A', bg: '#16102E', glow: true },
  { id: 'mint', label: 'Mint', fill: '#111111', stroke: null, shadow: null, bg: '#7EF0C2' },
  { id: 'candy', label: 'Candy', fill: '#FF4F9A', stroke: '#FFFFFF', shadow: '#8C6BFF', bg: null },
  { id: 'ink', label: 'Ink', fill: '#FFFFFF', stroke: null, shadow: null, bg: '#111111' },
] as const;
export type TextStyleId = (typeof TEXT_STYLES)[number]['id'];

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > max && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/** Draws a 512×512 transparent PNG sticker for the text. */
export function drawTextSticker(c: HTMLCanvasElement, text: string, styleId: TextStyleId) {
  const st = TEXT_STYLES.find((s) => s.id === styleId) ?? TEXT_STYLES[0];
  const S = 512;
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, S, S);
  const t = text.trim() || 'Hello!';
  let size = 120;
  let lines: string[] = [];
  for (; size > 34; size -= 6) {
    x.font = `900 ${size}px "Inter Variable", system-ui, sans-serif`;
    lines = wrap(x, t, S * 0.8);
    if (lines.length * size * 1.05 < S * 0.72 && lines.every((l) => x.measureText(l).width < S * 0.84)) break;
  }
  const lh = size * 1.05;
  const top = S / 2 - ((lines.length - 1) * lh) / 2;
  x.save();
  x.translate(S / 2, S / 2);
  x.rotate(-0.06);
  x.translate(-S / 2, -S / 2);
  if (st.bg) {
    const wMax = Math.max(...lines.map((l) => x.measureText(l).width));
    const bw = wMax + size * 0.9, bh = lines.length * lh + size * 0.6;
    x.fillStyle = st.bg;
    x.beginPath();
    x.roundRect(S / 2 - bw / 2, S / 2 - bh / 2, bw, bh, size * 0.45);
    x.fill();
    x.lineWidth = 10;
    x.strokeStyle = '#FFFFFF';
    x.stroke();
  }
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  lines.forEach((l, i) => {
    const y = top + i * lh;
    if (st.shadow && !('glow' in st)) {
      x.fillStyle = st.shadow;
      if (st.stroke) {
        x.lineWidth = size * 0.26;
        x.strokeStyle = st.shadow;
        x.strokeText(l, S / 2 + size * 0.07, y + size * 0.09);
      }
      x.fillText(l, S / 2 + size * 0.07, y + size * 0.09);
    }
    if ('glow' in st) {
      x.shadowColor = st.shadow!;
      x.shadowBlur = size * 0.35;
    }
    if (st.stroke) {
      x.lineWidth = size * 0.2;
      x.strokeStyle = st.stroke;
      x.strokeText(l, S / 2, y);
    }
    x.fillStyle = st.fill;
    x.fillText(l, S / 2, y);
    x.shadowBlur = 0;
  });
  x.restore();
}

/** Composer sticker tab: type words → pick a style → send as a sticker. */
export function TextStickerMaker({ onSend }: { onSend: (blob: Blob) => void }) {
  const [text, setText] = useState('');
  const [style, setStyle] = useState<TextStyleId>('bubble');
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawTextSticker(ref.current, text, style);
  }, [text, style]);
  return (
    <div className="space-y-3 pb-2">
      <div className="mx-auto grid h-40 w-40 place-items-center rounded-3xl bg-[repeating-conic-gradient(#0000000a_0%_25%,transparent_0%_50%)] bg-[length:20px_20px]">
        <canvas ref={ref} className="h-36 w-36" aria-label="Sticker preview" />
      </div>
      <input value={text} onChange={(e) => setText(e.target.value.slice(0, 40))} placeholder="Type your sticker text" aria-label="Sticker text" className="h-11 w-full rounded-2xl bg-[#F1F1F4] px-4 text-[15px] font-bold outline-none" />
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {TEXT_STYLES.map((s) => (
          <button key={s.id} type="button" onClick={() => setStyle(s.id)} aria-pressed={style === s.id} className={cn('shrink-0 rounded-full px-3.5 py-2 text-[13px] font-extrabold', style === s.id ? 'bg-ink text-white' : 'bg-[#F1F1F4]')}>{s.label}</button>
        ))}
      </div>
      <button
        type="button"
        disabled={!text.trim()}
        onClick={() => ref.current?.toBlob((b) => b && onSend(b), 'image/png')}
        className="h-12 w-full rounded-2xl bg-ember-flame text-[15px] font-extrabold text-white disabled:opacity-40"
      >
        Send sticker
      </button>
    </div>
  );
}
