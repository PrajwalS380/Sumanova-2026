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
  interests?: string[];
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
  violet: { from: '#8E5BEA', to: '#C9B6FF', label: 'Lilac' },
  teal: { from: '#0E8C7D', to: '#A8F0DC', label: 'Mint' },
  coral: { from: '#E5487F', to: '#FFB3D9', label: 'Blush' },
  gold: { from: '#3D4FE0', to: '#9FB8FF', label: 'Indigo' },
  sky: { from: '#2F7FC2', to: '#BFE3F2', label: 'Sky' },
  rose: { from: '#D14B4B', to: '#FFCEBA', label: 'Peach' },
};
