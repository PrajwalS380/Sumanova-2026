/** Original gradient backgrounds for text stories. */
export const STORY_BACKGROUNDS: Record<string, string> = {
  aurora: 'radial-gradient(130% 90% at 20% 0%,#ffcf8a 0%,#ff7a3d 40%,#a3283c 100%)',
  sunset: 'linear-gradient(170deg,#2b1530 0%,#c2577f 55%,#ffb38a 100%)',
  ocean: 'linear-gradient(170deg,#0f2a33 0%,#2f7f9e 55%,#bfe3f2 100%)',
  forest: 'linear-gradient(170deg,#14231a 0%,#4d7c46 60%,#d9e8a8 100%)',
  midnight: 'radial-gradient(120% 80% at 30% 20%,#3a2a22 0%,#0c0a09 70%)',
  candy: 'linear-gradient(140deg,#ffc0c8 0%,#f08aa8 50%,#b56aa6 100%)',
  ember: 'radial-gradient(120% 90% at 50% 100%,#ff8a3d 0%,#7a2418 60%,#140806 100%)',
  mint: 'linear-gradient(160deg,#f4e9da 0%,#e9c46a 55%,#9a6b2f 100%)',
};
export const bg = (k: string | null | undefined) => STORY_BACKGROUNDS[k ?? 'aurora'] ?? STORY_BACKGROUNDS.aurora;
