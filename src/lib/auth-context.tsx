import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { getAuthSessionSummary, signOutCurrentUser, type AuthSessionSummary } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface AuthContextValue {
  session: AuthSessionSummary | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSessionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadSession() {
    try {
      const next = await getAuthSessionSummary();
      setSession(next);
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSession();

    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      void loadSession();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await signOutCurrentUser();
    setSession(null);
  }

  return (
    <AuthContext.Provider value={{ isLoading, refresh: loadSession, session, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
