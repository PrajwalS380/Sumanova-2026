/**
 * Effect registry. Add a filter here and it appears everywhere (camera swipe,
 * editor, playback) — no camera code changes needed. `css` is a CSS filter
 * string applied live on previews and baked into photos via canvas `ctx.filter`.
 * Videos keep the original pixels and carry the filter id in metadata, so
 * recipients render it at playback time (cheap on phones).
 */
export interface Filter {
  id: string;
  name: string;
  css: string;
  /** Optional colour wash drawn on top (for tints a CSS filter can't express). */
  tint?: string;
}

export const FILTERS: Filter[] = [
  { id: 'none', name: 'Original', css: 'none' },
  { id: 'aurora', name: 'Aurora', css: 'saturate(1.25) contrast(1.05) hue-rotate(-8deg)', tint: 'linear-gradient(160deg, rgba(139,92,246,.18), rgba(45,212,191,.12) 60%, rgba(251,113,133,.14))' },
  { id: 'vivid', name: 'Vivid', css: 'saturate(1.6) contrast(1.1)' },
  { id: 'warm', name: 'Golden', css: 'sepia(.25) saturate(1.3) hue-rotate(-12deg) brightness(1.04)' },
  { id: 'cool', name: 'Glacier', css: 'saturate(1.1) hue-rotate(12deg) brightness(1.03)', tint: 'linear-gradient(180deg, rgba(56,189,248,.14), rgba(56,189,248,.04))' },
  { id: 'noir', name: 'Noir', css: 'grayscale(1) contrast(1.35) brightness(.95)' },
  { id: 'silver', name: 'Silver', css: 'grayscale(1) contrast(1.05) brightness(1.1)' },
  { id: 'vintage', name: 'Retro', css: 'sepia(.55) contrast(.95) brightness(1.05) saturate(1.2)', tint: 'radial-gradient(circle at center, transparent 55%, rgba(60,30,10,.35))' },
  { id: 'dream', name: 'Dream', css: 'brightness(1.12) saturate(1.15) blur(.6px)', tint: 'linear-gradient(180deg, rgba(255,214,240,.18), rgba(255,255,255,0))' },
  { id: 'glow', name: 'Soft glow', css: 'brightness(1.08) contrast(.94) saturate(1.08)' },
  { id: 'dusk', name: 'Dusk', css: 'saturate(1.2) hue-rotate(-22deg) contrast(1.08) brightness(.96)', tint: 'linear-gradient(0deg, rgba(251,113,133,.2), rgba(124,58,237,.12))' },
];

export const filterById = (id?: string | null) => FILTERS.find((f) => f.id === id) ?? FILTERS[0];

/** Paint a tint (CSS gradient string) onto a canvas using a temporary gradient approximation. */
export function paintTint(ctx: CanvasRenderingContext2D, f: Filter, w: number, h: number) {
  if (!f.tint) return;
  // Parse a few rgba stops from the CSS string and paint a vertical linear gradient.
  const stops = [...f.tint.matchAll(/rgba\([^)]+\)/g)].map((m) => m[0]);
  if (!stops.length) return;
  const g = f.tint.startsWith('radial')
    ? ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7)
    : ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach((s, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), s));
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
