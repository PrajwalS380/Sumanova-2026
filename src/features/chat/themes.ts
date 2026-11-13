import type { ChatTheme } from '@/lib/chat/types';

/** Bubble + wallpaper palettes. Original colourways — not borrowed from any app. */
export const CHAT_THEMES: Record<ChatTheme, { label: string; mine: string; wallpaper: string; accent: string }> = {
  aurora: { label: 'Aurora', mine: 'linear-gradient(135deg,#7c3aed,#0ea5a4)', wallpaper: 'radial-gradient(120% 80% at 0% 0%,rgba(139,92,246,.18),transparent 60%),radial-gradient(100% 70% at 100% 100%,rgba(45,212,191,.12),transparent 60%)', accent: '#a78bfa' },
  sunset: { label: 'Sunset', mine: 'linear-gradient(135deg,#f43f5e,#f59e0b)', wallpaper: 'radial-gradient(120% 80% at 100% 0%,rgba(251,113,133,.18),transparent 60%),radial-gradient(100% 70% at 0% 100%,rgba(251,191,36,.10),transparent 60%)', accent: '#fdba74' },
  ocean: { label: 'Ocean', mine: 'linear-gradient(135deg,#0284c7,#22d3ee)', wallpaper: 'radial-gradient(120% 80% at 0% 100%,rgba(56,189,248,.18),transparent 60%)', accent: '#7dd3fc' },
  forest: { label: 'Forest', mine: 'linear-gradient(135deg,#059669,#84cc16)', wallpaper: 'radial-gradient(120% 80% at 50% 0%,rgba(52,211,153,.14),transparent 60%)', accent: '#6ee7b7' },
  rose: { label: 'Rose', mine: 'linear-gradient(135deg,#db2777,#a855f7)', wallpaper: 'radial-gradient(120% 80% at 0% 0%,rgba(236,72,153,.16),transparent 60%)', accent: '#f9a8d4' },
  mono: { label: 'Mono', mine: 'linear-gradient(135deg,#3f3f46,#52525b)', wallpaper: 'none', accent: '#e4e4e7' },
};

export const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👍'] as const;

/** Built-in sticker pack (large emoji compositions — no third-party assets). */
export const STICKERS = ['🥳', '😎', '🤩', '🥹', '😴', '🤯', '💜', '✨', '🌈', '🔥', '🎉', '👀', '🙌', '💯', '🫶', '🌙', '⭐', '🍕', '☕', '🎧', '🚀', '🦋', '🐱', '🐶'];
