/**
 * "Nova emoji" — SUMANOVA's own emoji set, drawn here as SVG (original artwork, no third-party
 * emoji fonts or packs). House style, same as the Nova logo: squircle "bento" faces, flat
 * colours, bold #111 outline, white glint. Used for badges, streaks, the lens tray, chat
 * stickers, and drawn onto the camera by face-tracked lenses.
 */

const INK = '#111';
const O = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
const L = (w = 3) => `fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

const eyes = (y = 31, dx = 8, cx = 32, r = 3.4) =>
  [-1, 1].map((s) => `<ellipse cx="${cx + s * dx}" cy="${y}" rx="${r * 0.9}" ry="${r * 1.2}" fill="${INK}"/><circle cx="${cx + s * dx + 1}" cy="${y - 1.4}" r="${r * 0.33}" fill="#fff"/>`).join('');
const smile = (y = 41, w = 7, cx = 32) => `<path d="M${cx - w} ${y} Q${cx} ${y + 6} ${cx + w} ${y}" ${L(3)}/>`;
const blush = (y = 39, dx = 15, c = '#FF7FB0') => [-1, 1].map((s) => `<ellipse cx="${32 + s * dx}" cy="${y}" rx="4.2" ry="2.5" fill="${c}" opacity=".75"/>`).join('');
const shine = (d = 'M15 21 Q18 15 25 13.5') => `<path d="${d}" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".75"/>`;
const squircle = (fill: string, y = 9, h = 49) => `<rect x="6" y="${y}" width="52" height="${h}" rx="20" fill="${fill}" ${O}/>`;
const heartPath = (x: number, y: number, s: number) =>
  `M${x} ${y + s * 0.42} C${x - s * 1.05} ${y - s * 0.25} ${x - s * 0.55} ${y - s * 1.05} ${x} ${y - s * 0.45} C${x + s * 0.55} ${y - s * 1.05} ${x + s * 1.05} ${y - s * 0.25} ${x} ${y + s * 0.42}Z`;
function starPath(cx: number, cy: number, R: number, r: number, n = 5, rot = -90) {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rad = i % 2 ? r : R;
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)}`);
  }
  return `M${pts.join(' L')}Z`;
}
/** Four-point Nova twinkle (the logo's star). */
const twinkle = (x: number, y: number, s: number, fill = '#fff', stroke = true) =>
  `<path d="M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z" fill="${fill}" ${stroke ? O : ''}/>`;

