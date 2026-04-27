import { env, hasSupabaseCredentials } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type { Database, UserRole } from '@/types/database';

type UserRoleRow = Database['public']['Tables']['user_roles']['Row'];

export interface AuthSessionSummary {
  email: string | null;
  role: UserRole | null;
  userId: string;
}

export async function getAuthSessionSummary(): Promise<AuthSessionSummary | null> {
  if (!hasSupabaseCredentials || !supabase) {
    return null;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const user = userData.user;

  if (!user) {
    return null;
  }

  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleError) {
    throw roleError;
  }

  const roleRow = roleData as Pick<UserRoleRow, 'role'> | null;

  return {
    email: user.email ?? null,
    role: roleRow?.role ?? null,
    userId: user.id,
  };
}

export async function signInWithPassword(email: string, password: string) {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for authentication.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signUpWithPassword(email: string, password: string) {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for authentication.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: env.authRedirectUrl,
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOutCurrentUser() {
  if (!hasSupabaseCredentials || !supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
