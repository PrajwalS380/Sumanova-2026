/**
 * Chat wallpapers (this device): a built-in pattern or your own photo behind one chat.
 * Photos are shrunk to ≤1080 px JPEG and kept in Cache Storage on the phone — nothing uploaded.
 */
export interface Wallpaper { id: string; label: string; css: string; dark?: boolean }

export const WALLPAPERS: Wallpaper[] = [
  { id: 'none', label: 'None', css: 'none' },
  { id: 'dots', label: 'Dots', css: 'radial-gradient(rgb(var(--ink) / .09) 1.2px, transparent 1.6px) 0 0 / 18px 18px' },
  { id: 'grid', label: 'Grid', css: 'linear-gradient(rgb(var(--ink) / .06) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, rgb(var(--ink) / .06) 1px, transparent 1px) 0 0 / 22px 22px' },
  { id: 'waves', label: 'Waves', css: 'radial-gradient(circle at 100% 50%, transparent 20%, rgb(var(--ink) / .05) 21%, rgb(var(--ink) / .05) 34%, transparent 35%, transparent) 0 0 / 30px 30px, radial-gradient(circle at 0% 50%, transparent 20%, rgb(var(--ink) / .05) 21%, rgb(var(--ink) / .05) 34%, transparent 35%, transparent) 15px 15px / 30px 30px' },
  { id: 'sunrise', label: 'Sunrise', css: 'linear-gradient(170deg, #FFE1C7 0%, #FFC2D9 55%, #D9C9FF 100%)' },
  { id: 'lagoon', label: 'Lagoon', css: 'linear-gradient(165deg, #CFF5EA 0%, #BFE3FF 60%, #E2DAFF 100%)' },
  { id: 'night', label: 'Night', css: 'radial-gradient(1px 1px at 20% 30%, #fff8 50%, transparent), radial-gradient(1.5px 1.5px at 70% 60%, #fff9 50%, transparent), radial-gradient(1px 1px at 40% 80%, #fff6 50%, transparent), linear-gradient(170deg, #1B1F3B, #2C1E45)', dark: true },
  { id: 'mint', label: 'Mint', css: 'linear-gradient(160deg, #E4FBEF, #C9F0DC)' },
];

const KEY = (chat: string) => `snv-wall-${chat}`;
const CACHE = 'snv-wallpapers-v1';
const photoUrl = (chat: string) => `/__wallpaper/${chat}.jpg`;

export function getWallpaperId(chat: string): string {
  try {
    return localStorage.getItem(KEY(chat)) ?? 'none';
  } catch {
    return 'none';
  }
}
export function setWallpaperId(chat: string, id: string) {
  try {
    localStorage.setItem(KEY(chat), id);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('snv-wallpaper', { detail: chat }));
}

async function shrink(file: Blob, max = 1080): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Couldn’t read that photo'))), 'image/jpeg', 0.82));
}

export async function setWallpaperPhoto(chat: string, file: Blob) {
  const small = await shrink(file);
  const cache = await caches.open(CACHE);
  await cache.put(photoUrl(chat), new Response(small, { headers: { 'content-type': 'image/jpeg' } }));
  setWallpaperId(chat, 'photo');
}

/** CSS background for the chat, or null. Photo wallpapers resolve to an object URL. */
export async function wallpaperFor(chat: string): Promise<{ css: string; dark: boolean } | null> {
  const id = getWallpaperId(chat);
  if (id === 'photo') {
    try {
      const r = await (await caches.open(CACHE)).match(photoUrl(chat));
      if (!r) return null;
      const url = URL.createObjectURL(await r.blob());
      return { css: `center / cover no-repeat url(${url})`, dark: false };
    } catch {
      return null;
    }
  }
  const w = WALLPAPERS.find((x) => x.id === id);
  return w && w.id !== 'none' ? { css: w.css, dark: !!w.dark } : null;
}
