/** Original gradient backgrounds for text stories. */
export const STORY_BACKGROUNDS: Record<string, string> = {
  aurora: 'linear-gradient(160deg,#7c3aed 0%,#0ea5a4 55%,#fb7185 100%)',
  sunset: 'linear-gradient(170deg,#f43f5e 0%,#f59e0b 100%)',
  ocean: 'linear-gradient(170deg,#0c4a6e 0%,#0ea5e9 60%,#a5f3fc 100%)',
  forest: 'linear-gradient(170deg,#064e3b 0%,#10b981 100%)',
  midnight: 'radial-gradient(120% 80% at 30% 20%,#312e81 0%,#070814 70%)',
  candy: 'linear-gradient(140deg,#ec4899 0%,#a855f7 50%,#6366f1 100%)',
  ember: 'radial-gradient(120% 90% at 50% 100%,#f97316 0%,#7c2d12 60%,#1c0a05 100%)',
  mint: 'linear-gradient(160deg,#a7f3d0 0%,#5eead4 50%,#0f766e 100%)',
};
export const bg = (k: string | null | undefined) => STORY_BACKGROUNDS[k ?? 'aurora'] ?? STORY_BACKGROUNDS.aurora;
