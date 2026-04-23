import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import {
  getAuthSessionSummary,
  signInWithPassword,
  signOutCurrentUser,
  type AuthSessionSummary,
} from '@/lib/auth';
import { hasSupabaseCredentials } from '@/lib/env';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState<AuthSessionSummary | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setStatusMessage(null);

      try {
        const nextSession = await getAuthSessionSummary();

        if (!cancelled) {
          setSession(nextSession);
          setEmail(nextSession?.email ?? '');
        }
      } catch {
        if (!cancelled) {
          setStatusMessage(
            'Could not read the current auth session. Confirm your Supabase auth settings are ready.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSession(false);
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setStatusMessage('Enter both your email and password to sign in.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await signInWithPassword(email, password);
      const nextSession = await getAuthSessionSummary();
      setSession(nextSession);
      setPassword('');
      setStatusMessage(
        nextSession?.role
          ? `Signed in as ${nextSession.email} (${nextSession.role}).`
          : `Signed in as ${nextSession?.email ?? email.trim()}, but no scout/admin role is assigned yet.`,
      );
    } catch {
      setStatusMessage(
        'Sign-in failed. Double-check your email, password, and Supabase auth user setup.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await signOutCurrentUser();
      setSession(null);
      setPassword('');
      setStatusMessage('Signed out.');
    } catch {
      setStatusMessage('Could not sign out right now.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.marqueeRow}>
          <View style={styles.marqueePill}>
            <Text style={styles.marqueeText}>Auth</Text>
          </View>
          <View style={[styles.marqueePill, styles.marqueePillSecondary]}>
            <Text style={styles.marqueeText}>Scout and admin access</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.eyebrow}>Supabase session</Text>
          <Text style={styles.title}>Sign in to unlock Scout Mode write access.</Text>
          <Text style={styles.description}>
            Use the same Supabase auth user that you assigned in `public.user_roles`.
            Once signed in, Scout Mode can submit reports and, if your role is `admin`,
            review queue actions can be enabled later.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Current session</Text>

          {isLoadingSession ? (
            <Text style={styles.helperText}>Checking your current auth session...</Text>
          ) : session ? (
            <View style={styles.sessionCard}>
              <Text style={styles.sessionValue}>{session.email ?? 'Signed-in user'}</Text>
              <Text style={styles.sessionMeta}>Role: {session.role ?? 'none assigned'}</Text>
              <Text style={styles.sessionMeta}>User ID: {session.userId}</Text>
            </View>
          ) : (
            <Text style={styles.helperText}>
              No user session is active yet. Sign in below with your Supabase auth account.
            </Text>
          )}

          {!hasSupabaseCredentials ? (
            <Text style={styles.warningText}>
              Supabase env vars are missing, so in-app auth cannot start yet.
            </Text>
          ) : null}

          {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
        </View>

        <View style={styles.panel}>
          {session ? (
            <>
              <Text style={styles.sectionTitle}>Signed in</Text>
              <Text style={styles.helperText}>
                This device is already using your current Supabase session. You can
                sign out below whenever you want to switch accounts.
              </Text>
              <Pressable
                disabled={isSubmitting}
                onPress={() => void handleSignOut()}
                style={[styles.secondaryButton, isSubmitting && styles.buttonMuted]}
              >
                <Text style={styles.secondaryButtonText}>
                  {isSubmitting ? 'Working...' : 'Sign out'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Email and password</Text>

              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={email}
              />

              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry
                style={styles.input}
                value={password}
              />

              <Pressable
                disabled={isSubmitting || !hasSupabaseCredentials}
                onPress={() => void handleSignIn()}
                style={[styles.primaryButton, (isSubmitting || !hasSupabaseCredentials) && styles.buttonMuted]}
              >
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? 'Working...' : 'Sign in'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  content: {
    gap: theme.spacing.lg,
    padding: theme.spacing.md,
    paddingBottom: 48,
  },
  marqueeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  marqueePill: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  marqueePillSecondary: {
    borderColor: theme.colors.border,
  },
  marqueeText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  hero: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.spacing.sm,
    overflow: 'hidden',
    padding: theme.spacing.lg,
    position: 'relative',
  },
  heroGlow: {
    backgroundColor: theme.colors.highlight,
    borderRadius: 999,
    height: 150,
    opacity: 0.1,
    position: 'absolute',
    right: -24,
    top: -36,
    width: 150,
  },
  eyebrow: {
    color: theme.colors.brandMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 38,
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  panel: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  helperText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  warningText: {
    color: theme.colors.warning,
    fontSize: 13,
    lineHeight: 18,
  },
  statusText: {
    color: theme.colors.accentMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  sessionCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 4,
    padding: theme.spacing.md,
  },
  sessionValue: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  sessionMeta: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  input: {
    backgroundColor: theme.colors.backgroundElevated,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.brand,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: theme.colors.textOnBrand,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.accentMuted,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  buttonMuted: {
    opacity: 0.6,
  },
});
