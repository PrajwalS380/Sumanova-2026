import type { LucideIcon } from 'lucide-react';
import { Baby, Brush, CircleDot, Crown, Ear, Eye, Footprints, Glasses, Gem, HardHat, Laugh, PersonStanding, Palette, Scissors, Shirt, ShoppingBag, Smile, Sparkles, Flower2, Wind, Drama, Hand, Ruler, Droplet, Ribbon, Snowflake } from 'lucide-react';
import type { ColorKey, Slot } from '../look/config';
import type { ThumbFrame } from './thumbs';
import { SKIN, HAIR, EYES, BROWS, LIPS, SHADOW, BLUSH, CLOTH } from '../look/palettes';

export type Mode = 'style' | 'face' | 'saved';

export interface Category {
  id: string;
  mode: Mode;
  label: string;
  icon: LucideIcon;
  /** variant slot shown as a grid */
  slot?: Slot;
  /** colour rail beside the avatar */
  color?: { key: ColorKey; palette: string[]; allowNone?: boolean; label?: string };
  /** a second colour (e.g. ombré tips) */
  color2?: { key: ColorKey; palette: string[]; allowNone?: boolean; label?: string };
  /** grid of colours instead of variants */
  swatches?: { key: ColorKey | 'skin'; palette: string[]; allowNone?: boolean };
  sliders?: { key: 'eyeSize' | 'eyeGap' | 'face'; label: string }[];
  thumb: ThumbFrame;
  stage: 'full' | 'head' | 'upper' | 'feet';
  special?: 'expression' | 'pose';
}

