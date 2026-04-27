import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { AppMap } from "@/components/app-map";
import { theme } from "@/constants/theme";
import {
  formatVerificationAge,
  formatVerificationDate,
} from "@/lib/format";
import { getVenueDetailsLive, type VenueDetailsModel } from "@/lib/live-data";
import { openDirections } from "@/lib/navigation";

const GAME_REPORT_ACTIONS = [
  {
    label: "Working",
    reportType: "confirmed_present",
  },
  {
    label: "Maintenance",
    reportType: "temporarily_unavailable",
  },
  {
    label: "Missing",
    reportType: "missing",
  },
] as const;

const INVENTORY_STATUS_FILTERS = [
  {
    label: "All",
    value: "all",
  },
  {
    label: "Working",
    value: "confirmed_present",
  },
  {
    label: "Maintenance",
    value: "temporarily_unavailable",
  },
  {
    label: "Needs confirmation",
    value: "rumored_present",
  },
  {
    label: "Missing",
    value: "removed",
  },
] as const;

type InventoryStatusFilter = (typeof INVENTORY_STATUS_FILTERS)[number]["value"];

function getStatusLabel(status: string): string {
  switch (status) {
    case "confirmed_present":
      return "Working";
    case "temporarily_unavailable":
      return "Under maintenance";
    case "rumored_present":
      return "Needs confirmation";
    case "removed":
      return "Reported missing";
    default:
      return status;
  }
}

function getStatusTone(status: string) {
  switch (status) {
    case "confirmed_present":
      return {
        backgroundColor: "rgba(57, 217, 138, 0.12)",
        borderColor: theme.colors.success,
        textColor: theme.colors.success,
      };
    case "temporarily_unavailable":
      return {
        backgroundColor: "rgba(255, 213, 74, 0.12)",
        borderColor: theme.colors.warning,
        textColor: theme.colors.warning,
      };
    case "removed":
      return {
        backgroundColor: "rgba(255, 95, 162, 0.12)",
        borderColor: theme.colors.highlight,
        textColor: theme.colors.highlight,
      };
    default:
      return {
        backgroundColor: "rgba(120, 215, 255, 0.12)",
        borderColor: theme.colors.accentMuted,
        textColor: theme.colors.accentMuted,
      };
  }
}

