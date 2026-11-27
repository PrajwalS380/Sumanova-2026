import { useState } from 'react';
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
  return (
    <>
      <Segmented<ThemeMode>
        label="Appearance"
        value={theme}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'Phone' },
        ]}
        onChange={(v) => {
          setT(v);
          setTheme(v);
          void syncStatusBar(v);
        }}
      />
      <Segmented<TextSize>
        label="Text size"
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
        label="Data saver"
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
