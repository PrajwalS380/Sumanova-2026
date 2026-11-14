/** Colour palettes for every colourable part. All original selections. */

/** 100 skin tones: 10 depth bands × 10 undertone/lightness steps. */
export const SKIN: string[] = (() => {
  const out: string[] = [];
  // [lightness, hue] pairs per band, warm→neutral→rosy within each band
  for (let band = 0; band < 10; band++) {
    const L = 84 - band * 6.6;
    for (let k = 0; k < 10; k++) {
      const hue = 22 + (k - 5) * 2.2 + (band > 6 ? 2 : 0);
      const sat = 48 + band * 1.6 + (k % 3) * 5 - (band > 7 ? 10 : 0);
      const l = L - k * 0.55;
      out.push(hsl(hue, sat, l));
    }
  }
  return out;
})();

export const HAIR = [
  '#0f0b0a', '#1c1412', '#2a1d16', '#3b2618', '#4e2f1f', '#5f3a24', '#74472a', '#8a5532', '#a0683a', '#b7834a',
  '#c99d5f', '#dab676', '#e8cf9a', '#f1e2bd', '#f6efe0', '#d9d4cc', '#a8a4a0', '#6e6a66', '#3d3b39',
  '#7a1f1f', '#9b2c3a', '#b5413a', '#c4572d', '#d9773a', '#e09a3f', '#e6bd3c',
  '#4a2a6e', '#6b3fa8', '#8f5fd1', '#c084b4', '#e05fa2', '#f08fb8', '#f5b3c8',
  '#1f3f8a', '#2f6fbf', '#4fa3d9', '#7cc4e8', '#1f8a8a', '#3fae8c', '#7cc49a', '#b9e6a5',
];

export const EYES = [
  '#2a170e', '#3b2414', '#4e2f1f', '#5a3a22', '#6e4528', '#7a5230', '#8f6a3c', '#a07a3e', '#5b6b2e', '#4c6b3c',
  '#3e7a52', '#2f6f5f', '#3f6f8f', '#4f86b0', '#6b8fb5', '#8ab0d0', '#5a6a7a', '#7a7a7a', '#9aa0a6', '#2a2a35',
  '#6b3fa8', '#9b5fc0', '#c0457a', '#d98a3a', '#e9c46a', '#c8e0f0',
];

export const BROWS = HAIR.slice(0, 19);

export const LIPS = [
  '#c98a80', '#b86b6b', '#c4776e', '#9f4f55', '#d2848a', '#8a4a4a', '#c95b7a', '#a33a4a', '#e07a6a', '#ff6b6b',
  '#d9364a', '#b0182a', '#7a1424', '#5c1530', '#8f2d56', '#c2577f', '#e8a0a8', '#f0b3b8', '#c08070', '#9a6050',
  '#6b3a2e', '#4a2420', '#e0663a', '#ff8a5c', '#b56aa6', '#7a4ea0', '#3a2a52', '#d4a373', '#f4c7a1', '#2a1a1a',
];

export const SHADOW = [
  '#f4e9da', '#e9c46a', '#d4a373', '#c08060', '#8a5532', '#5a3a2a', '#3a2620', '#1a1210', '#ff8a5c', '#ff6b6b',
  '#e05fa2', '#c2577f', '#b56aa6', '#7a4ea0', '#4a2a6e', '#2f6fbf', '#4fa3d9', '#3fae8c', '#7cc49a', '#9bbf5a',
  '#c8b07a', '#e8d8b0', '#a8a4a0', '#6e6a66', '#d9c27a', '#f0a8c8', '#ffd39a', '#c0457a', '#2a3a5a', '#e9e2d6',
];

export const BLUSH = ['#ff9a8a', '#ff8080', '#f08aa0', '#e07a8a', '#d9776a', '#c8645a', '#b85a6a', '#ffb0a0', '#f4a6a0', '#e8908a', '#d47070', '#c06070', '#ff9fc0', '#e8a0c8', '#c58aa0', '#a8606a', '#ffb38a', '#e89a6a', '#d08a6a', '#b0705a'];

/** Clothing colours: neutrals, earth, brights, pastels, darks. */
export const CLOTH = [
  '#f6f1ea', '#e9e2d6', '#d8cfc2', '#bfb4a6', '#9a8f84', '#6e655d', '#4a433d', '#2c2724', '#18151a', '#0c0a09',
  '#f4e3c8', '#e8cfa6', '#d4b483', '#b8925a', '#8f6a3c', '#6b4a2b', '#4a3020', '#7c4a2d', '#a0522d', '#c4572d',
  '#ff7a3d', '#ffb547', '#e9c46a', '#fde68a', '#d9e8a8', '#9bbf5a', '#4d7c46', '#2f5d3a', '#1f3d2a', '#3fae8c',
  '#5fc9a8', '#9fd9d0', '#2f7f9e', '#4fa3d9', '#7cc4e8', '#bfe3f2', '#1e3a8a', '#2563eb', '#1a2340', '#3a4a6a',
  '#7a4ea0', '#b56aa6', '#c084b4', '#f0b3d8', '#ffc0c8', '#ff6b6b', '#e5484d', '#b0182a', '#7a1424', '#5c1530',
];

export const METALS = { gold: '#e9c46a', silver: '#d6d9de', rose: '#e8a48a', black: '#1d1917' } as const;
export type Metal = keyof typeof METALS;

function hsl(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}
