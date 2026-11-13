import type { AuraColor } from '@/lib/types';

export type MessageKind = 'text' | 'image' | 'video' | 'voice' | 'sticker' | 'system' | 'snap';
export type DisappearMode = 'never' | 'after_view' | '24h';
export type ChatTheme = 'aurora' | 'sunset' | 'ocean' | 'forest' | 'mono' | 'rose';

export interface MediaMeta {
  width?: number;
  height?: number;
  duration?: number;
  mime?: string;
  size?: number;
  waveform?: number[];
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  client_id: string;
  kind: MessageKind;
  body: string | null;
  media_path: string | null;
  media_meta: MediaMeta;
  reply_to_id: string | null;
  forwarded: boolean;
  disappear_mode: DisappearMode;
  expires_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

/** Client-side state for messages that haven't reached the server yet. */
export type SendStatus = 'sending' | 'failed';
export interface LocalMessage extends Message {
  local?: SendStatus;
  localBlob?: Blob;
  localUrl?: string;
}

export interface Reaction {
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface ConversationSummary {
  id: string;
  kind: 'direct' | 'group';
  title: string | null;
  avatar_url: string | null;
  disappear_mode: DisappearMode;
  last_message_at: string;
  pinned: boolean;
  muted: boolean;
  favourite: boolean;
  theme: ChatTheme;
  role: 'owner' | 'admin' | 'member';
  other_user_id: string | null;
  other_username: string | null;
  other_display_name: string | null;
  other_avatar_url: string | null;
  other_aura: AuraColor | null;
  member_count: number;
  unread_count: number;
  last_body: string | null;
  last_kind: MessageKind | null;
  last_sender_id: string | null;
  last_deleted: boolean | null;
  last_created_at: string | null;
}

export interface Member {
  conversation_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  last_read_at: string;
  last_delivered_at: string;
  joined_at: string;
}

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  aura_color: AuraColor;
}

export type Relation = 'friend' | 'outgoing' | 'incoming' | 'none';
export interface SearchResult extends PublicProfile {
  relation: Relation;
}

export interface Friend extends PublicProfile {
  since: string;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
}
