import { describe, expect, it } from 'vitest';
import { isLive, tally, tileFor } from './extras';
import { NOVA_GIFS, novaStickerBody, parseNovaSticker } from '@/components/emoji/novaEmoji';

describe('chat extras', () => {
  it('tallies poll votes and finds mine', () => {
    const t = tally([{ message_id: 'm', user_id: 'a', option: 1 }, { message_id: 'm', user_id: 'b', option: 1 }, { message_id: 'm', user_id: 'me', option: 0 }], 3, 'me');
    expect(t).toEqual({ counts: [1, 2, 0], mine: 0, total: 3 });
  });
  it('places a location on the right map tile', () => {
    const { x, y } = tileFor(0, 0, 1);
    expect([x, y]).toEqual([1, 1]);
    const b = tileFor(12.9716, 77.5946, 16); // Bengaluru
    expect(Math.floor(b.x)).toBe(46893);
    expect(Math.floor(b.y)).toBe(30386); // standard slippy-map formula
  });
  it('knows when a live location has ended', () => {
    expect(isLive({ live_until: new Date(Date.now() + 60_000).toISOString() })).toBe(true);
    expect(isLive({ live_until: new Date(Date.now() - 1).toISOString() })).toBe(false);
    expect(isLive({})).toBe(false);
  });
  it('round-trips animated captioned stickers', () => {
    for (const g of NOVA_GIFS) expect(parseNovaSticker(novaStickerBody(g))).toEqual(g);
    expect(parseNovaSticker('nova:flame')).toEqual({ id: 'flame', motion: null, caption: null });
    expect(parseNovaSticker('nova:flame@explode')).toEqual({ id: 'flame', motion: null, caption: null });
    expect(parseNovaSticker('nova:nope@spin')).toBeNull();
  });
});
