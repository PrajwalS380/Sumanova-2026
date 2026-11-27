import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isNative, platform } from './platform';

/**
 * Native "Privacy" plugin (Android): FLAG_SECURE blocks screenshots/recording
 * while sensitive content is on screen; on Android 14+ the system also reports
 * screenshot attempts. On the web there is no reliable screenshot signal, so
 * this is a no-op there (and the app never claims otherwise).
 */
interface PrivacyPlugin {
  setSecure(opts: { secure: boolean }): Promise<void>;
  watchScreenshots(opts: { on: boolean }): Promise<void>;
  addListener(event: 'screenshot', cb: () => void): Promise<PluginListenerHandle>;
}
const Privacy = registerPlugin<PrivacyPlugin>('Privacy');

// FLAG_SECURE holders: open snaps + the "block screenshots everywhere" setting.
let holds = 0;
const ALWAYS_KEY = 'snv-block-screens';
function always() {
  try {
    return localStorage.getItem(ALWAYS_KEY) === '1';
  } catch {
    return false;
  }
}
const sync = () => Privacy.setSecure({ secure: always() || holds > 0 }).catch(() => undefined);

export const screenProtection = {
  supported: isNative && platform === 'android',
  /** Settings → Privacy: block screenshots / recording of the whole app (and hide it in Recents). */
  get always() {
    return always();
  },
  async setAlways(on: boolean) {
    try {
      localStorage.setItem(ALWAYS_KEY, on ? '1' : '0');
    } catch {
      /* storage blocked */
    }
    if (this.supported) await sync();
  },
  /** Re-apply the setting on app start. */
  init() {
    if (this.supported && always()) void sync();
  },
  async enable(onScreenshot?: () => void): Promise<() => void> {
    if (!this.supported) return () => undefined;
    try {
      holds++;
      await Privacy.setSecure({ secure: true });
      const handle = onScreenshot ? await Privacy.addListener('screenshot', onScreenshot) : null;
      return () => {
        holds = Math.max(0, holds - 1);
        void sync();
        void handle?.remove();
      };
    } catch {
      return () => undefined;
    }
  },
};

/**
 * Chats: report screenshots (Android 14+ only) without blocking them, so the chat can show
 * "X took a screenshot". Older Android, iPhone and web give no reliable signal — nothing is shown there.
 */
export async function watchChatScreenshots(onScreenshot: () => void): Promise<() => void> {
  if (!screenProtection.supported) return () => undefined;
  try {
    await Privacy.watchScreenshots({ on: true });
    const handle = await Privacy.addListener('screenshot', onScreenshot);
    return () => {
      void Privacy.watchScreenshots({ on: false });
      void handle.remove();
    };
  } catch {
    return () => undefined;
  }
}
