import { normalizeLook, SLOTS, type ColorKey, type Look, type Slot } from '../look/config';
import { BROWS as BROW_COLS, EYES, HAIR, LIPS, SKIN } from '../look/palettes';
import { PRESETS } from '../look/presets';
import { nearest, type FaceTraits, type RGB } from './analyze';

/** The 3D lighting brightens skin a little; match a touch darker so the avatar reads true to the photo. */
export const skinForAvatar = (c: RGB): RGB => [c[0] * 0.92, c[1] * 0.92, c[2] * 0.92];

/** Variant id by family name (clamped), so catalogue order changes can't break it. */
function id(slot: Slot, family: string, n = 0): number | null {
  const fam = (SLOTS[slot] as readonly { id: number; family: string }[]).filter((v) => v.family === family);
  return fam.length ? fam[Math.min(n, fam.length - 1)].id : null;
}

type HairPick = [string, number] | null;
/** Hairstyle options that fit what we saw (length + volume). */
function hairOptions(t: FaceTraits): HairPick[] {
  const big: HairPick[] = [['Afro', 2], ['Curly', 4], ['Locs', 2]];
  const byLen: Record<FaceTraits['hairLength'], HairPick[]> = {
    // 'none' usually means very short / cropped hair in a photo — lead with buzz cuts, keep a shaved option.
    none: [['Buzz', 2], ['Buzz', 0], ['Crew', 1], null, ['Textured crop', 2], ['Side part', 1]],
    short: [['Crew', 3], ['Textured crop', 2], ['Quiff', 2], ['Side part', 2], ['Undercut', 2], ['Buzz', 2]],
    medium: [['Curtains', 2], ['Bob', 1], ['Shag', 2], ['Lob', 2], ['Side part', 4], ['Curly', 3]],
    long: [['Long straight', 1], ['Long wavy', 3], ['Tied', 3], ['Braided', 2], ['Lob', 4], ['Shag', 3]],
  };
  const list = byLen[t.hairLength];
  return t.hairVolume && t.hairLength !== 'none' ? [...big.slice(0, 2), ...list].slice(0, 6) : list;
}

const OUTFIT_FROM = [0, 3, 5, 6, 10, 11]; // starter characters whose wardrobes we borrow
const WEAR: Slot[] = ['top', 'outer', 'bottom', 'dress', 'shoes', 'hat', 'glasses'];
const WEAR_COL: ColorKey[] = ['top', 'outer', 'bottom', 'dress', 'shoes', 'hat'];

/** Build six avatars that share the person's detected face, with different hair and outfits. */
export function looksFromTraits(t: FaceTraits): { name: string; look: Look }[] {
  const natHair = HAIR.slice(0, 19);
  const hairCol = natHair[nearest(t.hair, natHair, 0.8)];
  const browCol = t.hairLength === 'none' ? BROW_COLS[nearest(t.brows, BROW_COLS, 0.8)] : hairCol;
  const base = structuredClone(PRESETS[0].look);
  base.skin = SKIN[nearest(skinForAvatar(t.skin), SKIN, 0.9)];
  base.color.hair = hairCol;
  base.color.brows = browCol;
  base.color.beard = hairCol;
  base.color.hairTip = null;
  base.color.eyes = EYES.slice(0, 20)[nearest(t.eyes, EYES.slice(0, 20), 0.9)];
  base.color.lips = LIPS.slice(0, 10)[nearest(t.lips, LIPS.slice(0, 10), 0.9)];
  base.pick.head = id('head', t.faceShape, 2) ?? base.pick.head;
  base.pick.eyes = id('eyes', t.eyeShape, 2) ?? base.pick.eyes;
  base.pick.brows = id('brows', t.browThick ? 'Flat thick' : 'Soft arch', 2) ?? base.pick.brows;
  base.pick.nose = id('nose', t.noseWidth === 'wide' ? 'Wide' : t.noseWidth === 'narrow' ? 'Narrow' : 'Straight', 2) ?? base.pick.nose;
  base.pick.mouth = id('mouth', t.lips_ === 'full' ? 'Full' : t.lips_ === 'thin' ? 'Thin' : t.mouthWidth === 'wide' ? 'Wide' : t.mouthWidth === 'petite' ? 'Petite' : 'Balanced', 2) ?? base.pick.mouth;
  base.pick.beard = t.beard === 'beard' ? id('beard', 'Short beard', 6) : t.beard === 'stubble' ? id('beard', 'Stubble', 3) : t.beard === 'moustache' ? id('beard', 'Moustache', 2) : null;
  base.tune = { eyeSize: t.eyeSize, eyeGap: t.eyeGap, face: 0 };
  base.expression = 'happy';
  base.pose = 'standing';

  return hairOptions(t).map((h, i) => {
    const l = structuredClone(base);
    l.pick.hair = h ? id('hair', h[0], h[1]) : null;
    // Alternate subtle lashes so the set offers both looks; everything stays editable.
    l.pick.lashes = i % 2 === 1 ? id('lashes', 'Natural', 2) : null;
    const src = PRESETS[OUTFIT_FROM[i % OUTFIT_FROM.length]]?.look ?? PRESETS[0].look;
    for (const s of WEAR) l.pick[s] = src.pick[s] ?? null;
    for (const k of WEAR_COL) l.color[k] = src.color[k] ?? null;
    // Validate exactly like a saved avatar, so the result always loads in the studio.
    return { name: h ? h[0] : 'Shaved', look: normalizeLook(l) };
  });
}
