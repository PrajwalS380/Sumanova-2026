import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sumanova.app',
  appName: 'SUMANOVA',
  webDir: 'dist',
  backgroundColor: '#0c0a09',
  android: {
    // Ship web assets inside the APK (fast, works offline). No remote URL.
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#0c0a09',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#0c0a09',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0c0a09',
      overlaysWebView: false,
    },
  },
};

export default config;
