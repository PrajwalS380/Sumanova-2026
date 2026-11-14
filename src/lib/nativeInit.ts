import { isNative, platform } from './platform';

/** One-time native shell setup: status bar, splash, Android back button. */
export async function initNative(navigateBack: () => boolean) {
  if (!isNative) return;
  const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
    import('@capacitor/app'),
  ]);
  document.documentElement.classList.add('native', `native-${platform}`);
  try {
    await StatusBar.setStyle({ style: Style.Light });
    if (platform === 'android') await StatusBar.setBackgroundColor({ color: '#F4F6FD' });
  } catch {
    /* older devices */
  }
  void SplashScreen.hide({ fadeOutDuration: 250 });
  void App.addListener('backButton', () => {
    // Go back inside the app; on the home (camera) screen, leave the app.
    if (!navigateBack()) void App.minimizeApp();
  });
}