const ART = {
  flame: `<path d="M32 4 C39 14 51 20 51 37 C51 50 42 59 32 59 C22 59 13 50 13 37 C13 28 19 23 21 15 C25 20 27 24 28 27 C30 19 30 11 32 4Z" fill="#FF5A36" ${O}/>
    <path d="M32 29 C37 35 43 38 43 46 C43 52 38 55 32 55 C26 55 21 52 21 46 C21 40 27 37 32 29Z" fill="#FFC23D"/>
    ${eyes(43, 5.5, 32, 2.6)}<path d="M28.5 49 Q32 52 35.5 49" ${L(2.6)}/>${shine('M20 34 Q20 27 24 22')}`,
  star: `<path d="${starPath(32, 34, 28, 13.5)}" fill="#FFB020" ${O}/>${eyes(33, 6, 32, 2.8)}${smile(40, 4.5)}${shine('M24 20 L28 13')}`,
  hundred: `<path d="M18 40 L12 60 L21 56 L25 62 L29 44Z" fill="#8C6BFF" ${O}/><path d="M46 40 L52 60 L43 56 L39 62 L35 44Z" fill="#8C6BFF" ${O}/>
    <circle cx="32" cy="27" r="22" fill="#FF4F9A" ${O}/><circle cx="32" cy="27" r="15.5" fill="none" stroke="#fff" stroke-width="2" opacity=".55"/>
    <path d="M20 21 L23 19 L23 34 M28 26.5 a3.6 7.5 0 1 0 7.2 0 a3.6 7.5 0 1 0 -7.2 0 M38 26.5 a3.6 7.5 0 1 0 7.2 0 a3.6 7.5 0 1 0 -7.2 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  trophy: `<path d="M19 14 H11 C11 25 15 29 21 30 M45 14 H53 C53 25 49 29 43 30" ${L(3.5)}/>
    <path d="M17 8 H47 V25 C47 36 40 42 32 42 C24 42 17 36 17 25Z" fill="#FFB020" ${O}/>
    <rect x="27.5" y="41" width="9" height="9" fill="#FFB020" ${O}/><rect x="18" y="49" width="28" height="10" rx="4" fill="#8C6BFF" ${O}/>
    ${eyes(24, 6, 32, 2.8)}${smile(31, 4.5)}${shine('M22 13 V22')}`,
  camera: `<rect x="21" y="9" width="22" height="11" rx="4" fill="#FF4F9A" ${O}/><rect x="6" y="16" width="52" height="40" rx="14" fill="#FF4F9A" ${O}/>
    <circle cx="32" cy="36" r="12.5" fill="#fff" ${O}/><circle cx="32" cy="36" r="5.5" fill="${INK}"/><circle cx="34" cy="33.5" r="1.8" fill="#fff"/>
    <circle cx="49" cy="25" r="2.6" fill="#fff"/>${shine('M12 30 Q12 23 18 21')}`,
  chat: `<path d="M8 22 C8 14 13 9 21 9 H33 C41 9 46 14 46 22 C46 30 41 35 33 35 H22 L13 41 L15 34 C10 32 8 28 8 22Z" fill="#3D7BFF" ${O}/>
    <path d="M56 38 C56 30 51 25 43 25 H31 C23 25 18 30 18 38 C18 46 23 51 31 51 H42 L51 57 L49 50 C54 48 56 44 56 38Z" fill="#18C48C" ${O}/>
    <circle cx="29" cy="38" r="2.6" fill="#fff"/><circle cx="37" cy="38" r="2.6" fill="#fff"/><circle cx="45" cy="38" r="2.6" fill="#fff"/>`,
  hearts: `<path d="${heartPath(22, 30, 22)}" fill="#8C6BFF" ${O}/><path d="${heartPath(42, 42, 22)}" fill="#FF4F9A" ${O}/>
    ${shine("M34 33 Q36 28 41 28")}${twinkle(52, 12, 6, '#FFB020')}`,
  cake: `<rect x="29" y="12" width="6" height="16" rx="2" fill="#3D7BFF" ${O}/><path d="M32 3 C35 7 36 9 32 11 C28 9 29 7 32 3Z" fill="#FFB020" ${O}/>
    <rect x="9" y="28" width="46" height="28" rx="9" fill="#FFE3EE" ${O}/>
    <path d="M9 37 C13 42 17 42 20 37 C23 42 28 42 31 37 C34 42 39 42 42 37 C45 42 50 42 55 37 V34 C55 30 52 28 48 28 H16 C12 28 9 30 9 34Z" fill="#FF4F9A" ${O}/>
    ${eyes(46, 7, 32, 2.6)}<path d="M29 51 Q32 53.5 35 51" ${L(2.6)}/>`,
  sprout: `<path d="M32 58 V30" ${L(4)}/><path d="M32 34 C32 22 22 15 9 16 C9 29 19 35 32 34Z" fill="#18C48C" ${O}/>
    <path d="M32 28 C32 16 41 9 55 10 C55 23 45 29 32 28Z" fill="#7BE0A8" ${O}/>
    <path d="M14 58 H50" ${L(4)}/>${eyes(23, 4.5, 21, 2.2)}<path d="M18.5 27 Q21 29 23.5 27" ${L(2.2)}/>`,
  crown: `<path d="M8 50 L8 20 L20 32 L32 10 L44 32 L56 20 L56 50Z" fill="#FFB020" ${O}/><rect x="8" y="46" width="48" height="10" rx="3" fill="#FF8A1F" ${O}/>
    <circle cx="20" cy="51" r="2.8" fill="#FF4F9A"/><circle cx="32" cy="51" r="2.8" fill="#18C48C"/><circle cx="44" cy="51" r="2.8" fill="#8C6BFF"/>
    ${eyes(36, 6, 32, 2.8)}${smile(41, 4)}${twinkle(50, 9, 5)}`,
  shades: `${squircle('#FFC9A8')}<path d="M10 27 H54" ${L(3.2)}/>
    <rect x="12" y="24" width="17" height="12" rx="6" fill="${INK}"/><rect x="35" y="24" width="17" height="12" rx="6" fill="${INK}"/>
    <path d="M15 27 L19 27" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".7"/><path d="M38 27 L42 27" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>
    <path d="M26 45 Q34 49 40 42" ${L(3)}/>${shine()}`,
  kitty: `<path d="M9 30 L11 5 L28 16Z" fill="#FF9A4D" ${O}/><path d="M55 30 L53 5 L36 16Z" fill="#FF9A4D" ${O}/>
    <path d="M14 21 L15 12 L22 17Z" fill="#FFB3CF"/><path d="M50 21 L49 12 L42 17Z" fill="#FFB3CF"/>
    ${squircle('#FF9A4D', 13, 46)}${eyes(33)}<path d="M29.5 40 H34.5 L32 43Z" fill="#FF4F9A" ${O.replace('3.5', '2')}/>
    <path d="M32 43 Q29 47 26 45 M32 43 Q35 47 38 45" ${L(2.4)}/>
    <path d="M4 38 L16 40 M4 45 L16 43 M60 38 L48 40 M60 45 L48 43" ${L(2)}/>`,
  smitten: `${squircle('#FFD45E')}<path d="${heartPath(23, 31, 7.5)}" fill="#FF3B6B" ${O.replace('3.5', '2.4')}/><path d="${heartPath(41, 31, 7.5)}" fill="#FF3B6B" ${O.replace('3.5', '2.4')}/>
    <path d="M23 41 Q32 52 41 41Z" fill="${INK}" ${O.replace('3.5', '2.6')}/><path d="M27 46 Q32 49 37 46" stroke="#FF7FA0" stroke-width="2.6" stroke-linecap="round" fill="none"/>${shine()}`,
  sparkle: `${twinkle(28, 34, 24, '#fff')}${twinkle(50, 14, 9, '#FF4F9A')}${twinkle(52, 50, 6, '#FFB020')}
    ${eyes(34, 5.5, 28, 2.6)}<path d="M25 40.5 Q28 43 31 40.5" ${L(2.4)}/>`,
  halo: `<ellipse cx="32" cy="9" rx="19" ry="5.5" fill="none" stroke="#2DD4BF" stroke-width="5"/><ellipse cx="32" cy="9" rx="19" ry="5.5" fill="none" stroke="${INK}" stroke-width="1.6"/>
    ${squircle('#CDEBFF', 15, 44)}<path d="M20 34 Q24 30 28 34 M36 34 Q40 30 44 34" ${L(3)}/>${smile(43, 6)}${blush(41)}`,
  puppy: `<path d="M13 12 C5 14 4 32 9 40 C13 42 16 33 17 24Z" fill="#8A5A3B" ${O}/><path d="M51 12 C59 14 60 32 55 40 C51 42 48 33 47 24Z" fill="#8A5A3B" ${O}/>
    ${squircle('#E8B07A', 9, 49)}${eyes(30)}<ellipse cx="32" cy="38" rx="5" ry="3.6" fill="${INK}"/>
    <path d="M32 41.5 V44 M26 44 Q32 48 38 44" ${L(2.6)}/><path d="M29 46 Q29 54 32 54 Q35 54 35 46Z" fill="#FF6F9C" ${O.replace('3.5', '2.2')}/>`,
  bunny: `<rect x="13" y="1" width="12" height="28" rx="6" fill="#fff" ${O}/><rect x="39" y="1" width="12" height="28" rx="6" fill="#fff" ${O}/>
    <rect x="16.5" y="5" width="5" height="18" rx="2.5" fill="#FFB3CF"/><rect x="42.5" y="5" width="5" height="18" rx="2.5" fill="#FFB3CF"/>
    ${squircle('#fff', 17, 42)}${eyes(35)}<path d="M30 41 H34 L32 43.5Z" fill="#FF4F9A"/>
    <path d="M32 43.5 Q28 47 25 45 M32 43.5 Q36 47 39 45" ${L(2.4)}/><rect x="29.5" y="46" width="5" height="5" rx="1" fill="#fff" ${O.replace('3.5', '2')}/>${blush(44, 16)}`,
  butterfly: `<path d="M31 30 C24 10 6 6 6 20 C6 30 18 33 31 31Z" fill="#8C6BFF" ${O}/><path d="M33 30 C40 10 58 6 58 20 C58 30 46 33 33 31Z" fill="#8C6BFF" ${O}/>
    <path d="M31 33 C18 33 10 42 14 50 C19 56 28 46 31 36Z" fill="#FF4F9A" ${O}/><path d="M33 33 C46 33 54 42 50 50 C45 56 36 46 33 36Z" fill="#FF4F9A" ${O}/>
    <circle cx="16" cy="19" r="3.5" fill="#fff" opacity=".8"/><circle cx="48" cy="19" r="3.5" fill="#fff" opacity=".8"/>
    <rect x="28.5" y="20" width="7" height="32" rx="3.5" fill="${INK}"/><path d="M30 21 C28 15 25 12 22 11 M34 21 C36 15 39 12 42 11" ${L(2.2)}/>`,
  flower: `${[0, 60, 120, 180, 240, 300].map((a) => `<circle cx="${(32 + Math.cos((a * Math.PI) / 180) * 17).toFixed(1)}" cy="${(32 + Math.sin((a * Math.PI) / 180) * 17).toFixed(1)}" r="11" fill="#FF8FC0" ${O}/>`).join('')}
    <circle cx="32" cy="32" r="14" fill="#FFD45E" ${O}/>${eyes(30, 5, 32, 2.4)}<path d="M28.5 36 Q32 39 35.5 36" ${L(2.4)}/>`,
  devil: `<path d="M12 22 C6 16 7 7 11 3 C13 10 18 13 22 14Z" fill="#FF3B3B" ${O}/><path d="M52 22 C58 16 57 7 53 3 C51 10 46 13 42 14Z" fill="#FF3B3B" ${O}/>
    ${squircle('#8C6BFF', 11, 47)}<path d="M18 26 L28 30 M46 26 L36 30" ${L(3)}/>${eyes(33, 8, 32, 3)}
    <path d="M22 41 Q32 50 42 41" ${L(3)}/><path d="M25 43.5 L27 47 L29 45" fill="#fff"/>`,
  alien: `<path d="M22 14 L16 3 M42 14 L48 3" ${L(3)}/><circle cx="16" cy="4" r="3.5" fill="#FF4F9A" ${O.replace('3.5', '2.4')}/><circle cx="48" cy="4" r="3.5" fill="#FF4F9A" ${O.replace('3.5', '2.4')}/>
    <path d="M32 10 C49 10 58 20 58 32 C58 47 44 59 32 59 C20 59 6 47 6 32 C6 20 15 10 32 10Z" fill="#7BE07B" ${O}/>
    <ellipse cx="21" cy="34" rx="8" ry="5.5" transform="rotate(25 21 34)" fill="${INK}"/><ellipse cx="43" cy="34" rx="8" ry="5.5" transform="rotate(-25 43 34)" fill="${INK}"/>
    <circle cx="23" cy="32" r="1.8" fill="#fff"/><circle cx="45" cy="32" r="1.8" fill="#fff"/><path d="M28 48 Q32 50 36 48" ${L(2.6)}/>${shine('M15 25 Q17 19 23 16')}`,
  blush: `${squircle('#FFD8C2')}<path d="M19 31 Q23 27 27 31 M37 31 Q41 27 45 31" ${L(3)}/>${blush(39, 15, '#FF4F9A')}
    ${[17, 20, 15].map((x, i) => `<circle cx="${x}" cy="${35 + i * 2}" r="0.9" fill="#B5694A"/>`).join('')}${[47, 44, 49].map((x, i) => `<circle cx="${x}" cy="${35 + i * 2}" r="0.9" fill="#B5694A"/>`).join('')}
    ${smile(43, 5)}${shine()}`,
  wow: `<path d="${starPath(32, 32, 30, 23, 12, -90)}" fill="#FF4F9A" ${O}/>${squircle('#FFD45E', 13, 40).replace('x="6"', 'x="13"').replace('width="52"', 'width="38"').replace('rx="20"', 'rx="16"')}
    ${eyes(29, 7, 32, 3)}<ellipse cx="32" cy="42" rx="4.5" ry="5.5" fill="${INK}"/>`,
  hourglass: `<path d="M16 6 H48 M16 58 H48" ${L(4)}/><path d="M19 8 C19 22 30 26 30 32 C30 38 19 42 19 56 H45 C45 42 34 38 34 32 C34 26 45 22 45 8Z" fill="#CDEBFF" ${O}/>
    <path d="M24 52 C24 46 30 43 32 40 C34 43 40 46 40 52Z" fill="#FFB020"/><path d="M25 14 H39 C38 19 34 22 32 24 C30 22 26 19 25 14Z" fill="#FFB020"/>`,
  nova: `<rect x="4" y="4" width="56" height="56" rx="18" fill="#FF4F9A" ${O}/>${twinkle(32, 32, 21, '#fff')}${eyes(31, 5, 32, 2.6)}<path d="M28.5 37 Q32 40 35.5 37" ${L(2.4)}/>`,
} as const;

export type NovaEmojiId = keyof typeof ART;
export const NOVA_EMOJI_IDS = Object.keys(ART) as NovaEmojiId[];

export function novaSvg(id: NovaEmojiId): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${ART[id]}</svg>`;
}

