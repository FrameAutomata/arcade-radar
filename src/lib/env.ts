export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '',
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '',
};

export const hasSupabaseCredentials =
  env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;

export const hasGoogleMapsApiKey = env.googleMapsApiKey.length > 0;
