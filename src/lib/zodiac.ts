/** Western zodiac signs + birthday helpers (day/month only — the year is never shown). */
export type Element = 'Fire' | 'Earth' | 'Air' | 'Water';
export interface Sign {
  id: string;
  name: string;
  glyph: string;
  element: Element;
  /** inclusive start month/day */
  from: [number, number];
  to: [number, number];
}

export const SIGNS: Sign[] = [
  { id: 'capricorn', name: 'Capricorn', glyph: '♑', element: 'Earth', from: [12, 22], to: [1, 19] },
  { id: 'aquarius', name: 'Aquarius', glyph: '♒', element: 'Air', from: [1, 20], to: [2, 18] },
  { id: 'pisces', name: 'Pisces', glyph: '♓', element: 'Water', from: [2, 19], to: [3, 20] },
  { id: 'aries', name: 'Aries', glyph: '♈', element: 'Fire', from: [3, 21], to: [4, 19] },
  { id: 'taurus', name: 'Taurus', glyph: '♉', element: 'Earth', from: [4, 20], to: [5, 20] },
  { id: 'gemini', name: 'Gemini', glyph: '♊', element: 'Air', from: [5, 21], to: [6, 20] },
  { id: 'cancer', name: 'Cancer', glyph: '♋', element: 'Water', from: [6, 21], to: [7, 22] },
  { id: 'leo', name: 'Leo', glyph: '♌', element: 'Fire', from: [7, 23], to: [8, 22] },
  { id: 'virgo', name: 'Virgo', glyph: '♍', element: 'Earth', from: [8, 23], to: [9, 22] },
  { id: 'libra', name: 'Libra', glyph: '♎', element: 'Air', from: [9, 23], to: [10, 22] },
  { id: 'scorpio', name: 'Scorpio', glyph: '♏', element: 'Water', from: [10, 23], to: [11, 21] },
  { id: 'sagittarius', name: 'Sagittarius', glyph: '♐', element: 'Fire', from: [11, 22], to: [12, 21] },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Sign for a month (1–12) and day. */
export function signFor(month: number, day: number): Sign {
  const v = month * 100 + day;
  for (const s of SIGNS) {
    const a = s.from[0] * 100 + s.from[1];
    const b = s.to[0] * 100 + s.to[1];
    if (a <= b ? v >= a && v <= b : v >= a || v <= b) return s;
  }
  return SIGNS[0];
}

/** Parse 'YYYY-MM-DD' (user_settings.date_of_birth) into month/day. */
export function monthDay(iso: string | null | undefined): { month: number; day: number } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? { month: +m[2], day: +m[3] } : null;
}

export const formatDayMonth = (month: number, day: number) => `${MONTHS[month - 1]} ${day}`;

/** Whole days from `now` (local midnight) until the next birthday; 0 = today. Feb 29 counts as Feb 28 in other years. */
export function daysUntil(month: number, day: number, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const at = (y: number) => {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return new Date(y, month - 1, month === 2 && day === 29 && !leap ? 28 : day);
  };
  let next = at(today.getFullYear());
  if (next < today) next = at(today.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

const GOOD: Record<Element, Element[]> = { Fire: ['Fire', 'Air'], Air: ['Air', 'Fire'], Water: ['Water', 'Earth'], Earth: ['Earth', 'Water'] };

/** A playful, deterministic match score (55–95%) from the elements — for fun only. */
export function matchScore(a: Sign, b: Sign): { score: number; line: string } {
  const same = a.id === b.id;
  const good = GOOD[a.element].includes(b.element);
  const base = same ? 82 : good ? 78 : 58;
  const wiggle = (a.id.length * 7 + b.id.length * 3) % 14;
  const score = Math.min(95, base + wiggle);
  const line = same ? 'Two of a kind' : good ? (a.element === b.element ? `Double ${a.element.toLowerCase()} energy` : 'Great adventure buddies') : 'Opposites keep it interesting';
  return { score, line };
}
