import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
import { firstLink, reminderChoices } from './more';

describe('firstLink', () => {
  it('finds the first web link and drops trailing punctuation', () => {
    expect(firstLink('look at https://example.com/a?b=1.')).toBe('https://example.com/a?b=1');
    expect(firstLink('(see http://x.org/page), ok')).toBe('http://x.org/page');
  });
  it('ignores plain text and encrypted bodies', () => {
    expect(firstLink('no links here')).toBeNull();
    expect(firstLink('e2e:https://example.com')).toBeNull();
    expect(firstLink(null)).toBeNull();
  });
});

describe('reminderChoices', () => {
  it('offers tonight only when it is still ahead', () => {
    const morning = reminderChoices(new Date(2026, 10, 27, 9, 0));
    expect(morning.map((c) => c.label)).toContain('Tonight, 8 PM');
    const late = reminderChoices(new Date(2026, 10, 27, 21, 0));
    expect(late.map((c) => c.label)).not.toContain('Tonight, 8 PM');
  });
  it('next Monday is always in the future, within 7 days', () => {
    const sun = new Date(2026, 10, 29, 10, 0); // a Sunday
    const mon = reminderChoices(sun).find((c) => c.label.startsWith('Next Monday'))!.at;
    expect(mon.getDay()).toBe(1);
    expect(mon.getTime() - sun.getTime()).toBeLessThan(7 * 864e5);
    expect(mon.getTime()).toBeGreaterThan(sun.getTime());
  });
});
