import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { Link, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  startTransition,
} from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import type { ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppMap } from "@/components/app-map";
import { ResultCard } from "@/components/result-card";
import { BREAKPOINTS, theme } from "@/constants/theme";
import { featuredGames as mockFeaturedGames } from "@/data/mock-data";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceMiles } from "@/lib/format";
import { resolveAppLocation } from "@/lib/geocoding";
import { buildMapRegion, type Coordinates } from "@/lib/geo";
import {
  defaultUserLocation,
  findNearbyVenuesLive,
  findVenueMatchesLive,
  getFeaturedGamesLive,
  searchGamesLive,
} from "@/lib/live-data";
import { openDirections } from "@/lib/navigation";
import { demoLocationLabel } from "@/lib/search";
import type { Game } from "@/types/domain";

const DISTANCE_FILTERS_MILES = [10, 25, 50, 100, 250] as const;
const DEFAULT_DISTANCE_FILTER_MILES = 50;

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

interface HomeState {
  distanceFilterMiles: number;
  isApplyingManualLocation: boolean;
  isLocating: boolean;
  isMapInteracting: boolean;
  locationError: string | null;
  locationLabel: string;
  manualLocationQuery: string;
  searchQuery: string;
  selectedGame: Game | null;
  selectedVenueId: string | null;
  userLocation: Coordinates;
}

type HomeAction =
  | { type: "DISTANCE_FILTER_CHANGE"; miles: number }
  | { type: "GAME_CLEAR" }
  | { type: "GAME_SELECT"; game: Game }
  | { type: "LOCATING_END" }
  | { type: "LOCATING_START" }
  | { type: "LOCATION_ERROR"; error: string }
  | { type: "LOCATION_SET"; coordinates: Coordinates; label: string }
  | { type: "MANUAL_LOCATION_APPLYING_END" }
  | { type: "MANUAL_LOCATION_APPLYING_START" }
  | { type: "MANUAL_LOCATION_QUERY_CHANGE"; query: string }
  | { type: "MAP_INTERACTION_CHANGE"; isInteracting: boolean }
  | { type: "SEARCH_QUERY_CHANGE"; query: string }
  | { type: "VENUE_SELECT"; venueId: string | null };

const initialState: HomeState = {
  distanceFilterMiles: DEFAULT_DISTANCE_FILTER_MILES,
  isApplyingManualLocation: false,
  isLocating: false,
  isMapInteracting: false,
  locationError: null,
  locationLabel: demoLocationLabel,
  manualLocationQuery: "",
  searchQuery: "",
  selectedGame: null,
  selectedVenueId: null,
  userLocation: defaultUserLocation,
};

