import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ViewStyle } from "react-native";

import { theme } from "@/constants/theme";
import { formatDistanceMiles, formatVerificationAge } from "@/lib/format";
import type { NearbyVenueResult, VenueMatch } from "@/types/domain";

function getStatusLabel(status: VenueMatch["inventory"]["status"]): string {
  switch (status) {
    case "confirmed_present":
      return "Confirmed";
    case "temporarily_unavailable":
      return "Maintenance";
    case "rumored_present":
      return "Rumored";
    default:
      return "Unknown";
  }
}

function getStatusColor(status: VenueMatch["inventory"]["status"]): string {
  switch (status) {
    case "confirmed_present":
      return theme.colors.success;
    case "temporarily_unavailable":
      return theme.colors.warning;
    case "rumored_present":
      return theme.colors.brandMuted;
    default:
      return theme.colors.textMuted;
  }
}

interface ResultCardProps {
  result: NearbyVenueResult;
  selected?: boolean;
}

export function ResultCard({ result, selected = false }: ResultCardProps) {
  const match = result as VenueMatch;
  const hasGameDetails = Boolean(result.inventory && result.game);
  const cardStyle = StyleSheet.flatten([
    styles.card,
    selected ? styles.cardSelected : null,
  ]) as ViewStyle;

  return (
    <Link
      href={{
        pathname: "/venue/[id]",
        params: { id: result.venue.id },
      }}
      asChild
    >
      <Pressable style={cardStyle}>
        <View style={styles.row}>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={2}>{result.venue.name}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {result.venue.address}, {result.venue.city}
            </Text>
          </View>
          <Text style={styles.distance}>
            {formatDistanceMiles(result.distanceMiles)}
          </Text>
        </View>

        {hasGameDetails ? (
          <>
            <Text style={styles.gameTitle} numberOfLines={1}>Has {result.game?.title}</Text>
            <View style={styles.metaRow}>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: `${getStatusColor(match.inventory.status)}22`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: getStatusColor(match.inventory.status) },
                  ]}
                >
                  {getStatusLabel(match.inventory.status)}
                </Text>
              </View>
              <Text style={styles.metaText}>
                {match.inventory.quantity} machine
                {match.inventory.quantity > 1 ? "s" : ""}
              </Text>
              <Text style={styles.metaText}>
                {formatVerificationAge(match.inventory.lastVerifiedAt)}
              </Text>
            </View>

            {match.inventory.note ? (
              <Text style={styles.note}>{match.inventory.note}</Text>
            ) : null}
          </>
        ) : (
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              {result.venue.inventory.length} tracked game
              {result.venue.inventory.length === 1 ? "" : "s"}
            </Text>
            {result.venue.verifiedByCount !== undefined ? (
              <Text style={styles.metaText}>
                {result.venue.verifiedByCount} community confirmations
              </Text>
            ) : null}
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  cardSelected: {
    borderColor: theme.colors.brand,
    shadowColor: theme.colors.brand,
    shadowOpacity: 0.28,
    shadowRadius: 14,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.sansBold,
    fontSize: 16,
    lineHeight: 22,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  gameTitle: {
    color: theme.colors.brandMuted,
    fontFamily: theme.fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  distance: {
    color: theme.colors.brandMuted,
    fontFamily: theme.fonts.sansBold,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: theme.fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.0,
    lineHeight: 12,
    textTransform: "uppercase",
  },
  metaText: {
    color: theme.colors.textMuted,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  note: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
});
