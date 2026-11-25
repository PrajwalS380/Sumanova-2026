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

export const screenProtection = {
  supported: isNative && platform === 'android',
  async enable(onScreenshot?: () => void): Promise<() => void> {
    if (!this.supported) return () => undefined;
    try {
      await Privacy.setSecure({ secure: true });
      const handle = onScreenshot ? await Privacy.addListener('screenshot', onScreenshot) : null;
      return () => {
        void Privacy.setSecure({ secure: false });
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
