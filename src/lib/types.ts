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
  violet: { from: '#b56aa6', to: '#f0b3d8', label: 'Orchid' },
  teal: { from: '#3fae8c', to: '#b9e6a5', label: 'Sage' },
  coral: { from: '#e5484d', to: '#ffb38a', label: 'Coral' },
  gold: { from: '#ff9a3d', to: '#ffe1a0', label: 'Amber' },
  sky: { from: '#4b8fc2', to: '#bfe3f2', label: 'Dusk' },
  rose: { from: '#d6456e', to: '#ffc0c8', label: 'Rose' },
};
