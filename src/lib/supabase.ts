import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { env, hasSupabaseCredentials } from '@/lib/env';
import type { Database } from '@/types/database';

export const supabase = hasSupabaseCredentials
  ? createClient<Database>(env.supabaseUrl, env.supabaseKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage: AsyncStorage,
      },
    })
  : null;
