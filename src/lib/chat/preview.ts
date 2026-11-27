import type { ConversationSummary, MessageKind } from './types';

const KIND_LABEL: Record<MessageKind, string> = {
  text: '',
  image: '📷 Photo',
  video: '🎬 Video',
  voice: '🎙️ Voice note',
  sticker: 'Sticker',
  system: '',
  snap: '✦ New snap',
  poll: 'Poll',
  location: 'Location',
  hangout: 'Hangout',
  game: 'Game',
  todo: 'To-do list',
  puzzle: 'Puzzle',
};

/** One-line preview for the chat list. */
export function previewText(c: Pick<ConversationSummary, 'last_body' | 'last_kind' | 'last_deleted' | 'last_sender_id' | 'kind'>, me: string): string {
  if (!c.last_kind) return 'Say hi 👋';
  if (c.last_deleted) return 'Message deleted';
  const mine = c.last_sender_id === me;
  const text = (c.last_kind === 'text' && !c.last_body?.startsWith('e2e:')) || c.last_kind === 'system' ? (c.last_body ?? '') : c.last_kind === 'sticker' ? (c.last_body?.startsWith('nova:') ? 'Sticker' : `${c.last_body ?? ''} Sticker`) : c.last_kind === 'text' && c.last_body?.startsWith('e2e:') ? 'Encrypted message' : c.last_kind === 'hangout' ? `Hangout: ${c.last_body ?? ''}` : c.last_kind === 'game' ? `Game: ${c.last_body ?? ''}` : c.last_kind === 'poll' ? `Poll: ${c.last_body ?? ''}` : c.last_kind === 'todo' ? `To-do: ${c.last_body ?? ''}` : c.last_kind === 'puzzle' ? `🧩 ${c.last_body ?? 'Puzzle'}` : c.last_kind === 'location' ? (c.last_body ?? 'Location') : KIND_LABEL[c.last_kind];
  if (c.last_kind === 'system') return text;
  return mine ? `You: ${text}` : text;
}

export function conversationName(c: Pick<ConversationSummary, 'kind' | 'title' | 'other_display_name'>): string {
  return c.kind === 'group' ? (c.title ?? 'Group') : (c.other_display_name ?? 'Unknown');
}

export type ChatStatusTone = 'snap' | 'chat' | 'sent' | 'received' | 'none';

/**
 * Status line for a chat row: what happened last, as a short label plus a tone
 * (filled indigo square = new snap, filled teal = new chat, outlined = sent,
 * grey outline = received).
 */
export function chatStatus(c: Pick<ConversationSummary, 'last_kind' | 'last_sender_id' | 'last_deleted' | 'unread_count'>, me: string): { label: string; tone: ChatStatusTone } {
  if (!c.last_kind) return { label: 'Tap to chat', tone: 'none' };
  if (c.last_kind === 'system') return { label: 'Group update', tone: 'none' };
  const media = c.last_kind === 'snap' || c.last_kind === 'image' || c.last_kind === 'video';
  const what = c.last_kind === 'snap' ? 'snap' : c.last_kind === 'image' ? 'photo' : c.last_kind === 'video' ? 'video' : c.last_kind === 'voice' ? 'voice note' : 'chat';
  if (c.last_sender_id === me) return { label: c.last_deleted ? 'Deleted' : `Sent ${what === 'chat' ? 'a chat' : `a ${what}`}`, tone: 'sent' };
  if (c.unread_count > 0) return { label: `New ${what}${c.unread_count > 1 ? 's' : ''}`, tone: media ? 'snap' : 'chat' };
  return { label: 'Received', tone: 'received' };
}
