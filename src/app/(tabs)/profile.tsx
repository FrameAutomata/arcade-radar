import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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
import { signInWithPassword, signUpWithPassword } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';

export default function ProfileScreen() {
  const { session, signOut, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithPassword(email, password);
      } else {
        await signUpWithPassword(email, password);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {session ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroGlow} />
              <Text style={styles.eyebrow}>Active session</Text>
              <Text style={styles.title}>Your profile.</Text>
              <Text style={styles.description}>
                You have scout access. Head to Scout Mode to report cabinets and
                help keep the database accurate.
              </Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue} numberOfLines={1}>
                    {session.email}
                  </Text>
                  <Text style={styles.heroStatLabel}>signed in as</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>
                    {session.role ?? 'contributor'}
                  </Text>
                  <Text style={styles.heroStatLabel}>access role</Text>
                </View>
              </View>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Account</Text>
              <Pressable style={styles.signOutButton} onPress={() => void signOut()}>
                <View style={styles.buttonRow}>
                  <Ionicons name="log-out-outline" size={16} color={theme.colors.warning} />
                  <Text style={styles.signOutButtonText}>Sign out</Text>
                </View>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.heroGlow} />
              <Text style={styles.eyebrow}>Access required</Text>
              <Text style={styles.title}>Sign in to contribute.</Text>
              <Text style={styles.description}>
                Create an account or sign in to submit scout reports and help
                build the community database.
              </Text>
            </View>

            <View style={styles.panel}>
              <View style={styles.modeToggle}>
                <Pressable
                  style={[styles.modeChip, mode === 'signin' && styles.modeChipActive]}
                  onPress={() => setMode('signin')}
                >
                  <Text style={[styles.modeChipText, mode === 'signin' && styles.modeChipTextActive]}>
                    Sign in
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.modeChip, mode === 'signup' && styles.modeChipActive]}
                  onPress={() => setMode('signup')}
                >
                  <Text style={[styles.modeChipText, mode === 'signup' && styles.modeChipTextActive]}>
                    Create account
                  </Text>
                </Pressable>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={theme.colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={theme.colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={() => void handleSubmit()}
                disabled={loading}
              >
                <View style={styles.buttonRow}>
                  <Ionicons
                    name={loading ? 'sync' : mode === 'signin' ? 'log-in-outline' : 'person-add-outline'}
                    size={16}
                    color={theme.colors.textOnBrand}
                  />
                  <Text style={styles.submitButtonText}>
                    {loading ? 'Working...' : mode === 'signin' ? 'Sign in' : 'Create account'}
                  </Text>
                </View>
              </Pressable>
            </View>
          </>
        )}
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
    backgroundColor: theme.colors.brand,
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
    fontFamily: theme.fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.sansBold,
    fontSize: 30,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  description: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    lineHeight: 22,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  heroStat: {
    backgroundColor: 'rgba(8, 15, 30, 0.72)',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    minWidth: 160,
    padding: theme.spacing.md,
  },
  heroStatValue: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.sansBold,
    fontSize: 16,
    lineHeight: 22,
  },
  heroStatLabel: {
    color: theme.colors.accentMuted,
    fontFamily: theme.fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.0,
    lineHeight: 12,
    textTransform: 'uppercase',
  },
  panel: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  panelTitle: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 20,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  modeChip: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  modeChipActive: {
    backgroundColor: theme.colors.accentDim,
    borderColor: theme.colors.accent,
  },
  modeChipText: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  modeChipTextActive: {
    color: theme.colors.accent,
  },
  input: {
    backgroundColor: theme.colors.backgroundElevated,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  errorText: {
    color: theme.colors.highlight,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 18,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.brand,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: theme.colors.textOnBrand,
    fontFamily: theme.fonts.sansBold,
    fontSize: 15,
    lineHeight: 20,
  },
  signOutButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.warning,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  signOutButtonText: {
    color: theme.colors.warning,
    fontFamily: theme.fonts.sansBold,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
});