const urls = new Map<NovaEmojiId, string>();
export function novaEmojiUrl(id: NovaEmojiId): string {
  let u = urls.get(id);
  if (!u) {
    u = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(novaSvg(id))}`;
    urls.set(id, u);
  }
  return u;
}

/** Decoded image for drawing on a canvas (camera lenses). Returns null until it has loaded. */
const imgs = new Map<string, HTMLImageElement>();
export function novaEmojiImage(id: NovaEmojiId): HTMLImageElement | null {
  let img = imgs.get(id);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = novaEmojiUrl(id);
    imgs.set(id, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** Friendship badges from the server ("🔥 Streak keeper") → our own artwork. */
const BADGE_ART: [RegExp, NovaEmojiId][] = [
  [/streak keeper/i, 'flame'],
  [/30-day/i, 'trophy'],
  [/century/i, 'hundred'],
  [/snap squad/i, 'camera'],
  [/chatterbox/i, 'chat'],
  [/best friend/i, 'hearts'],
  [/one year/i, 'cake'],
];
export function badgeArt(label: string): { id: NovaEmojiId; text: string } {
  const text = label.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  return { id: BADGE_ART.find(([re]) => re.test(text))?.[1] ?? 'star', text };
}

/** Stickers are stored as text: "nova:<id>" for our own art (anything else is a plain emoji). */
export const NOVA_STICKER_PREFIX = 'nova:';
export function novaStickerId(body: string | null | undefined): NovaEmojiId | null {
  return parseNovaSticker(body)?.id ?? null;
}

/** Animated "GIF" stickers: nova:<id>@<motion>#<caption>. */
export const NOVA_MOTIONS = ['bounce', 'wiggle', 'spin', 'pulse', 'float', 'shake'] as const;
export type NovaMotion = (typeof NOVA_MOTIONS)[number];
export interface NovaSticker { id: NovaEmojiId; motion: NovaMotion | null; caption: string | null }

export function parseNovaSticker(body: string | null | undefined): NovaSticker | null {
  if (!body?.startsWith(NOVA_STICKER_PREFIX)) return null;
  const m = /^nova:([a-z]+)(?:@([a-z]+))?(?:#(.{1,24}))?$/u.exec(body);
  if (!m || !(NOVA_EMOJI_IDS as string[]).includes(m[1])) return null;
  const motion = (NOVA_MOTIONS as readonly string[]).includes(m[2] ?? '') ? (m[2] as NovaMotion) : null;
  return { id: m[1] as NovaEmojiId, motion, caption: m[3] ?? null };
}
export const novaStickerBody = (s: NovaSticker) => `${NOVA_STICKER_PREFIX}${s.id}${s.motion ? `@${s.motion}` : ''}${s.caption ? `#${s.caption}` : ''}`;

/** Our own animated sticker pack (no third-party GIF service). */
export const NOVA_GIFS: NovaSticker[] = [
  { id: 'wow', motion: 'shake', caption: 'OMG' },
  { id: 'smitten', motion: 'pulse', caption: 'Love it' },
  { id: 'flame', motion: 'wiggle', caption: 'Lit' },
  { id: 'star', motion: 'spin', caption: 'Star!' },
  { id: 'hearts', motion: 'float', caption: 'Miss you' },
  { id: 'crown', motion: 'bounce', caption: 'Queen' },
  { id: 'devil', motion: 'shake', caption: 'Hehe' },
  { id: 'halo', motion: 'float', caption: 'Who, me?' },
  { id: 'kitty', motion: 'wiggle', caption: 'Meow' },
  { id: 'puppy', motion: 'bounce', caption: 'Pls?' },
  { id: 'cake', motion: 'bounce', caption: 'HBD!' },
  { id: 'trophy', motion: 'pulse', caption: 'Winner' },
  { id: 'shades', motion: 'float', caption: 'Chill' },
  { id: 'blush', motion: 'pulse', caption: 'Aww' },
  { id: 'alien', motion: 'wiggle', caption: 'Brb' },
  { id: 'hourglass', motion: 'spin', caption: 'Waiting…' },
  { id: 'sparkle', motion: 'spin', caption: 'Yay' },
  { id: 'chat', motion: 'shake', caption: 'Call me' },
  { id: 'bunny', motion: 'bounce', caption: 'Hop on' },
  { id: 'nova', motion: 'pulse', caption: 'GM' },
];

/** Resolves once the emoji image has decoded (for exports that must include it). */
export async function loadNovaEmoji(id: NovaEmojiId): Promise<void> {
  novaEmojiImage(id);
  const img = imgs.get(id)!;
  if (img.complete && img.naturalWidth) return;
  await img.decode().catch(() => undefined);
}
