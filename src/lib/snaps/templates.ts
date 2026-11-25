/**
 * Snap templates: original frames and layouts drawn over a photo/video (baked into photos,
 * added to the overlay layer of videos).
 */
export interface Template {
  id: string;
  name: string;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, now: Date) => void;
}

const FONT = '"Inter Variable", system-ui, sans-serif';
const dateLabel = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function star(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

export const TEMPLATES: Template[] = [
  {
    id: 'polaroid',
    name: 'Instant photo',
    draw(ctx, w, h, now) {
      const m = w * 0.05, bottom = h * 0.16;
      ctx.fillStyle = '#FBFAF7';
      ctx.fillRect(0, 0, w, m);
      ctx.fillRect(0, 0, m, h);
      ctx.fillRect(w - m, 0, m, h);
      ctx.fillRect(0, h - bottom, w, bottom);
      ctx.fillStyle = '#2B2B2B';
      ctx.font = `italic 700 ${w * 0.055}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(dateLabel(now), w / 2, h - bottom / 2 + w * 0.02);
    },
  },
  {
    id: 'film',
    name: 'Film strip',
    draw(ctx, w, h) {
      const bar = w * 0.09;
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, bar, h);
      ctx.fillRect(w - bar, 0, bar, h);
      ctx.fillStyle = '#F1F1F4';
      const hole = bar * 0.42;
      for (let y = hole; y < h; y += hole * 2.2) {
        for (const x of [bar / 2 - hole / 2, w - bar / 2 - hole / 2]) {
          ctx.beginPath();
          ctx.roundRect(x, y, hole, hole * 1.3, hole * 0.2);
          ctx.fill();
        }
      }
    },
  },
  {
    id: 'magazine',
    name: 'Cover story',
    draw(ctx, w, h, now) {
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.3);
      g.addColorStop(0, 'rgba(0,0,0,.45)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h * 0.3);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = `900 ${w * 0.17}px ${FONT}`;
      ctx.fillText('NOVA', w / 2, h * 0.13);
      ctx.font = `800 ${w * 0.035}px ${FONT}`;
      ctx.fillText(`THE ${now.toLocaleDateString(undefined, { month: 'long' }).toUpperCase()} ISSUE`, w / 2, h * 0.17);
      ctx.textAlign = 'left';
      ctx.font = `900 ${w * 0.065}px ${FONT}`;
      ctx.fillStyle = '#FF4F9A';
      ctx.fillText('MAIN', w * 0.06, h * 0.84);
      ctx.fillStyle = '#fff';
      ctx.fillText('CHARACTER', w * 0.06, h * 0.84 + w * 0.07);
      ctx.font = `700 ${w * 0.032}px ${FONT}`;
      ctx.fillText('Exclusive: a day in the life', w * 0.06, h * 0.84 + w * 0.12);
    },
  },
  {
    id: 'ticket',
    name: 'Ticket',
    draw(ctx, w, h, now) {
      ctx.fillStyle = '#FFB020';
      const band = h * 0.12;
      ctx.fillRect(0, h - band, w, band);
      ctx.fillStyle = '#111';
      ctx.font = `900 ${w * 0.06}px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText('ADMIT ONE', w * 0.06, h - band / 2 + w * 0.02);
      ctx.textAlign = 'right';
      ctx.font = `800 ${w * 0.035}px ${FONT}`;
      ctx.fillText(dateLabel(now), w * 0.94, h - band / 2 + w * 0.012);
      ctx.globalCompositeOperation = 'destination-out';
      for (const x of [0, w]) {
        ctx.beginPath();
        ctx.arc(x, h - band, w * 0.04, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  },
  {
    id: 'tape',
    name: 'Scrapbook',
    draw(ctx, w, h) {
      const tw = w * 0.3, th = w * 0.08;
      for (const [x, y, a] of [[w * 0.12, h * 0.03, -0.5], [w * 0.88, h * 0.03, 0.5], [w * 0.12, h * 0.97, 0.5], [w * 0.88, h * 0.97, -0.5]] as const) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.fillStyle = 'rgba(255,224,150,.85)';
        ctx.fillRect(-tw / 2, -th / 2, tw, th);
        ctx.strokeStyle = 'rgba(0,0,0,.08)';
        ctx.setLineDash([th * 0.15, th * 0.15]);
        ctx.strokeRect(-tw / 2, -th / 2, tw, th);
        ctx.restore();
      }
    },
  },
  {
    id: 'stamp',
    name: 'Date stamp',
    draw(ctx, w, h, now) {
      ctx.fillStyle = '#FF8A1F';
      ctx.shadowColor = 'rgba(255,138,31,.8)';
      ctx.shadowBlur = w * 0.01;
      ctx.font = `700 ${w * 0.05}px "Courier New", monospace`;
      ctx.textAlign = 'right';
      const d = now;
      ctx.fillText(`'${String(d.getFullYear()).slice(2)} ${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getDate()).padStart(2, '0')}`, w * 0.94, h * 0.95);
      ctx.shadowBlur = 0;
    },
  },
  {
    id: 'nova',
    name: 'Nova frame',
    draw(ctx, w, h) {
      const b = w * 0.035;
      ctx.fillStyle = '#FF4F9A';
      ctx.fillRect(0, 0, w, b);
      ctx.fillRect(0, h - b, w, b);
      ctx.fillRect(0, 0, b, h);
      ctx.fillRect(w - b, 0, b, h);
      ctx.fillStyle = '#fff';
      for (const [x, y, s] of [[w * 0.1, h * 0.08, w * 0.05], [w * 0.9, h * 0.12, w * 0.035], [w * 0.88, h * 0.9, w * 0.05], [w * 0.12, h * 0.92, w * 0.03]] as const) star(ctx, x, y, s);
    },
  },
];
export const templateById = (id: string | null) => TEMPLATES.find((t) => t.id === id) ?? null;
