export type AuraColor = 'violet' | 'teal' | 'coral' | 'gold' | 'sky' | 'rose';
export type SceneId = 'dusk' | 'mural' | 'beach' | 'night';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  /** rendered full-body 3D avatar */
  avatar_body_url?: string | null;
  aura_color: AuraColor;
  /** backdrop behind the full-body avatar on the profile */
  profile_scene?: SceneId;
  /** rendered avatar face (kept even while a selfie is the picture) */
  avatar_face_url?: string | null;
  /** true while avatar_url is a selfie / gallery photo */
  photo_mode?: boolean;
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
  /** friends may see day + month of my birthday (never the year) */
  show_birthday?: boolean;
}

export const AURA: Record<AuraColor, { from: string; to: string; label: string }> = {
  violet: { from: '#8C6BFF', to: '#C9B6FF', label: 'Violet' },
  teal: { from: '#18C48C', to: '#A8F0D8', label: 'Mint' },
  coral: { from: '#FF5FA2', to: '#FFB3D6', label: 'Pink' },
  gold: { from: '#FFB020', to: '#FFE2A8', label: 'Sun' },
  sky: { from: '#3D7BFF', to: '#BCD3FF', label: 'Blue' },
  rose: { from: '#FF6B4D', to: '#FFCEBA', label: 'Peach' },
};
