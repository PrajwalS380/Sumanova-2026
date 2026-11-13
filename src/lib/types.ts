export type AuraColor = 'violet' | 'teal' | 'coral' | 'gold' | 'sky' | 'rose';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  aura_color: AuraColor;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  user_id: string;
  date_of_birth: string | null;
  reduce_motion: boolean;
  haptics: boolean;
  default_snap_seconds: number;
  chat_wallpaper: string;
}

export type Audience = 'everyone' | 'friends';
export interface PrivacySettings {
  user_id: string;
  who_can_message: Audience;
  who_can_call: Audience | 'nobody';
  who_can_view_story: Audience | 'custom';
  show_last_seen: boolean;
  show_in_discovery: boolean;
  ghost_mode: boolean;
}

export const AURA: Record<AuraColor, { from: string; to: string; label: string }> = {
  violet: { from: '#8b5cf6', to: '#c084fc', label: 'Violet' },
  teal: { from: '#14b8a6', to: '#5eead4', label: 'Teal' },
  coral: { from: '#f43f5e', to: '#fdba74', label: 'Coral' },
  gold: { from: '#f59e0b', to: '#fde68a', label: 'Gold' },
  sky: { from: '#0ea5e9', to: '#a5f3fc', label: 'Sky' },
  rose: { from: '#ec4899', to: '#f9a8d4', label: 'Rose' },
};
