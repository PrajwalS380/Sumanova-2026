import { describe, expect, it } from 'vitest';
import { ROOTS, TABS, TAB_PATHS, activeTab } from './nav';

describe('navigation', () => {
  it('has five tabs with the camera as home in the middle', () => {
    expect(TABS.map((t) => t.id)).toEqual(['map', 'chat', 'camera', 'stories', 'spotlight']);
    expect(TABS[2].to).toBe('/');
    expect(new Set(TAB_PATHS).size).toBe(5);
  });
  it('finds the active tab only on exact tab paths', () => {
    expect(activeTab('/')).toBe('camera');
    expect(activeTab('/chat')).toBe('chat');
    expect(activeTab('/chat/123')).toBeNull();
    expect(activeTab('/profile')).toBeNull();
  });
  it('root sections go back to the camera', () => {
    expect(ROOTS).toContain('/chat');
    expect(ROOTS).not.toContain('/');
  });
});
