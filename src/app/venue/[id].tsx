import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Linking,
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
import { BREAKPOINTS, theme } from "@/constants/theme";
import {
  formatVerificationAge,
  formatVerificationDate,
} from "@/lib/format";
import { getVenueDetailsLive, type VenueDetailsModel } from "@/lib/live-data";
import { openDirections } from "@/lib/navigation";
import type { VenueHours } from "@/types/domain";

// ─── Constants ───────────────────────────────────────────────────────────────

const GAME_REPORT_ACTIONS = [
  { label: "Working", reportType: "confirmed_present" },
  { label: "Maintenance", reportType: "temporarily_unavailable" },
  { label: "Missing", reportType: "missing" },
] as const;

const INVENTORY_STATUS_FILTERS = [
  { label: "All", value: "all" },
  { label: "Working", value: "confirmed_present" },
  { label: "Maintenance", value: "temporarily_unavailable" },
  { label: "Needs confirmation", value: "rumored_present" },
  { label: "Missing", value: "removed" },
] as const;

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const DAY_LABELS: Record<string, string> = {
  fri: "Fri",
  mon: "Mon",
  sat: "Sat",
  sun: "Sun",
  thu: "Thu",
  tue: "Tue",
  wed: "Wed",
};

// JS getDay(): 0=Sun, 1=Mon … 6=Sat
const JS_DAY_TO_KEY = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type InventoryStatusFilter = (typeof INVENTORY_STATUS_FILTERS)[number]["value"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
        backgroundColor: theme.colors.successDim,
        borderColor: theme.colors.success,
        textColor: theme.colors.success,
      };
    case "temporarily_unavailable":
      return {
        backgroundColor: theme.colors.warningDim,
        borderColor: theme.colors.warning,
        textColor: theme.colors.warning,
      };
    case "removed":
      return {
        backgroundColor: theme.colors.highlightDim,
        borderColor: theme.colors.highlight,
        textColor: theme.colors.highlight,
      };
    default:
      return {
        backgroundColor: theme.colors.accentDim,
        borderColor: theme.colors.accentMuted,
        textColor: theme.colors.accentMuted,
      };
  }
}