export const CATEGORIES: Category[] = [
  // ---------------- Style
  { id: 'top', mode: 'style', label: 'Tops', icon: Shirt, slot: 'top', color: { key: 'top', palette: CLOTH, allowNone: true }, thumb: 'upper', stage: 'upper' },
  { id: 'outer', mode: 'style', label: 'Jackets', icon: Snowflake, slot: 'outer', color: { key: 'outer', palette: CLOTH, allowNone: true }, thumb: 'upper', stage: 'upper' },
  { id: 'bottom', mode: 'style', label: 'Bottoms', icon: Ruler, slot: 'bottom', color: { key: 'bottom', palette: CLOTH, allowNone: true }, thumb: 'lower', stage: 'full' },
  { id: 'dress', mode: 'style', label: 'Dresses', icon: Flower2, slot: 'dress', color: { key: 'dress', palette: CLOTH, allowNone: true }, thumb: 'full', stage: 'full' },
  { id: 'shoes', mode: 'style', label: 'Shoes', icon: Footprints, slot: 'shoes', color: { key: 'shoes', palette: CLOTH, allowNone: true }, thumb: 'feet', stage: 'feet' },
  { id: 'socks', mode: 'style', label: 'Socks', icon: Wind, slot: 'socks', color: { key: 'socks', palette: CLOTH, allowNone: true }, thumb: 'feet', stage: 'feet' },
  { id: 'bag', mode: 'style', label: 'Bags', icon: ShoppingBag, slot: 'bag', color: { key: 'bag', palette: CLOTH, allowNone: true }, thumb: 'full', stage: 'full' },
  { id: 'hat', mode: 'style', label: 'Hats', icon: HardHat, slot: 'hat', color: { key: 'hat', palette: CLOTH, allowNone: true }, thumb: 'head', stage: 'head' },
  { id: 'glasses', mode: 'style', label: 'Eyewear', icon: Glasses, slot: 'glasses', thumb: 'head', stage: 'head' },
  { id: 'shadow', mode: 'style', label: 'Eyeshadow', icon: Brush, swatches: { key: 'shadow', palette: SHADOW, allowNone: true }, thumb: 'face', stage: 'head' },
  { id: 'blush', mode: 'style', label: 'Blush', icon: Palette, swatches: { key: 'blush', palette: BLUSH, allowNone: true }, thumb: 'face', stage: 'head' },
  { id: 'lipstick', mode: 'style', label: 'Lips', icon: Droplet, swatches: { key: 'lips', palette: LIPS, allowNone: true }, thumb: 'face', stage: 'head' },

  // ---------------- Face & body
  { id: 'hair', mode: 'face', label: 'Hair', icon: Scissors, slot: 'hair', color: { key: 'hair', palette: HAIR }, color2: { key: 'hairTip', palette: HAIR, allowNone: true, label: 'Tips' }, thumb: 'head', stage: 'head' },
  { id: 'skin', mode: 'face', label: 'Skin', icon: Hand, swatches: { key: 'skin', palette: SKIN }, thumb: 'head', stage: 'head' },
  { id: 'head', mode: 'face', label: 'Face', icon: Smile, slot: 'head', sliders: [{ key: 'face', label: 'Face size' }], thumb: 'head', stage: 'head' },
  { id: 'eyes', mode: 'face', label: 'Eyes', icon: Eye, slot: 'eyes', color: { key: 'eyes', palette: EYES }, sliders: [{ key: 'eyeSize', label: 'Eye size' }, { key: 'eyeGap', label: 'Eye spacing' }], thumb: 'face', stage: 'head' },
  { id: 'lashes', mode: 'face', label: 'Lashes', icon: Sparkles, slot: 'lashes', color: { key: 'liner', palette: ['#1a1110', '#3a2620', '#5a3a2a', '#1f3f8a', '#4a2a6e', '#2f5d3a', '#7a1424'], allowNone: true, label: 'Liner' }, thumb: 'face', stage: 'head' },
  { id: 'brows', mode: 'face', label: 'Brows', icon: Wind, slot: 'brows', color: { key: 'brows', palette: BROWS }, thumb: 'face', stage: 'head' },
  { id: 'nose', mode: 'face', label: 'Nose', icon: CircleDot, slot: 'nose', thumb: 'face', stage: 'head' },
  { id: 'mouth', mode: 'face', label: 'Mouth', icon: Laugh, slot: 'mouth', color: { key: 'lips', palette: LIPS, allowNone: true }, thumb: 'face', stage: 'head' },
  { id: 'ears', mode: 'face', label: 'Ears', icon: Ear, slot: 'ears', thumb: 'head', stage: 'head' },
  { id: 'beard', mode: 'face', label: 'Facial hair', icon: Baby, slot: 'beard', color: { key: 'beard', palette: HAIR }, thumb: 'head', stage: 'head' },
  { id: 'earL', mode: 'face', label: 'Left ear', icon: Gem, slot: 'earL', thumb: 'head', stage: 'head' },
  { id: 'earR', mode: 'face', label: 'Right ear', icon: Gem, slot: 'earR', thumb: 'head', stage: 'head' },
  { id: 'nosePierce', mode: 'face', label: 'Nose jewel', icon: Gem, slot: 'nosePierce', thumb: 'face', stage: 'head' },
  { id: 'browPierce', mode: 'face', label: 'Brow jewel', icon: Gem, slot: 'browPierce', thumb: 'face', stage: 'head' },
  { id: 'lipPierce', mode: 'face', label: 'Lip jewel', icon: Gem, slot: 'lipPierce', thumb: 'face', stage: 'head' },
  { id: 'tonguePierce', mode: 'face', label: 'Tongue jewel', icon: Gem, slot: 'tonguePierce', thumb: 'face', stage: 'head' },
  { id: 'hearingL', mode: 'face', label: 'Hearing L', icon: Ear, slot: 'hearingL', thumb: 'head', stage: 'head' },
  { id: 'hearingR', mode: 'face', label: 'Hearing R', icon: Ear, slot: 'hearingR', thumb: 'head', stage: 'head' },
  { id: 'headExtra', mode: 'face', label: 'Head add-ons', icon: Crown, slot: 'headExtra', thumb: 'head', stage: 'head' },
  { id: 'body', mode: 'face', label: 'Body', icon: PersonStanding, slot: 'body', thumb: 'full', stage: 'full' },
  { id: 'expression', mode: 'face', label: 'Mood', icon: Drama, special: 'expression', thumb: 'face', stage: 'head' },
  { id: 'pose', mode: 'face', label: 'Pose', icon: Ribbon, special: 'pose', thumb: 'full', stage: 'full' },
];

export const EXPRESSIONS = [
  ['happy', '😊', 'Happy'], ['laughing', '😂', 'Laughing'], ['neutral', '😐', 'Calm'], ['winking', '😉', 'Wink'], ['blushing', '☺️', 'Blush'],
  ['surprised', '😮', 'Wow'], ['sad', '😢', 'Sad'], ['crying', '😭', 'Crying'], ['angry', '😠', 'Angry'], ['sleeping', '😴', 'Sleepy'], ['tongue', '😛', 'Cheeky'],
] as const;
export const POSES = [
  ['standing', '🧍', 'Stand'], ['waving', '👋', 'Wave'], ['celebrating', '🙌', 'Cheer'], ['thumbsup', '👍', 'Thumbs up'], ['dancing', '💃', 'Dance'], ['walking', '🚶', 'Walk'], ['sitting', '🪑', 'Sit'],
] as const;
