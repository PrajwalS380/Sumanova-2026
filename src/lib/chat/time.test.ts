import { describe, expect, it } from 'vitest';
import { dayLabel, formatDuration, lastSeenLabel, shortTime } from './time';
import { backoffDelay, mergeMessages } from './outbox';
import { previewText } from './preview';
import { downsample } from './media';
import type { LocalMessage } from './types';

const now = new Date('2026-11-13T12:00:00');
const ago = (s: number) => new Date(now.getTime() - s * 1000).toISOString();

describe('time helpers', () => {
  it('shortTime buckets', () => {
    expect(shortTime(ago(10), now)).toBe('now');
    expect(shortTime(ago(300), now)).toBe('5m');
    expect(shortTime(ago(3 * 3600), now)).toBe('3h');
  });
  it('dayLabel', () => {
    expect(dayLabel(ago(60), now)).toBe('Today');
    expect(dayLabel(ago(26 * 3600), now)).toBe('Yesterday');
  });
  it('lastSeen and durations', () => {
    expect(lastSeenLabel(ago(30), now)).toBe('Active just now');
    expect(lastSeenLabel(ago(7200), now)).toBe('Active 2h ago');
    expect(formatDuration(65.4)).toBe('1:05');
  });
});

describe('outbox', () => {
  it('backs off exponentially with a cap', () => {
    const fixed = () => 0.5;
    expect(backoffDelay(0, fixed)).toBe(1000);
    expect(backoffDelay(3, fixed)).toBe(8000);
    expect(backoffDelay(10, fixed)).toBe(30000);
  });
  it('dedupes by client_id with server winning and keeps order', () => {
    const base = { conversation_id: 'c', sender_id: 'u', kind: 'text', media_path: null, media_meta: {}, reply_to_id: null, forwarded: false, disappear_mode: 'never', expires_at: null, edited_at: null, deleted_at: null } as const;
    const local: LocalMessage[] = [
      { ...base, id: 'tmp1', client_id: 'a', body: 'hi', created_at: '2026-01-01T00:00:02Z', local: 'sending' },
      { ...base, id: 'tmp2', client_id: 'b', body: 'yo', created_at: '2026-01-01T00:00:03Z', local: 'failed' },
    ];
    const server: LocalMessage[] = [{ ...base, id: 'srv1', client_id: 'a', body: 'hi', created_at: '2026-01-01T00:00:01Z' }];
    const merged = mergeMessages(server, local);
    expect(merged.map((m) => m.id)).toEqual(['srv1', 'tmp2']);
    expect(merged[0].local).toBeUndefined();
  });
});

describe('previewText', () => {
  it('describes the last message', () => {
    expect(previewText({ kind: 'direct', last_body: 'hey', last_kind: 'text', last_deleted: false, last_sender_id: 'me' }, 'me')).toBe('You: hey');
    expect(previewText({ kind: 'direct', last_body: null, last_kind: 'image', last_deleted: false, last_sender_id: 'x' }, 'me')).toBe('📷 Photo');
    expect(previewText({ kind: 'direct', last_body: null, last_kind: null, last_deleted: null, last_sender_id: null }, 'me')).toBe('Say hi 👋');
    expect(previewText({ kind: 'direct', last_body: null, last_kind: 'text', last_deleted: true, last_sender_id: 'x' }, 'me')).toBe('Message deleted');
  });
});

describe('downsample', () => {
  it('produces fixed-length normalised bars', () => {
    const w = downsample([0, 0.2, 0.5, 1, 0.3, 0.1], 3);
    expect(w).toHaveLength(3);
    w.forEach((v) => expect(v).toBeGreaterThanOrEqual(0.08));
  });
});
