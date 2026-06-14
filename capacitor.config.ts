import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.groupchallenge.app',
  appName: 'KlashBoard',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      showSpinner: false
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#1f2937'
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_klashboard',
      iconColor: '#6366F1'
    }
  }
};

export default config;
