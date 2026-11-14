import { describe, expect, it } from 'vitest';
import { ROOTS, SECTIONS, isActive } from './nav';

describe('navigation', () => {
  it('lists every section once, home first', () => {
    expect(SECTIONS[0].to).toBe('/');
    expect(new Set(SECTIONS.map((s) => s.to)).size).toBe(SECTIONS.length);
    for (const p of ['/chat', '/stories', '/spotlight', '/map', '/memories', '/camera', '/settings']) expect(SECTIONS.some((s) => s.to === p)).toBe(true);
  });
  it('marks the active section, including nested screens', () => {
    const chats = SECTIONS.find((s) => s.to === '/chat')!;
    const home = SECTIONS[0];
    expect(isActive(chats, '/chat')).toBe(true);
    expect(isActive(chats, '/chat/123')).toBe(true);
    expect(isActive(chats, '/chatter')).toBe(false);
    expect(isActive(home, '/')).toBe(true);
    expect(isActive(home, '/chat')).toBe(false);
  });
  it('root sections go back to the dashboard', () => {
    expect(ROOTS).toContain('/chat');
    expect(ROOTS).not.toContain('/');
  });
});
