import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sumanova.app',
  appName: 'SUMANOVA',
  webDir: 'dist',
  backgroundColor: '#ECECEF',
  android: {
    // Ship web assets inside the APK (fast, works offline). No remote URL.
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#ECECEF',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#FF4F9A',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#ECECEF',
      overlaysWebView: false,
    },
  },
};

export default config;
