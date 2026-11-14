import type { ChatTheme } from '@/lib/chat/types';

/** Bubble + wallpaper palettes. Original colourways — not borrowed from any app. */
export const CHAT_THEMES: Record<ChatTheme, { label: string; mine: string; wallpaper: string; accent: string; ink?: string }> = {
  aurora: { label: 'Pearl', mine: 'linear-gradient(135deg,#6E7BFF,#8E5BEA)', wallpaper: 'radial-gradient(120% 70% at 0% 0%,rgba(159,184,255,.35),transparent 60%),radial-gradient(100% 70% at 100% 100%,rgba(255,179,217,.3),transparent 60%)', accent: '#3D4FE0' },
  sunset: { label: 'Blush', mine: 'linear-gradient(135deg,#E5487F,#B44AA8)', wallpaper: 'radial-gradient(120% 80% at 100% 0%,rgba(255,179,217,.4),transparent 60%),radial-gradient(100% 70% at 0% 100%,rgba(201,182,255,.3),transparent 60%)', accent: '#C2367A' },
  ocean: { label: 'Lagoon', mine: 'linear-gradient(135deg,#2F7FC2,#0E8C7D)', wallpaper: 'radial-gradient(120% 80% at 0% 100%,rgba(168,240,220,.45),transparent 60%)', accent: '#1F6FAE' },
  forest: { label: 'Mint', mine: 'linear-gradient(135deg,#11936F,#4BAE5E)', wallpaper: 'radial-gradient(120% 80% at 50% 0%,rgba(168,240,220,.4),transparent 60%)', accent: '#0E7F60' },
  rose: { label: 'Peach', mine: 'linear-gradient(135deg,#F06A5A,#E5487F)', wallpaper: 'radial-gradient(120% 80% at 0% 0%,rgba(255,206,186,.5),transparent 60%)', accent: '#D14B4B' },
  mono: { label: 'Navy', mine: 'linear-gradient(135deg,#2A3658,#1E2A4A)', wallpaper: 'none', accent: '#1E2A4A' },
};

export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👍'] as const;

/** Built-in sticker pack (large emoji compositions — no third-party assets). */
export const STICKERS = ['🥳', '😎', '🤩', '🥹', '😴', '🤯', '🧡', '✨', '🌈', '🔥', '🎉', '👀', '🙌', '💯', '🫶', '🌙', '⭐', '🍕', '☕', '🎧', '🚀', '🦋', '🐱', '🐶'];
