import { Link } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import { env } from "@/lib/env";

const demoUrl = env.authRedirectUrl || "https://arcade-radar--demo.expo.app/";

const demoSteps = [
  "Enter a ZIP or address near seeded DFW venues.",
  "Search for a recognizable cabinet and pick the game filter.",
  "Tap a map pin or venue card to show inventory details.",
  "Open directions to prove it connects to a real-world trip.",
  "Switch to Scout Mode and submit a pending report.",
  "Sign in as admin and approve or reject the submission.",
];

const talkingPoints = [
  "Find arcades by exact cabinet, not just by business category.",
  "Community reports keep rare machine inventory fresh.",
  "Admins approve submissions before they affect live search.",
  "The map stack avoids Google Maps Platform costs.",
];

export default function DemoScreen() {
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1100;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWideLayout && styles.contentWide,
        ]}
      >
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.eyebrow}>Startup mixer demo</Text>
          <Text style={styles.title}>Arcade Radar finds the cabinet, not just the arcade.</Text>
          <Text style={styles.description}>
            A practical arcade search app for players who want to know where a
            specific game is actually playable.
          </Text>
          <View style={styles.actionRow}>
            <Link href="/" asChild>
              <Pressable style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Open search</Text>
              </Pressable>
            </Link>
            <Link href="/scout" asChild>
              <Pressable style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Scout flow</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Share link</Text>
            <Text style={styles.helperText}>
              Use this stable demo alias for your QR code and Supabase auth redirects.
            </Text>
            <View style={styles.urlBox}>
              <Text selectable style={styles.urlText}>{demoUrl}</Text>
            </View>
            <Text style={styles.helperText}>
              Make a QR from this URL before the event and keep the page open on
              your phone as a backup.
            </Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Pitch in one sentence</Text>
            <Text style={styles.pitchText}>
              Arcade Radar helps players find the nearest arcade with the exact
              cabinet they want, then lets the community keep inventory accurate.
            </Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Demo flow</Text>
            <View style={styles.list}>
              {demoSteps.map((step, index) => (
                <View key={step} style={styles.stepRow}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>What to say</Text>
            <View style={styles.list}>
              {talkingPoints.map((point) => (
                <View key={point} style={styles.pointRow}>
                  <View style={styles.pointDot} />
                  <Text style={styles.stepText}>{point}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Pre-demo check</Text>
          <View style={styles.checkGrid}>
            <Text style={styles.checkItem}>Demo alias deployed</Text>
            <Text style={styles.checkItem}>Supabase redirect URL set</Text>
            <Text style={styles.checkItem}>Seeded DFW venue inventory</Text>
            <Text style={styles.checkItem}>Admin account signed in once</Text>
            <Text style={styles.checkItem}>Phone and desktop tested</Text>
            <Text style={styles.checkItem}>Backup screenshots ready</Text>
          </View>
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
  contentWide: {
    alignSelf: "center",
    maxWidth: 1440,
    width: "100%",
  },
  hero: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.spacing.md,
    overflow: "hidden",
    padding: theme.spacing.lg,
    position: "relative",
  },
  heroGlow: {
    backgroundColor: theme.colors.highlight,
    borderRadius: 999,
    height: 180,
    opacity: 0.13,
    position: "absolute",
    right: -36,
    top: -42,
    width: 180,
  },
  eyebrow: {
    color: theme.colors.brandMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 42,
    maxWidth: 900,
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 760,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.brand,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: theme.colors.textOnBrand,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.accentMuted,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  grid: {
    gap: theme.spacing.lg,
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
    fontWeight: "800",
  },
  helperText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  pitchText: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 30,
  },
  urlBox: {
    backgroundColor: theme.colors.backgroundElevated,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  urlText: {
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: "800",
  },
  list: {
    gap: theme.spacing.sm,
  },
  stepRow: {
    alignItems: "center",
    backgroundColor: "rgba(8, 15, 30, 0.62)",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
  },
  stepNumber: {
    backgroundColor: theme.colors.brand,
    borderRadius: 999,
    color: theme.colors.textOnBrand,
    fontSize: 13,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  stepText: {
    color: theme.colors.textSecondary,
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
  },
  pointRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  pointDot: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    height: 9,
    width: 9,
  },
  checkGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  checkItem: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
