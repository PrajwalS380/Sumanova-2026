import type { ConversationSummary, MessageKind } from './types';

const KIND_LABEL: Record<MessageKind, string> = {
  text: '',
  image: '📷 Photo',
  video: '🎬 Video',
  voice: '🎙️ Voice note',
  sticker: 'Sticker',
  system: '',
  snap: '✦ Snap',
};

/** One-line preview for the chat list. */
export function previewText(c: Pick<ConversationSummary, 'last_body' | 'last_kind' | 'last_deleted' | 'last_sender_id' | 'kind'>, me: string): string {
  if (!c.last_kind) return 'Say hi 👋';
  if (c.last_deleted) return 'Message deleted';
  const mine = c.last_sender_id === me;
  const text = c.last_kind === 'text' || c.last_kind === 'system' ? (c.last_body ?? '') : c.last_kind === 'sticker' ? `${c.last_body ?? ''} Sticker` : KIND_LABEL[c.last_kind];
  if (c.last_kind === 'system') return text;
  return mine ? `You: ${text}` : text;
}

export function conversationName(c: Pick<ConversationSummary, 'kind' | 'title' | 'other_display_name'>): string {
  return c.kind === 'group' ? (c.title ?? 'Group') : (c.other_display_name ?? 'Unknown');
}