function formatHour(time: string): string {
  const [hourStr, minuteStr = "00"] = time.split(":");
  const hour = parseInt(hourStr ?? "0", 10);
  if (isNaN(hour)) return time;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minuteStr} ${period}`;
}

function todayKey(): string {
  return JS_DAY_TO_KEY[new Date().getDay()] ?? "mon";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HoursTable({ hours }: { hours: VenueHours }) {
  const today = todayKey();
  return (
    <View style={styles.hoursTable}>
      {DAY_ORDER.map((day) => {
        const entry = hours[day];
        const isToday = day === today;
        return (
          <View
            key={day}
            style={[styles.hoursRow, isToday && styles.hoursRowToday]}
          >
            <Text
              style={[
                styles.hoursDay,
                isToday && styles.hoursDayToday,
              ]}
            >
              {DAY_LABELS[day]}
            </Text>
            {entry ? (
              <Text
                style={[
                  styles.hoursTime,
                  isToday && styles.hoursTimeToday,
                ]}
              >
                {formatHour(entry.open)} – {formatHour(entry.close)}
              </Text>
            ) : (
              <Text style={styles.hoursClosed}>Closed</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function VenueDetailsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWideLayout = Platform.OS === "web" && width >= BREAKPOINTS.wide;
  const params = useLocalSearchParams<{ id: string }>();
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [inventoryStatusFilter, setInventoryStatusFilter] =
    useState<InventoryStatusFilter>("all");
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState("all");
  const [expandedInventoryIds, setExpandedInventoryIds] = useState<
    Record<string, boolean>
  >({});
  const [isDenseInventory, setIsDenseInventory] = useState(false);

  const {
    data: venueDetails = null,
    isPending: isLoading,
    error: loadError,
  } = useQuery<VenueDetailsModel | null>({
    enabled: Boolean(params.id),
    queryFn: () => getVenueDetailsLive(params.id),
    queryKey: ["venueDetails", params.id],
  });

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
    return Array.from(categorySet).sort((a, b) => a.localeCompare(b));
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
        item.machineLabel,
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
        <Text style={styles.missingText}>Pulling the latest venue details.</Text>
      </View>
    );
  }

  if (!venue) {
    return (
      <View style={styles.missingState}>
        <Stack.Screen options={{ title: "Venue missing" }} />
        <Text style={styles.missingTitle}>Venue not found</Text>
        <Text style={styles.missingText}>
          {loadError?.message ?? "This venue is not available right now."}
        </Text>
      </View>
    );
  }

  const directionsInput = {
    address: `${venue.address}, ${venue.city}, ${venue.region}`,
    destination: { latitude: venue.latitude, longitude: venue.longitude },
    label: `${venue.name}, ${venue.address}, ${venue.city}, ${venue.region}`,
  };
  const venueId = venue.id;

  const isNonActive =
    venue.status === "temporarily_closed" || venue.status === "inactive";

  const hasContactInfo =
    venue.phone ?? venue.website ?? venue.facebook ?? venue.twitter;

  function openVenueDirections() {
    void openDirections(directionsInput);
  }

  function openScoutForVenue() {
    router.push({ pathname: "/scout", params: { venueId } });
  }

  function openScoutForGame(
    game: NonNullable<VenueDetailsModel["gamesById"][string]>,
    reportType: (typeof GAME_REPORT_ACTIONS)[number]["reportType"],
  ) {
    router.push({
      pathname: "/scout",
      params: {
        gameId: game.id,
        gameCategories: game.categories.join("|"),
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
    setExpandedInventoryIds((current) => ({
      ...current,
      [itemId]: !current[itemId],
    }));
  }

  const fullAddress = [
    venue.address,
    venue.city,
    venue.region,
    venue.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <Stack.Screen options={{ title: venue.name }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWideLayout && styles.contentWide,
        ]}
      >
        {/* ── Status banner ── */}
        {isNonActive ? (
          <View style={styles.statusBanner}>
            <Ionicons
              name="warning"
              size={16}
              color={theme.colors.warning}
            />
            <Text style={styles.statusBannerText}>
              {venue.status === "temporarily_closed"
                ? "This venue is temporarily closed."
                : "This venue is no longer active."}
            </Text>
          </View>
        ) : null}

        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.heroGlow} />

          <View style={styles.heroHeader}>
            <Text style={styles.name}>{venue.name}</Text>
            {venue.entryFee ? (
              <View style={styles.entryFeeBadge}>
                <Text style={styles.entryFeeText}>{venue.entryFee}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.address}>{fullAddress}</Text>
          {venue.notes ? <Text style={styles.notes}>{venue.notes}</Text> : null}

          <View style={styles.actionRow}>
            <Pressable
              onPress={openVenueDirections}
              style={styles.primaryAction}
            >
              <Ionicons
                name="navigate"
                size={14}
                color={theme.colors.textOnBrand}
              />
              <Text style={styles.primaryActionText}>Get directions</Text>
            </Pressable>
            <Pressable
              onPress={openScoutForVenue}
              style={styles.secondaryAction}
            >
              <Ionicons
                name="camera-outline"
                size={14}
                color={theme.colors.textPrimary}
              />
              <Text style={styles.secondaryActionText}>Report inventory</Text>
            </Pressable>
          </View>

          <View style={styles.metaRow}>
            {venue.verifiedByCount !== undefined ? (
              <View style={styles.metaCard}>
                <Text style={styles.metaValue}>{venue.verifiedByCount}</Text>
                <Text style={styles.metaLabel}>community reports</Text>
              </View>
            ) : null}
            {venue.lastVerifiedAt ? (
              <View style={styles.metaCard}>
                <Text style={styles.metaValue}>
                  {formatVerificationAge(venue.lastVerifiedAt)}
                </Text>
                <Text style={styles.metaLabel}>since last check-in</Text>
              </View>
            ) : null}
            <View style={styles.metaCard}>
              <Text style={styles.metaValue}>{venue.inventory.length}</Text>
              <Text style={styles.metaLabel}>tracked titles</Text>
            </View>
          </View>
        </View>

        {/* ── Contact & links ── */}
        {hasContactInfo ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Contact & links</Text>
            <View style={styles.linkList}>
              {venue.phone ? (
                <Pressable
                  onPress={() => void Linking.openURL(`tel:${venue.phone}`)}
                  style={styles.linkRow}
                >
                  <View style={styles.linkIcon}>
                    <Ionicons
                      name="call-outline"
                      size={16}
                      color={theme.colors.accent}
                    />
                  </View>
                  <Text style={styles.linkText}>{venue.phone}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
              ) : null}
              {venue.website ? (
                <Pressable
                  onPress={() => void Linking.openURL(venue.website!)}
                  style={styles.linkRow}
                >
                  <View style={styles.linkIcon}>
                    <Ionicons
                      name="globe-outline"
                      size={16}
                      color={theme.colors.accent}
                    />
                  </View>
                  <Text style={styles.linkText} numberOfLines={1}>
                    {venue.website.replace(/^https?:\/\//, "")}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
              ) : null}
              {venue.facebook ? (
                <Pressable
                  onPress={() => void Linking.openURL(venue.facebook!)}
                  style={styles.linkRow}
                >
                  <View style={styles.linkIcon}>
                    <Ionicons
                      name="logo-facebook"
                      size={16}
                      color={theme.colors.accent}
                    />
                  </View>
                  <Text style={styles.linkText}>Facebook</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
              ) : null}
              {venue.twitter ? (
                <Pressable
                  onPress={() => void Linking.openURL(
                    venue.twitter!.startsWith("http")
                      ? venue.twitter!
                      : `https://x.com/${venue.twitter!.replace(/^@/, "")}`,
                  )}
                  style={styles.linkRow}
                >
                  <View style={styles.linkIcon}>
                    <Ionicons
                      name="logo-twitter"
                      size={16}
                      color={theme.colors.accent}
                    />
                  </View>
                  <Text style={styles.linkText}>
                    {venue.twitter.startsWith("@")
                      ? venue.twitter
                      : `@${venue.twitter}`}
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* ── Hours ── */}
        {venue.hours ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Hours</Text>
            <HoursTable hours={venue.hours} />
          </View>
        ) : null}

        {/* ── CTA panel ── */}
        <View style={styles.ctaPanel}>
          <Pressable onPress={openVenueDirections} style={styles.ctaCardPrimary}>
            <Text style={styles.ctaEyebrow}>Go now</Text>
            <Text style={styles.ctaTitle}>Open directions</Text>
            <Text style={styles.ctaText}>
              Launch your maps app with this venue address.
            </Text>
          </Pressable>
          <View style={styles.ctaSecondaryRow}>
            <Pressable
              onPress={openScoutForVenue}
              style={[styles.ctaCard, styles.ctaCardFlex]}
            >
              <Text style={styles.ctaEyebrow}>Contribute</Text>
              <Text style={styles.ctaTitle}>Add inventory</Text>
              <Text style={styles.ctaText}>Submit a cabinet you saw here.</Text>
            </Pressable>
            <Pressable
              onPress={openScoutForVenue}
              style={[styles.ctaCard, styles.ctaCardFlex]}
            >
              <Text style={styles.ctaEyebrow}>Status check</Text>
              <Text style={styles.ctaTitle}>Report status</Text>
              <Text style={styles.ctaText}>
                Mark games as working or missing.
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Map + Inventory ── */}
        <View style={[styles.detailGrid, isWideLayout && styles.detailGridWide]}>
          <View
            style={[
              styles.panel,
              styles.mapPanel,
              isWideLayout && styles.mapPanelWide,
            ]}
          >
            <Text style={styles.sectionTitle}>Location</Text>
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
                  description: fullAddress,
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

              <View style={styles.filterRow}>
                {INVENTORY_STATUS_FILTERS.map((filter) => (
                  <Pressable
                    key={filter.value}
                    onPress={() => setInventoryStatusFilter(filter.value)}
                    style={[
                      styles.filterChip,
                      inventoryStatusFilter === filter.value &&
                        styles.filterChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        inventoryStatusFilter === filter.value &&
                          styles.filterChipTextSelected,
                      ]}
                    >
                      {filter.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {inventoryCategories.length > 0 ? (
                <View style={styles.filterRow}>
                  <Pressable
                    onPress={() => setInventoryCategoryFilter("all")}
                    style={[
                      styles.filterChip,
                      inventoryCategoryFilter === "all" &&
                        styles.filterChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        inventoryCategoryFilter === "all" &&
                          styles.filterChipTextSelected,
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
                        styles.filterChip,
                        inventoryCategoryFilter === category &&
                          styles.filterChipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          inventoryCategoryFilter === category &&
                            styles.filterChipTextSelected,
                        ]}
                      >
                        {category}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={styles.inventoryMetaBar}>
                <Text style={styles.inventoryResultMeta}>
                  {filteredInventory.length} of {venue.inventory.length} games
                </Text>
                <View style={styles.densitySwitchRow}>
                  <Text
                    style={[
                      styles.densitySymbol,
                      !isDenseInventory && styles.densitySymbolActive,
                    ]}
                  >
                    ▦
                  </Text>
                  <Switch
                    onValueChange={setIsDenseInventory}
                    thumbColor={
                      isDenseInventory
                        ? theme.colors.accent
                        : theme.colors.textMuted
                    }
                    trackColor={{
                      false: theme.colors.surfaceMuted,
                      true: "rgba(60, 242, 211, 0.35)",
                    }}
                    value={isDenseInventory}
                  />
                  <Text
                    style={[
                      styles.densitySymbol,
                      isDenseInventory && styles.densitySymbolActive,
                    ]}
                  >
                    ☰
                  </Text>
                </View>
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
                        <View style={styles.inventoryTitleBlock}>
                          <Text
                            numberOfLines={isDenseInventory ? 1 : undefined}
                            style={[
                              styles.inventoryTitle,
                              isDenseInventory && styles.inventoryTitleDense,
                            ]}
                          >
                            {game?.title ?? item.gameId}
                          </Text>
                          {item.machineLabel ? (
                            <Text style={styles.machineLabel}>
                              {item.machineLabel}
                            </Text>
                          ) : null}
                        </View>
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
                          {isExpanded
                            ? "Hide report options"
                            : "Report / details"}
                        </Text>
                      </Pressable>

                      {isExpanded ? (
                        <View style={styles.reportActionBlock}>
                          {item.note ? (
                            <Text style={styles.inventoryNote}>{item.note}</Text>
                          ) : null}
                          {item.confidenceScore !== undefined ? (
                            <Text style={styles.confidenceNote}>
                              Confidence:{" "}
                              {Math.round(item.confidenceScore * 100)}%
                            </Text>
                          ) : null}
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
                              Reporting is unavailable until this game resolves
                              in the catalog.
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

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  // ── Loading / error ──────────────────────────────────────────────────────────
  missingState: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.sm,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  missingTitle: {
    ...theme.type.title,
    color: theme.colors.textPrimary,
  },
  missingText: {
    ...theme.type.body,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },

  // ── Status banner ────────────────────────────────────────────────────────────
  statusBanner: {
    alignItems: "center",
    backgroundColor: theme.colors.warningDim,
    borderColor: theme.colors.warning,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  statusBannerText: {
    ...theme.type.bodyMedium,
    color: theme.colors.warning,
    flex: 1,
  },

  // ── Hero ─────────────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.spacing.sm,
    overflow: "hidden",
    padding: theme.spacing.lg,
    position: "relative",
    ...theme.glow.subtle,
  },
  heroGlow: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    height: 160,
    opacity: 0.08,
    position: "absolute",
    right: -32,
    top: -40,
    width: 160,
  },
  heroHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  name: {
    color: theme.colors.textPrimary,
    flex: 1,
    fontFamily: theme.fonts.sansBold,
    fontSize: 30,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  entryFeeBadge: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.brandDim,
    borderColor: theme.colors.brand,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  entryFeeText: {
    color: theme.colors.brandMuted,
    fontFamily: theme.fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
  address: {
    ...theme.type.label,
    color: theme.colors.brandMuted,
  },
  notes: {
    ...theme.type.body,
    color: theme.colors.textSecondary,
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
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...theme.glow.brand,
  },
  primaryActionText: {
    color: theme.colors.textOnBrand,
    fontFamily: theme.fonts.sansBold,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryActionText: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.sansBold,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  metaCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: 80,
    padding: theme.spacing.sm,
  },
  metaValue: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.sansBold,
    fontSize: 20,
    lineHeight: 24,
  },
  metaLabel: {
    ...theme.type.tag,
    color: theme.colors.accentMuted,
    textTransform: "uppercase",
  },

  // ── Contact & links ──────────────────────────────────────────────────────────
  linkList: {
    gap: 2,
  },
  linkRow: {
    alignItems: "center",
    borderRadius: theme.radius.sm,
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  linkIcon: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  linkText: {
    ...theme.type.bodyMedium,
    color: theme.colors.textPrimary,
    flex: 1,
  },

  // ── Hours ────────────────────────────────────────────────────────────────────
  hoursTable: {
    gap: 2,
  },
  hoursRow: {
    alignItems: "center",
    borderRadius: theme.radius.xs,
    flexDirection: "row",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 7,
  },
  hoursRowToday: {
    backgroundColor: theme.colors.accentDim,
  },
  hoursDay: {
    ...theme.type.bodyMedium,
    color: theme.colors.textSecondary,
    width: 40,
  },
  hoursDayToday: {
    color: theme.colors.accent,
  },
  hoursTime: {
    ...theme.type.mono,
    color: theme.colors.textPrimary,
  },
  hoursTimeToday: {
    color: theme.colors.accent,
  },
  hoursClosed: {
    ...theme.type.mono,
    color: theme.colors.textMuted,
  },

  // ── CTA panel ────────────────────────────────────────────────────────────────
  ctaPanel: {
    gap: theme.spacing.sm,
  },
  ctaSecondaryRow: {
    flexDirection: "row",
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
  ctaCardFlex: {
    flex: 1,
  },
  ctaCardPrimary: {
    backgroundColor: theme.colors.brandDim,
    borderColor: theme.colors.brand,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: 4,
    padding: theme.spacing.md,
  },
  ctaEyebrow: {
    color: theme.colors.accentMuted,
    fontFamily: theme.fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  ctaTitle: {
    ...theme.type.heading,
    color: theme.colors.textPrimary,
  },
  ctaText: {
    ...theme.type.caption,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },

  // ── Shared panel ─────────────────────────────────────────────────────────────
  panel: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  sectionTitle: {
    ...theme.type.title,
    color: theme.colors.textPrimary,
  },

  // ── Detail grid ──────────────────────────────────────────────────────────────
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

  // ── Inventory toolbar ────────────────────────────────────────────────────────
  inventoryToolbar: {
    gap: theme.spacing.sm,
  },
  inventorySearchInput: {
    backgroundColor: theme.colors.backgroundElevated,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.sans,
    fontSize: 14,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  filterChip: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  filterChipSelected: {
    backgroundColor: theme.colors.brandDim,
    borderColor: theme.colors.brand,
  },
  filterChipText: {
    ...theme.type.label,
    color: theme.colors.textSecondary,
  },
  filterChipTextSelected: {
    color: theme.colors.brandMuted,
  },
  inventoryMetaBar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  inventoryResultMeta: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
  },
  densitySwitchRow: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  densitySymbol: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 18,
  },
  densitySymbolActive: {
    color: theme.colors.accent,
  },

  // ── Inventory list ───────────────────────────────────────────────────────────
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
  inventoryCardDense: {
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inventoryTitleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  inventoryTitleRowDense: {
    alignItems: "center",
  },
  inventoryTitleBlock: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
  inventoryTitle: {
    ...theme.type.heading,
    color: theme.colors.textPrimary,
  },
  inventoryTitleDense: {
    ...theme.type.bodyMedium,
  },
  machineLabel: {
    ...theme.type.monoSmall,
    color: theme.colors.accentMuted,
  },
  inventoryMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  inventoryMeta: {
    ...theme.type.body,
    color: theme.colors.textSecondary,
  },
  inventoryMetaDense: {
    ...theme.type.monoSmall,
    color: theme.colors.textMuted,
  },
  statusPill: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    fontFamily: theme.fonts.sansBold,
    fontSize: 10,
    letterSpacing: 0.8,
    lineHeight: 14,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  statusPillDense: {
    fontSize: 9,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  inventoryNote: {
    ...theme.type.body,
    color: theme.colors.textMuted,
  },
  confidenceNote: {
    ...theme.type.monoSmall,
    color: theme.colors.textMuted,
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
    fontFamily: theme.fonts.sansBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  emptyInventoryText: {
    ...theme.type.body,
    color: theme.colors.textSecondary,
  },
  reportActionBlock: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  reportActionLabel: {
    color: theme.colors.accentMuted,
    fontFamily: theme.fonts.sansBold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  reportActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  reportActionChip: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  reportActionChipText: {
    ...theme.type.label,
    color: theme.colors.textPrimary,
  },
});
