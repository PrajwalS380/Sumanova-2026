import { describe, expect, it } from 'vitest';
import { LANGS, t } from './i18n';

describe('i18n', () => {
  it('translates known strings in every language and falls back to English', () => {
    for (const l of LANGS) {
      expect(t('Chat', l.id)).toBeTruthy();
      if (l.id !== 'en') expect(t('Settings', l.id)).not.toBe('Settings');
    }
    expect(t('Not a real key', 'hi')).toBe('Not a real key');
    expect(t('Chat', 'en')).toBe('Chat');
  });
});
