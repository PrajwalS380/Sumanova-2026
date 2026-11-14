import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sumanova.app',
  appName: 'SUMANOVA',
  webDir: 'dist',
  backgroundColor: '#F4F6FD',
  android: {
    // Ship web assets inside the APK (fast, works offline). No remote URL.
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#F4F6FD',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#F4F6FD',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F4F6FD',
      overlaysWebView: false,
    },
  },
};

export default config;
