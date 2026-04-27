import type { ExpoConfig } from 'expo/config';

const appName = 'Arcade Radar';
const slug = 'arcade-radar';
const bundleId = 'com.arcaderadar.mobile';

const config: ExpoConfig = {
  name: appName,
  slug,
  scheme: slug,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  experiments: {
    typedRoutes: true,
  },
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0b1220',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: bundleId,
  },
  android: {
    package: bundleId,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0b1220',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    '@maplibre/maplibre-react-native',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Arcade Radar uses your location to find the closest arcades carrying the game you want.',
      },
    ],
  ],
  extra: {
    eas: {
      projectId: 'd6de6c1c-452f-4c84-b254-3f84de5094cc',
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '',
    authRedirectUrl:
      process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ??
      'https://arcade-radar--demo.expo.app/',
  },
};

export default config;
