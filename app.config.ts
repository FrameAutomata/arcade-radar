import type { ExpoConfig } from 'expo/config';

const appName = 'Arcade Aggregator';
const slug = 'arcade-aggregator';
const bundleId = 'com.arcadeaggregator.mobile';
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

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
    config: {
      googleMapsApiKey: googleMapsApiKey || undefined,
    },
  },
  android: {
    package: bundleId,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0b1220',
    },
    config: {
      googleMaps: {
        apiKey: googleMapsApiKey || undefined,
      },
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Arcade Aggregator uses your location to find the closest arcades carrying the game you want.',
      },
    ],
  ],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    googleMapsApiKey,
  },
};

export default config;