export default function VenueDetailsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWideLayout = Platform.OS === "web" && width >= 1100;
  const params = useLocalSearchParams<{ id: string }>();
  const [venueDetails, setVenueDetails] = useState<VenueDetailsModel | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryStatusFilter, setInventoryStatusFilter] =
    useState<InventoryStatusFilter>("all");
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState("all");
  const [expandedInventoryIds, setExpandedInventoryIds] = useState<
    Record<string, boolean>
  >({});
  const [isDenseInventory, setIsDenseInventory] = useState(false);

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
            "Could not load this venue right now. Try again in a moment.",
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
  const inventoryCategories = useMemo(() => {
    const categorySet = new Set<string>();

    for (const item of venueDetails?.venue.inventory ?? []) {
      const game = venueDetails?.gamesById[item.gameId];

      for (const category of game?.categories ?? []) {
        categorySet.add(category);
      }
    }

    return Array.from(categorySet).sort((left, right) =>
      left.localeCompare(right),
    );
  }, [venueDetails]);
  const filteredInventory = useMemo(() => {
    const normalizedQuery = inventoryQuery.trim().toLowerCase();

    return (venueDetails?.venue.inventory ?? []).filter((item) => {
      const game = venueDetails?.gamesById[item.gameId];
      const searchableText = [
        game?.title,
        game?.manufacturer,
        ...(game?.categories ?? []),
        item.gameId,
        item.note,
        getStatusLabel(item.status),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesQuery =
        !normalizedQuery || searchableText.includes(normalizedQuery);
      const matchesStatus =
        inventoryStatusFilter === "all" || item.status === inventoryStatusFilter;
      const matchesCategory =
        inventoryCategoryFilter === "all" ||
        (game?.categories ?? []).includes(inventoryCategoryFilter);

      return matchesQuery && matchesStatus && matchesCategory;
    });
  }, [inventoryCategoryFilter, inventoryQuery, inventoryStatusFilter, venueDetails]);

  if (isLoading) {
    return (
      <View style={styles.missingState}>
        <Stack.Screen options={{ title: "Loading venue" }} />
        <Text style={styles.missingTitle}>Loading venue</Text>
        <Text style={styles.missingText}>
          Pulling the latest venue details.
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
            "This venue is not available right now."}
        </Text>
      </View>
    );
  }

  const directionsInput = {
    address: `${venue.address}, ${venue.city}, ${venue.region}`,
    destination: {
      latitude: venue.latitude,
      longitude: venue.longitude,
    },
    label: `${venue.name}, ${venue.address}, ${venue.city}, ${venue.region}`,
  };
  const venueId = venue.id;

  function openVenueDirections() {
    void openDirections(directionsInput);
  }

  function openScoutForVenue() {
    router.push({
      pathname: "/scout",
      params: {
        venueId,
      },
    });
  }

  function openScoutForGame(
    game: NonNullable<VenueDetailsModel["gamesById"][string]>,
    reportType: (typeof GAME_REPORT_ACTIONS)[number]["reportType"],
  ) {
    router.push({
      pathname: "/scout",
      params: {
        gameId: game.id,
        gameCategories: game.categories.join('|'),
        gameManufacturer: game.manufacturer,
        gameReleaseYear: String(game.releaseYear),
        gameSlug: game.slug,
        gameTitle: game.title,
        reportType,
        venueId,
      },
    });
  }

  function toggleInventoryDetails(itemId: string) {
    setExpandedInventoryIds((currentIds) => ({
      ...currentIds,
      [itemId]: !currentIds[itemId],
    }));
  }

  return (
    <>
      <Stack.Screen options={{ title: venue.name }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWideLayout && styles.contentWide,
        ]}
      >
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.name}>{venue.name}</Text>
          <Text style={styles.address}>
            {venue.address}, {venue.city}, {venue.region}
          </Text>
          <Text style={styles.notes}>{venue.notes}</Text>

          <View style={styles.actionRow}>
            <Pressable onPress={openVenueDirections} style={styles.primaryAction}>
              <Text style={styles.primaryActionText}>Get directions</Text>
            </Pressable>
            <Pressable onPress={openScoutForVenue} style={styles.secondaryAction}>
              <Text style={styles.secondaryActionText}>Report inventory</Text>
            </Pressable>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <Text style={styles.metaValue}>{venue.verifiedByCount}</Text>
              <Text style={styles.metaLabel}>community confirmations</Text>
            </View>
          </View>
        </View>

        <View style={styles.ctaPanel}>
          <Pressable onPress={openVenueDirections} style={styles.ctaCardPrimary}>
            <Text style={styles.ctaEyebrow}>Go now</Text>
            <Text style={styles.ctaTitle}>Open directions</Text>
            <Text style={styles.ctaText}>Launch your maps app with this venue address.</Text>
          </Pressable>
          <Pressable onPress={openScoutForVenue} style={styles.ctaCard}>
            <Text style={styles.ctaEyebrow}>Contribute</Text>
            <Text style={styles.ctaTitle}>Add inventory report</Text>
            <Text style={styles.ctaText}>Submit a cabinet you saw here for review.</Text>
          </Pressable>
          <Pressable onPress={openScoutForVenue} style={styles.ctaCard}>
            <Text style={styles.ctaEyebrow}>Status check</Text>
            <Text style={styles.ctaTitle}>Report game status</Text>
            <Text style={styles.ctaText}>Mark games as working, missing, or under maintenance.</Text>
          </Pressable>
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
                openVenueDirections();
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
            <View style={styles.inventoryToolbar}>
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                onChangeText={setInventoryQuery}
                placeholder="Search tracked games"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.inventorySearchInput}
                value={inventoryQuery}
              />
              <View style={styles.inventoryFilterRow}>
                {INVENTORY_STATUS_FILTERS.map((filter) => (
                  <Pressable
                    key={filter.value}
                    onPress={() => setInventoryStatusFilter(filter.value)}
                    style={[
                      styles.inventoryFilterChip,
                      inventoryStatusFilter === filter.value &&
                        styles.inventoryFilterChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.inventoryFilterChipText,
                        inventoryStatusFilter === filter.value &&
                          styles.inventoryFilterChipTextSelected,
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {inventoryCategories.length > 0 ? (
                <View style={styles.inventoryFilterRow}>
                  <Pressable
                    onPress={() => setInventoryCategoryFilter("all")}
                    style={[
                      styles.inventoryFilterChip,
                      inventoryCategoryFilter === "all" &&
                        styles.inventoryFilterChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.inventoryFilterChipText,
                        inventoryCategoryFilter === "all" &&
                          styles.inventoryFilterChipTextSelected,
                      ]}
                    >
                      All types
                    </Text>
                  </Pressable>
                  {inventoryCategories.map((category) => (
                    <Pressable
                      key={category}
                      onPress={() => setInventoryCategoryFilter(category)}
                      style={[
                        styles.inventoryFilterChip,
                        inventoryCategoryFilter === category &&
                          styles.inventoryFilterChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.inventoryFilterChipText,
                          inventoryCategoryFilter === category &&
                            styles.inventoryFilterChipTextSelected,
                        ]}
                      >
                        {category}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Text style={styles.inventoryResultMeta}>
                Showing {filteredInventory.length} of {venue.inventory.length} tracked games
              </Text>
              <View style={styles.densitySwitchRow}>
                <Text
                  style={[
                    styles.densityModeSymbol,
                    !isDenseInventory && styles.densityModeSymbolActive,
                  ]}
                >
                  ▦
                </Text>
                <Switch
                  onValueChange={setIsDenseInventory}
                  thumbColor={
                    isDenseInventory ? theme.colors.accent : theme.colors.textMuted
                  }
                  trackColor={{
                    false: theme.colors.surfaceMuted,
                    true: "rgba(60, 242, 211, 0.35)",
                  }}
                  value={isDenseInventory}
                />
                <Text
                  style={[
                    styles.densityModeSymbol,
                    isDenseInventory && styles.densityModeSymbolActive,
                  ]}
                >
                  ☰
                </Text>
              </View>
            </View>
            <View style={styles.inventoryList}>
              {filteredInventory.length > 0 ? (
                filteredInventory.map((item) => {
                const game = gamesById[item.gameId];
                const statusTone = getStatusTone(item.status);
                const itemKey = `${venue.id}-${item.gameId}`;
                const isExpanded = Boolean(expandedInventoryIds[itemKey]);

                return (
                  <View
                    key={itemKey}
                    style={[
                      styles.inventoryCard,
                      isDenseInventory && styles.inventoryCardDense,
                    ]}
                  >
                    <View
                      style={[
                        styles.inventoryTitleRow,
                        isDenseInventory && styles.inventoryTitleRowDense,
                      ]}
                    >
                      <Text
                        numberOfLines={isDenseInventory ? 1 : undefined}
                        style={[
                          styles.inventoryTitle,
                          isDenseInventory && styles.inventoryTitleDense,
                        ]}
                      >
                        {game?.title ?? item.gameId}
                      </Text>
                      <Text
                        style={[
                          styles.statusPill,
                          isDenseInventory && styles.statusPillDense,
                          {
                            backgroundColor: statusTone.backgroundColor,
                            borderColor: statusTone.borderColor,
                            color: statusTone.textColor,
                          },
                        ]}
                      >
                        {getStatusLabel(item.status)}
                      </Text>
                    </View>
                    <View style={styles.inventoryMetaRow}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.inventoryMeta,
                          isDenseInventory && styles.inventoryMetaDense,
                        ]}
                      >
                        {isDenseInventory
                          ? formatVerificationAge(item.lastVerifiedAt)
                          : `Last reported ${formatVerificationDate(item.lastVerifiedAt)} (${formatVerificationAge(item.lastVerifiedAt)})`}
                      </Text>
                      <Text
                        style={[
                          styles.inventoryMeta,
                          isDenseInventory && styles.inventoryMetaDense,
                        ]}
                      >
                        {isDenseInventory
                          ? `${item.quantity}x`
                          : `${item.quantity} machine${item.quantity > 1 ? "s" : ""} tracked`}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => toggleInventoryDetails(itemKey)}
                      style={[
                        styles.detailsToggle,
                        isDenseInventory && styles.detailsToggleDense,
                      ]}
                    >
                      <Text style={styles.detailsToggleText}>
                        {isExpanded ? "Hide report options" : "Report / details"}
                      </Text>
                    </Pressable>
                    {isExpanded ? (
                      <View style={styles.reportActionBlock}>
                        {item.note ? (
                          <Text style={styles.inventoryNote}>{item.note}</Text>
                        ) : (
                          <Text style={styles.inventoryNote}>
                            No cabinet notes have been reported yet.
                          </Text>
                        )}
                        <Text style={styles.reportActionLabel}>
                          Report current status
                        </Text>
                        {game ? (
                          <View style={styles.reportActionRow}>
                            {GAME_REPORT_ACTIONS.map((action) => (
                              <Pressable
                                key={action.reportType}
                                onPress={() =>
                                  openScoutForGame(game, action.reportType)
                                }
                                style={styles.reportActionChip}
                              >
                                <Text style={styles.reportActionChipText}>
                                  {action.label}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        ) : (
                          <Text style={styles.inventoryNote}>
                            Reporting is unavailable until this game resolves in the catalog.
                          </Text>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
                })
              ) : (
                <Text style={styles.emptyInventoryText}>
                  No tracked games match the current inventory search.
                </Text>
              )}
            </View>
          </View>
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
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: theme.colors.brand,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  primaryActionText: {
    color: theme.colors.textOnBrand,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.accentMuted,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  secondaryActionText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
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
  ctaPanel: {
    gap: theme.spacing.sm,
  },
  ctaCard: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: 4,
    padding: theme.spacing.md,
  },
  ctaCardPrimary: {
    backgroundColor: "rgba(255, 138, 31, 0.14)",
    borderColor: theme.colors.brand,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: 4,
    padding: theme.spacing.md,
  },
  ctaEyebrow: {
    color: theme.colors.accentMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  ctaTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "900",
  },
  ctaText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
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
  inventoryToolbar: {
    gap: theme.spacing.sm,
  },
  inventorySearchInput: {
    backgroundColor: theme.colors.backgroundElevated,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  inventoryFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  inventoryFilterChip: {
    backgroundColor: "rgba(8, 15, 30, 0.72)",
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inventoryFilterChipSelected: {
    backgroundColor: theme.colors.surfaceStrong,
    borderColor: theme.colors.brand,
  },
  inventoryFilterChipText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: "800",
  },
  inventoryFilterChipTextSelected: {
    color: theme.colors.brandMuted,
  },
  inventoryResultMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  densitySwitchRow: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(8, 15, 30, 0.72)",
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  densityModeSymbol: {
    color: theme.colors.textMuted,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },
  densityModeSymbolActive: {
    color: theme.colors.accent,
  },
  inventoryCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 6,
    padding: theme.spacing.md,
  },
  inventoryCardDense: {
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inventoryTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  inventoryTitleRowDense: {
    flexWrap: "nowrap",
    gap: 6,
  },
  inventoryTitle: {
    color: theme.colors.textPrimary,
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 17,
    fontWeight: "700",
  },
  inventoryTitleDense: {
    fontSize: 14,
    lineHeight: 18,
  },
  inventoryMeta: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  inventoryMetaDense: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
  },
  inventoryMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
    textTransform: "uppercase",
  },
  statusPillDense: {
    fontSize: 9,
    letterSpacing: 0.4,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  inventoryNote: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  detailsToggle: {
    alignSelf: "flex-start",
    marginTop: 2,
  },
  detailsToggleDense: {
    marginTop: 0,
  },
  detailsToggleText: {
    color: theme.colors.accentMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  emptyInventoryText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  reportActionBlock: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  reportActionLabel: {
    color: theme.colors.accentMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  reportActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  reportActionChip: {
    backgroundColor: "rgba(8, 15, 30, 0.72)",
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reportActionChipText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
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
