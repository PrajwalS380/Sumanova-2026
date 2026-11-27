import { useState } from 'react';
import { LANGS, getLang, setLang, useT, type Lang } from '@/lib/i18n';
import { Segmented } from '@/components/ui/Segmented';
import { Toggle } from '@/components/ui/Toggle';
import { getDataSaver, getTextSize, getTheme, isDark, setDataSaver, setTextSize, setTheme, type TextSize, type ThemeMode } from '@/lib/display';
import { isNative, platform } from '@/lib/platform';

async function syncStatusBar(mode: ThemeMode) {
  if (!isNative) return;
  const { StatusBar, Style } = await import('@capacitor/status-bar');
  const dark = isDark(mode);
  await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
  if (platform === 'android') {
    const c = getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim().split(/\s+/).map(Number);
    const hex = '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
    await StatusBar.setBackgroundColor({ color: hex }).catch(() => undefined);
  }
}

/** Appearance (light / dark / system), text size and data saver — stored per device. */
export function DisplayRows() {
  const [theme, setT] = useState<ThemeMode>(getTheme);
  const [size, setS] = useState<TextSize>(getTextSize);
  const [saver, setSaver] = useState(getDataSaver);
  const tr = useT();
  const [lang, setL] = useState<Lang>(getLang);
  return (
    <>
      <div className="px-4 py-3">
        <p className="eyebrow mb-2">{tr('Language')}</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Language">
          {LANGS.map((l) => (
            <button key={l.id} role="radio" aria-checked={lang === l.id} onClick={() => { setL(l.id); setLang(l.id); }} className={lang === l.id ? 'rounded-xl bg-ink px-3.5 py-2 text-sm font-extrabold text-white' : 'rounded-xl bg-ink/[0.05] px-3.5 py-2 text-sm font-bold'}>{l.label}</button>
          ))}
        </div>
        {lang !== 'en' && <p className="mt-1.5 text-xs text-ink-mute">Menus, titles and Settings are translated; other screens are being added and show in English for now.</p>}
      </div>
      <Segmented<ThemeMode>
        label={tr('Appearance')}
        value={theme}
        options={[
          { value: 'light', label: tr('Light') },
          { value: 'dark', label: tr('Dark') },
          { value: 'system', label: tr('Phone') },
        ]}
        onChange={(v) => {
          setT(v);
          setTheme(v);
          void syncStatusBar(v);
        }}
      />
      <Segmented<TextSize>
        label={tr('Text size')}
        value={size}
        options={[
          { value: 'small', label: 'A−' },
          { value: 'normal', label: 'A' },
          { value: 'large', label: 'A+' },
          { value: 'xl', label: 'A++' },
        ]}
        onChange={(v) => {
          setS(v);
          setTextSize(v);
        }}
      />
      <Toggle
        label={tr('Data saver')}
        description="On mobile data: smaller pictures, no video autoplay, no preloading"
        checked={saver}
        onChange={(v) => {
          setSaver(v);
          setDataSaver(v);
        }}
      />
    </>
  );
}
