import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { AppMap } from "@/components/app-map";
import { theme } from "@/constants/theme";
import {
  formatDistanceMiles,
  formatVerificationAge,
  formatVerificationDate,
} from "@/lib/format";
import { distanceInMiles } from "@/lib/geo";
import { getVenueDetailsLive, type VenueDetailsModel } from "@/lib/live-data";
import { openDirections } from "@/lib/navigation";

const fallbackLocation = {
  latitude: 41.9295,
  longitude: -87.7071,
};

function getStatusLabel(status: string): string {
  switch (status) {
    case "confirmed_present":
      return "Confirmed on site";
    case "temporarily_unavailable":
      return "Temporarily unavailable";
    case "rumored_present":
      return "Needs confirmation";
    default:
      return status;
  }
}

export default function VenueDetailsScreen() {
  const { width } = useWindowDimensions();
  const isWideLayout = Platform.OS === "web" && width >= 1100;
  const params = useLocalSearchParams<{ id: string }>();
  const [venueDetails, setVenueDetails] = useState<VenueDetailsModel | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadVenue() {
      if (!params.id) {
        setVenueDetails(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const nextVenueDetails = await getVenueDetailsLive(params.id);

        if (!cancelled) {
          setVenueDetails(nextVenueDetails);
        }
      } catch {
        if (!cancelled) {
          setVenueDetails(null);
          setLoadError(
            "Could not load this venue from Supabase yet. Check the venue details RPC and seed data.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadVenue();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const venue = venueDetails?.venue;
  const gamesById = venueDetails?.gamesById ?? {};

  if (isLoading) {
    return (
      <View style={styles.missingState}>
        <Stack.Screen options={{ title: "Loading venue" }} />
        <Text style={styles.missingTitle}>Loading venue</Text>
        <Text style={styles.missingText}>
          Pulling the latest venue data from the current source.
        </Text>
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={styles.missingState}>
        <Stack.Screen options={{ title: "Venue missing" }} />
        <Text style={styles.missingTitle}>Venue not found</Text>
        <Text style={styles.missingText}>
          {loadError ??
            "This route is wired up, but the current data source does not contain that venue id."}
        </Text>
      </View>
    );
  }

  const distanceMiles = distanceInMiles(fallbackLocation, {
    latitude: venue.latitude,
    longitude: venue.longitude,
  });

  return (
    <>
      <Stack.Screen options={{ title: venue.name }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWideLayout && styles.contentWide,
        ]}
      >
        <View style={styles.marqueeRow}>
          <View style={styles.marqueePill}>
            <Text style={styles.marqueeText}>Venue signal</Text>
          </View>
          <View style={[styles.marqueePill, styles.marqueePillSecondary]}>
            <Text style={styles.marqueeText}>Tracked floor intelligence</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.name}>{venue.name}</Text>
          <Text style={styles.address}>
            {venue.address}, {venue.city}, {venue.region}
          </Text>
          <Text style={styles.notes}>{venue.notes}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <Text style={styles.metaValue}>
                {formatDistanceMiles(distanceMiles)}
              </Text>
              <Text style={styles.metaLabel}>from demo location</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaValue}>{venue.verifiedByCount}</Text>
              <Text style={styles.metaLabel}>community confirmations</Text>
            </View>
          </View>
        </View>

        <View
          style={[styles.detailGrid, isWideLayout && styles.detailGridWide]}
        >
          <View
            style={[
              styles.panel,
              styles.mapPanel,
              isWideLayout && styles.mapPanelWide,
            ]}
          >
            <Text style={styles.sectionTitle}>Map</Text>
            <AppMap
              height={isWideLayout ? 360 : 220}
              onPinPress={() => {
                void openDirections({
                  address: `${venue.address}, ${venue.city}, ${venue.region}`,
                  destination: {
                    latitude: venue.latitude,
                    longitude: venue.longitude,
                  },
                  label: `${venue.name}, ${venue.address}, ${venue.city}, ${venue.region}`,
                });
              }}
              pins={[
                {
                  id: venue.id,
                  coordinate: {
                    latitude: venue.latitude,
                    longitude: venue.longitude,
                  },
                  description: `${venue.address}, ${venue.city}, ${venue.region}`,
                  title: venue.name,
                },
              ]}
              region={{
                latitude: venue.latitude,
                longitude: venue.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
              }}
            />
          </View>

          <View
            style={[
              styles.panel,
              styles.inventoryPanel,
              isWideLayout && styles.inventoryPanelWide,
            ]}
          >
            <Text style={styles.sectionTitle}>Tracked inventory</Text>
            <View style={styles.inventoryList}>
              {venue.inventory.map((item) => {
                const game = gamesById[item.gameId];

                return (
                  <View
                    key={`${venue.id}-${item.gameId}`}
                    style={styles.inventoryCard}
                  >
                    <Text style={styles.inventoryTitle}>
                      {game?.title ?? item.gameId}
                    </Text>
                    <Text style={styles.inventoryMeta}>
                      {getStatusLabel(item.status)} • {item.quantity} machine
                      {item.quantity > 1 ? "s" : ""}
                    </Text>
                    <Text style={styles.inventoryMeta}>
                      Last verified{" "}
                      {formatVerificationDate(item.lastVerifiedAt)} (
                      {formatVerificationAge(item.lastVerifiedAt)})
                    </Text>
                    {item.note ? (
                      <Text style={styles.inventoryNote}>{item.note}</Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>What comes next</Text>
          <Text style={styles.nextStep}>
            Hook this screen up to `find_nearest_venues_for_game` and a venue
            detail query in Supabase, then let authenticated players confirm
            whether each cabinet is still on the floor.
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    backgroundColor: theme.colors.background,
    gap: theme.spacing.lg,
    padding: theme.spacing.md,
    paddingBottom: 48,
  },
  contentWide: {
    alignSelf: "center",
    maxWidth: 1440,
    width: "100%",
  },
  marqueeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
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
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  hero: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
    overflow: "hidden",
    position: "relative",
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  heroGlow: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    height: 150,
    opacity: 0.1,
    position: "absolute",
    right: -24,
    top: -36,
    width: 150,
  },
  name: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 38,
  },
  address: {
    color: theme.colors.brandMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  notes: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  metaCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: theme.spacing.md,
  },
  metaValue: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  metaLabel: {
    color: theme.colors.accentMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  panel: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  detailGrid: {
    gap: theme.spacing.lg,
  },
  detailGridWide: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  mapPanel: {
    width: "100%",
  },
  mapPanelWide: {
    flex: 1.05,
  },
  inventoryPanel: {
    width: "100%",
  },
  inventoryPanelWide: {
    alignSelf: "stretch",
    flex: 0.95,
  },
  inventoryList: {
    gap: theme.spacing.sm,
  },
  inventoryCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 6,
    padding: theme.spacing.md,
  },
  inventoryTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  inventoryMeta: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  inventoryNote: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  nextStep: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  missingState: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.sm,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  missingTitle: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
  },
  missingText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});
