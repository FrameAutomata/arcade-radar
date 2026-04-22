export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ?? '',
};

export const hasSupabaseCredentials =
  env.supabaseUrl.length > 0 && env.supabaseKey.length > 0;
