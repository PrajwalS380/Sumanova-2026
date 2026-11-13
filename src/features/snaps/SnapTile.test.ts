import { describe, expect, it } from 'vitest';
import { snapTileState } from './SnapTile';
import { FILTERS, filterById } from '@/lib/snaps/filters';
import type { SnapRecipient, SnapRow } from '@/lib/snaps/api';

const now = Date.parse('2026-11-13T12:00:00Z');
const row = (p: Partial<SnapRecipient>): SnapRecipient => ({ snap_id: 's', recipient_id: 'bob', conversation_id: 'c', status: 'sent', delivered_at: null, opened_at: null, replayed_at: null, screenshot_at: null, ...p });
const snap = { id: 's', allow_replay: true } as SnapRow;

describe('snapTileState', () => {
  it('recipient: unopened → replayable within 5 min → opened after', () => {
    expect(snapTileState(false, [row({ status: 'delivered' })], snap, 'bob', now).state).toBe('unopened');
    expect(snapTileState(false, [row({ status: 'opened', opened_at: new Date(now - 60_000).toISOString() })], snap, 'bob', now).state).toBe('replayable');
    expect(snapTileState(false, [row({ status: 'opened', opened_at: new Date(now - 10 * 60_000).toISOString() })], snap, 'bob', now).state).toBe('opened');
    expect(snapTileState(false, [row({ status: 'opened', opened_at: new Date(now).toISOString() })], { ...snap, allow_replay: false }, 'bob', now).state).toBe('opened');
  });
  it('sender sees the furthest status and screenshots', () => {
    expect(snapTileState(true, [row({ status: 'sent' })], snap, 'me', now).state).toBe('sent');
    expect(snapTileState(true, [row({ status: 'delivered' }), row({ recipient_id: 'x', status: 'sent' })], snap, 'me', now).state).toBe('delivered');
    const r = snapTileState(true, [row({ status: 'opened', screenshot_at: 'x' })], snap, 'me', now);
    expect(r).toEqual({ state: 'seen', screenshot: true });
  });
});

describe('filter registry', () => {
  it('has unique ids and falls back to Original', () => {
    expect(new Set(FILTERS.map((f) => f.id)).size).toBe(FILTERS.length);
    expect(filterById('does-not-exist').id).toBe('none');
    expect(filterById('noir').css).toContain('grayscale');
  });
});