function homeReducer(state: HomeState, action: HomeAction): HomeState {
  switch (action.type) {
    case "DISTANCE_FILTER_CHANGE":
      return { ...state, distanceFilterMiles: action.miles };
    case "GAME_CLEAR":
      return { ...state, searchQuery: "", selectedGame: null };
    case "GAME_SELECT":
      return { ...state, searchQuery: action.game.title, selectedGame: action.game };
    case "LOCATING_END":
      return { ...state, isLocating: false };
    case "LOCATING_START":
      return { ...state, isLocating: true, locationError: null };
    case "LOCATION_ERROR":
      return { ...state, locationError: action.error };
    case "LOCATION_SET":
      return { ...state, locationError: null, locationLabel: action.label, userLocation: action.coordinates };
    case "MANUAL_LOCATION_APPLYING_END":
      return { ...state, isApplyingManualLocation: false };
    case "MANUAL_LOCATION_APPLYING_START":
      return { ...state, isApplyingManualLocation: true, locationError: null };
    case "MANUAL_LOCATION_QUERY_CHANGE":
      return { ...state, manualLocationQuery: action.query };
    case "MAP_INTERACTION_CHANGE":
      return { ...state, isMapInteracting: action.isInteracting };
    case "SEARCH_QUERY_CHANGE":
      return { ...state, searchQuery: action.query, selectedGame: null };
    case "VENUE_SELECT":
      return { ...state, selectedVenueId: action.venueId };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const params = useLocalSearchParams<{ game?: string; location?: string }>();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= BREAKPOINTS.wide;
  const { session: authSession } = useAuth();
  const [state, dispatch] = useReducer(homeReducer, initialState);
  const {
    distanceFilterMiles,
    isApplyingManualLocation,
    isLocating,
    isMapInteracting,
    locationError,
    locationLabel,
    manualLocationQuery,
    searchQuery,
    selectedGame,
    selectedVenueId,
    userLocation,
  } = state;

  const appliedDemoParamsRef = useRef<string | null>(null);
  const deferredQuery = useDeferredValue(searchQuery);

  // ── Data queries ──────────────────────────────────────────────────────────

  const { data: featuredGames = mockFeaturedGames } = useQuery<Game[]>({
    queryFn: () => getFeaturedGamesLive(),
    queryKey: ["featuredGames"],
    staleTime: 5 * 60_000,
  });

  const { data: gameSuggestions } = useQuery<Game[]>({
    enabled: deferredQuery.trim().length > 0,
    queryFn: () => searchGamesLive(deferredQuery.trim()),
    queryKey: ["gameSuggestions", deferredQuery.trim()],
  });

  const {
    data: results = [],
    error: resultsError,
    isFetching: isLoadingResults,
  } = useQuery({
    queryFn: () =>
      selectedGame
        ? findVenueMatchesLive(selectedGame, userLocation, distanceFilterMiles)
        : findNearbyVenuesLive(userLocation, distanceFilterMiles),
    queryKey: ["venueResults", selectedGame?.id ?? null, userLocation, distanceFilterMiles],
  });

  // ── One-shot: apply device GPS on mount (native only) ────────────────────

  useEffect(() => {
    if (Platform.OS === "web") return;

    let cancelled = false;

    async function applyDeviceLocation() {
      try {
        const existing = await Location.getForegroundPermissionsAsync();
        if (existing.status !== "granted") return;

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!cancelled) {
          dispatch({
            type: "LOCATION_SET",
            coordinates: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
            label: "Using your current location",
          });
        }
      } catch {
        // silently fall back to demo location
      }
    }

    void applyDeviceLocation();
    return () => { cancelled = true; };
  }, []);

  // ── Demo params ───────────────────────────────────────────────────────────

  useEffect(() => {
    const paramLocation = typeof params.location === "string" ? params.location.trim() : "";
    const paramGame = typeof params.game === "string" ? params.game.trim() : "";
    const paramKey = `${paramLocation}|${paramGame}`;

    if ((!paramLocation && !paramGame) || appliedDemoParamsRef.current === paramKey) return;

    let cancelled = false;

    async function applyDemoParams() {
      appliedDemoParamsRef.current = paramKey;

      if (paramLocation) {
        dispatch({ type: "MANUAL_LOCATION_QUERY_CHANGE", query: paramLocation });
        dispatch({ type: "MANUAL_LOCATION_APPLYING_START" });

        try {
          const resolved = await resolveAppLocation(paramLocation);
          if (!cancelled) {
            if (resolved) {
              dispatch({ type: "LOCATION_SET", coordinates: resolved.coordinates, label: resolved.label });
            } else {
              dispatch({ type: "LOCATION_ERROR", error: "Could not find that demo ZIP code yet." });
            }
          }
        } catch {
          if (!cancelled) dispatch({ type: "LOCATION_ERROR", error: "Could not apply that demo ZIP code right now." });
        } finally {
          if (!cancelled) dispatch({ type: "MANUAL_LOCATION_APPLYING_END" });
        }
      }

      if (paramGame) {
        startTransition(() => dispatch({ type: "SEARCH_QUERY_CHANGE", query: paramGame }));

        try {
          const [matched] = await searchGamesLive(paramGame, 1);
          if (!cancelled && matched) {
            startTransition(() => dispatch({ type: "GAME_SELECT", game: matched }));
          }
        } catch {
          // ignore demo game search failure
        }
      }
    }

    void applyDemoParams();
    return () => { cancelled = true; };
  }, [params.game, params.location]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const mapRegion = useMemo(
    () =>
      buildMapRegion(
        userLocation,
        results.map((r) => ({ latitude: r.venue.latitude, longitude: r.venue.longitude })),
      ),
    [results, userLocation],
  );

  const pins = useMemo(
    () => [
      { id: "user-location", coordinate: userLocation, isUserLocation: true, title: "You are here" },
      ...results.map((r) => ({
        id: r.venue.id,
        coordinate: { latitude: r.venue.latitude, longitude: r.venue.longitude },
        description: `${r.venue.address}, ${r.venue.city}`,
        title: r.venue.name,
      })),
    ],
    [results, userLocation],
  );

  const visibleSuggestions = deferredQuery.trim() ? (gameSuggestions ?? featuredGames) : featuredGames;

  const scoutLinkStyle = StyleSheet.flatten([styles.navButton, styles.navButtonSecondary]) as ViewStyle;
  const authLinkStyle = StyleSheet.flatten([styles.navButton, authSession && styles.navButtonActive]) as ViewStyle;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handlePinPress(pinId: string) {
    if (pinId === "user-location") {
      dispatch({ type: "VENUE_SELECT", venueId: null });
      return;
    }

    const tapped = results.find((r) => r.venue.id === pinId);
    if (!tapped) return;

    if (selectedVenueId !== pinId) {
      dispatch({ type: "VENUE_SELECT", venueId: pinId });
      return;
    }

    void openDirections({
      address: `${tapped.venue.address}, ${tapped.venue.city}, ${tapped.venue.region}`,
      destination: { latitude: tapped.venue.latitude, longitude: tapped.venue.longitude },
      label: `${tapped.venue.name}, ${tapped.venue.address}, ${tapped.venue.city}`,
    });
  }

  async function requestLocation() {
    dispatch({ type: "LOCATING_START" });

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        dispatch({ type: "LOCATION_ERROR", error: "Location access was denied. Still using the demo location." });
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      dispatch({
        type: "LOCATION_SET",
        coordinates: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        label: "Using your current location",
      });
    } catch {
      dispatch({ type: "LOCATION_ERROR", error: "Could not read your location yet. Still using the demo location." });
    } finally {
      dispatch({ type: "LOCATING_END" });
    }
  }

  async function applyManualLocation() {
    const trimmed = manualLocationQuery.trim();

    if (!trimmed) {
      dispatch({ type: "LOCATION_ERROR", error: "Enter an address or ZIP code to update the search area." });
      return;
    }

    dispatch({ type: "MANUAL_LOCATION_APPLYING_START" });

    try {
      const resolved = await resolveAppLocation(trimmed);

      if (!resolved) {
        dispatch({ type: "LOCATION_ERROR", error: "Could not find that address or ZIP code yet." });
        return;
      }

      dispatch({ type: "LOCATION_SET", coordinates: resolved.coordinates, label: resolved.label });
    } finally {
      dispatch({ type: "MANUAL_LOCATION_APPLYING_END" });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.content, isWideLayout && styles.contentWide]}
        scrollEnabled={Platform.OS === "web" ? true : !isMapInteracting}
      >
        <View style={styles.topActions}>
          <Link href="./demo" asChild>
            <Pressable style={scoutLinkStyle}>
              <Text style={styles.navButtonText}>Demo</Text>
            </Pressable>
          </Link>
          <Link href="./scout" asChild>
            <Pressable style={scoutLinkStyle}>
              <Text style={styles.navButtonText}>Scout</Text>
            </Pressable>
          </Link>
          <Link href="./auth" asChild>
            <Pressable style={authLinkStyle}>
              <Text style={styles.navButtonText}>
                {authSession ? "Account & sign out" : "Sign in"}
              </Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.panel}>
          <View style={styles.locationHeader}>
            <View style={styles.locationCopy}>
              <Text style={styles.sectionTitle}>Search your area</Text>
              <Text style={styles.locationText}>{locationLabel}</Text>
            </View>
            <Pressable disabled={isLocating} onPress={requestLocation} style={styles.locationButton}>
              <Text style={styles.locationButtonText}>
                {isLocating ? "Locating..." : "Use my location"}
              </Text>
            </Pressable>
          </View>

          {locationError ? <Text style={styles.warningText}>{locationError}</Text> : null}
          {resultsError ? (
            <Text style={styles.warningText}>
              Could not load arcade data right now. Try again in a moment.
            </Text>
          ) : null}

          <View style={styles.manualLocationWrap}>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={(q) => dispatch({ type: "MANUAL_LOCATION_QUERY_CHANGE", query: q })}
              placeholder="Enter an address or ZIP code"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              value={manualLocationQuery}
            />
            <Pressable
              disabled={isApplyingManualLocation}
              onPress={applyManualLocation}
              style={[styles.secondaryButton, isApplyingManualLocation && styles.secondaryButtonDisabled]}
            >
              <Text style={styles.secondaryButtonText}>
                {isApplyingManualLocation ? "Applying..." : "Apply location"}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.helperText}>
            Try a street address or ZIP code like `60647`, `60513`, or `9415 Ogden Ave`.
          </Text>

          <View style={styles.distanceFilterBlock}>
            <View style={styles.filterHeader}>
              <Text style={styles.sectionTitle}>Distance</Text>
              <Text style={styles.distanceMeta}>Within {distanceFilterMiles} mi</Text>
            </View>
            <View style={styles.distanceChipRow}>
              {DISTANCE_FILTERS_MILES.map((miles) => (
                <Pressable
                  key={miles}
                  onPress={() => dispatch({ type: "DISTANCE_FILTER_CHANGE", miles })}
                  style={[styles.distanceChip, distanceFilterMiles === miles && styles.distanceChipSelected]}
                >
                  <Text style={[styles.distanceChipText, distanceFilterMiles === miles && styles.distanceChipTextSelected]}>
                    {miles} mi
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filterHeader}>
            <Text style={styles.sectionTitle}>Game filter</Text>
            {selectedGame ? (
              <Pressable onPress={() => dispatch({ type: "GAME_CLEAR" })} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>All arcades</Text>
              </Pressable>
            ) : null}
          </View>

          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={(q) => startTransition(() => dispatch({ type: "SEARCH_QUERY_CHANGE", query: q }))}
            placeholder="Search for a game like DDR or Marvel vs. Capcom 2"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            value={searchQuery}
          />

          <View style={styles.chipRow}>
            {visibleSuggestions.map((suggestion) => (
              <Pressable
                key={suggestion.id}
                onPress={() => startTransition(() => dispatch({ type: "GAME_SELECT", game: suggestion }))}
                style={[
                  styles.chip,
                  Platform.OS === "web" && styles.chipWeb,
                  selectedGame?.id === suggestion.id && styles.chipSelected,
                ]}
              >
                <Text style={[styles.chipTitle, selectedGame?.id === suggestion.id && styles.chipTitleSelected]}>
                  {suggestion.title}
                </Text>
                <Text style={styles.chipMeta}>{suggestion.manufacturer} • {suggestion.releaseYear}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.resultsGrid, isWideLayout && styles.resultsGridWide]}>
          <View style={[styles.panel, styles.mapPanel, isWideLayout && styles.mapPanelWide]}>
            <Text style={styles.sectionTitle}>Map</Text>
            <AppMap
              height={isWideLayout ? 420 : 320}
              onMapInteractionChange={(v) => dispatch({ type: "MAP_INTERACTION_CHANGE", isInteracting: v })}
              onPinPress={handlePinPress}
              pins={pins}
              region={mapRegion}
              selectedPinId={selectedVenueId}
            />

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{results.length}</Text>
                <Text style={styles.summaryLabel}>{selectedGame ? "matching arcades" : "nearby arcades"}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {results[0] ? formatDistanceMiles(results[0].distanceMiles) : "--"}
                </Text>
                <Text style={styles.summaryLabel}>closest distance</Text>
              </View>
            </View>

            <Text style={styles.mapHint}>
              {isLoadingResults
                ? "Loading nearby arcade data..."
                : selectedGame
                ? `Showing arcades within ${distanceFilterMiles} miles that have ${selectedGame.title}.`
                : `Showing arcades within ${distanceFilterMiles} miles.`}
            </Text>
          </View>

          <View style={[styles.panel, styles.listPanel, isWideLayout && styles.listPanelWide]}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Arcades</Text>
            </View>

            {isLoadingResults ? (
              <Text style={styles.emptyText}>Loading arcades...</Text>
            ) : results.length > 0 ? (
              <View style={styles.resultsList}>
                {results.map((result) => (
                  <ResultCard key={result.venue.id} result={result} selected={selectedVenueId === result.venue.id} />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                {selectedGame
                  ? `No arcades currently match this game within ${distanceFilterMiles} miles of the selected location.`
                  : `No nearby arcades were found within ${distanceFilterMiles} miles of the selected location.`}
              </Text>
            )}
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
  topActions: {
    justifyContent: "flex-end",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  navButton: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  navButtonSecondary: {
    borderColor: theme.colors.border,
  },
  navButtonActive: {
    borderColor: theme.colors.brand,
  },
  navButtonText: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
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
  locationHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
  },
  locationCopy: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  locationText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  locationButton: {
    backgroundColor: theme.colors.brand,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: theme.colors.brand,
    shadowOpacity: 0.3,
    shadowRadius: 14,
  },
  locationButtonText: {
    color: theme.colors.textOnBrand,
    fontSize: 13,
    fontWeight: "700",
  },
  warningText: {
    color: theme.colors.warning,
    fontSize: 13,
    lineHeight: 18,
  },
  manualLocationWrap: {
    gap: theme.spacing.sm,
  },
  filterHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  clearButton: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
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
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.accentMuted,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  secondaryButtonDisabled: {
    opacity: 0.7,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  helperText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  distanceFilterBlock: {
    gap: theme.spacing.sm,
  },
  distanceMeta: {
    color: theme.colors.accentMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  distanceChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  distanceChip: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  distanceChipSelected: {
    backgroundColor: theme.colors.surfaceStrong,
    borderColor: theme.colors.brand,
  },
  distanceChipText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  distanceChipTextSelected: {
    color: theme.colors.brandMuted,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  chip: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 4,
    padding: theme.spacing.md,
  },
  chipWeb: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 260,
    minWidth: 220,
  },
  chipSelected: {
    backgroundColor: theme.colors.surfaceStrong,
    borderColor: theme.colors.brand,
  },
  chipTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  chipTitleSelected: {
    color: theme.colors.brandMuted,
  },
  chipMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  summaryRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  summaryCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    borderColor: theme.colors.border,
    borderWidth: 1,
    flex: 1,
    gap: 4,
    padding: theme.spacing.md,
  },
  summaryValue: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  summaryLabel: {
    color: theme.colors.accentMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  mapHint: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  resultsGrid: {
    gap: theme.spacing.lg,
  },
  resultsGridWide: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  mapPanel: {
    width: "100%",
  },
  mapPanelWide: {
    flex: 1.1,
  },
  listPanel: {
    width: "100%",
  },
  listPanelWide: {
    alignSelf: "stretch",
    flex: 0.9,
  },
  listHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  resultsList: {
    gap: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
});
