import type { ChatTheme } from '@/lib/chat/types';

/** Bubble + wallpaper palettes. Original colourways — not borrowed from any app. */
export const CHAT_THEMES: Record<ChatTheme, { label: string; mine: string; wallpaper: string; accent: string; ink?: string }> = {
  aurora: { label: 'Ember', mine: 'linear-gradient(135deg,#ff9a45,#e5484d)', wallpaper: 'radial-gradient(120% 70% at 0% 0%,rgba(255,138,61,.14),transparent 60%),radial-gradient(100% 70% at 100% 100%,rgba(229,72,77,.10),transparent 60%)', accent: '#ffb547', ink: '#1a0f0a' },
  sunset: { label: 'Dusk', mine: 'linear-gradient(135deg,#c2577f,#7a4ea0)', wallpaper: 'radial-gradient(120% 80% at 100% 0%,rgba(194,87,127,.16),transparent 60%),radial-gradient(100% 70% at 0% 100%,rgba(122,78,160,.10),transparent 60%)', accent: '#f0a8c8' },
  ocean: { label: 'Tide', mine: 'linear-gradient(135deg,#2f7f9e,#4fb4a8)', wallpaper: 'radial-gradient(120% 80% at 0% 100%,rgba(79,180,168,.14),transparent 60%)', accent: '#9fd9d0' },
  forest: { label: 'Moss', mine: 'linear-gradient(135deg,#4d7c46,#9bbf5a)', wallpaper: 'radial-gradient(120% 80% at 50% 0%,rgba(155,191,90,.12),transparent 60%)', accent: '#c8e09a' },
  rose: { label: 'Rosewood', mine: 'linear-gradient(135deg,#a63a4f,#e07a6a)', wallpaper: 'radial-gradient(120% 80% at 0% 0%,rgba(224,122,106,.14),transparent 60%)', accent: '#ffb9a8' },
  mono: { label: 'Ink', mine: 'linear-gradient(135deg,#3a302a,#4a3f37)', wallpaper: 'none', accent: '#f4e9da' },
};

export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👍'] as const;

/** Built-in sticker pack (large emoji compositions — no third-party assets). */
export const STICKERS = ['🥳', '😎', '🤩', '🥹', '😴', '🤯', '🧡', '✨', '🌈', '🔥', '🎉', '👀', '🙌', '💯', '🫶', '🌙', '⭐', '🍕', '☕', '🎧', '🚀', '🦋', '🐱', '🐶'];
