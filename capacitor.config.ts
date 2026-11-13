import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sumanova.app',
  appName: 'SUMANOVA',
  webDir: 'dist',
  backgroundColor: '#070814',
  android: {
    // Ship web assets inside the APK (fast, works offline). No remote URL.
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#070814',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: '#070814',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#070814',
      overlaysWebView: false,
    },
  },
};

export default config;
