import { describe, expect, it } from 'vitest';
import { chatStatus } from './preview';

const base = { last_kind: 'text' as const, last_sender_id: 'them', last_deleted: false, unread_count: 0 };

describe('chatStatus', () => {
  it('labels new snaps and chats from friends', () => {
    expect(chatStatus({ ...base, last_kind: 'snap', unread_count: 1 }, 'me')).toEqual({ label: 'New snap', tone: 'snap' });
    expect(chatStatus({ ...base, unread_count: 3 }, 'me')).toEqual({ label: 'New chats', tone: 'chat' });
  });
  it('labels what I sent and what I already read', () => {
    expect(chatStatus({ ...base, last_sender_id: 'me' }, 'me')).toEqual({ label: 'Sent a chat', tone: 'sent' });
    expect(chatStatus({ ...base, last_kind: 'image', last_sender_id: 'me' }, 'me').label).toBe('Sent a photo');
    expect(chatStatus(base, 'me')).toEqual({ label: 'Received', tone: 'received' });
    expect(chatStatus({ ...base, last_kind: null as never }, 'me').tone).toBe('none');
  });
});
