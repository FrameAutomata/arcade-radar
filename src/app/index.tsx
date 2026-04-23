import * as Location from "expo-location";
import { Link } from "expo-router";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
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
import { theme } from "@/constants/theme";
import { featuredGames as mockFeaturedGames } from "@/data/mock-data";
import { hasSupabaseCredentials } from "@/lib/env";
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
import type { Game, NearbyVenueResult } from "@/types/domain";

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1100;
  const [isMapInteracting, setIsMapInteracting] = useState(false);
  const [userLocation, setUserLocation] =
    useState<Coordinates>(defaultUserLocation);
  const [locationLabel, setLocationLabel] = useState(demoLocationLabel);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [manualLocationQuery, setManualLocationQuery] = useState("");
  const [isApplyingManualLocation, setIsApplyingManualLocation] =
    useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [featuredGames, setFeaturedGames] = useState<Game[]>(mockFeaturedGames);
  const [suggestions, setSuggestions] = useState<Game[]>(mockFeaturedGames);
  const [results, setResults] = useState<NearbyVenueResult[]>([]);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(true);
  const deferredQuery = useDeferredValue(searchQuery);

  const game = selectedGame;
  const scoutLinkStyle = StyleSheet.flatten([
    styles.marqueePill,
    styles.marqueePillAction,
  ]) as ViewStyle;
  const authLinkStyle = StyleSheet.flatten([
    styles.marqueePill,
    styles.marqueePillSecondary,
  ]) as ViewStyle;
  const mapRegion = useMemo(
    () =>
      buildMapRegion(
        userLocation,
        results.map((result) => ({
          latitude: result.venue.latitude,
          longitude: result.venue.longitude,
        })),
      ),
    [results, userLocation],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadFeaturedGames() {
      try {
        const nextFeaturedGames = await getFeaturedGamesLive();

        if (!cancelled && nextFeaturedGames.length > 0) {
          setFeaturedGames(nextFeaturedGames);
          setSuggestions((currentSuggestions) =>
            searchQuery.trim() ? currentSuggestions : nextFeaturedGames,
          );
        }
      } catch {
        if (!cancelled) {
          setFeaturedGames(mockFeaturedGames);
        }
      }
    }

    void loadFeaturedGames();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSuggestions() {
      const normalizedQuery = deferredQuery.trim();

      if (!normalizedQuery) {
        setSuggestions(featuredGames);
        return;
      }

      try {
        const nextSuggestions = await searchGamesLive(normalizedQuery);

        if (!cancelled) {
          setSuggestions(nextSuggestions);
        }
      } catch {
        if (!cancelled) {
          setSuggestions(featuredGames);
        }
      }
    }

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [deferredQuery, featuredGames]);

  useEffect(() => {
    let cancelled = false;

    async function loadResults() {
      setIsLoadingResults(true);
      setResultsError(null);

      try {
        const nextResults = game
          ? await findVenueMatchesLive(game, userLocation)
          : await findNearbyVenuesLive(userLocation);

        if (!cancelled) {
          setResults(nextResults);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setResultsError(
            "Could not load live arcade data yet. Check your Supabase schema and seed data.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingResults(false);
        }
      }
    }

    void loadResults();

    return () => {
      cancelled = true;
    };
  }, [game, userLocation]);

  const pins = [
    {
      id: "user-location",
      coordinate: userLocation,
      isUserLocation: true,
      title: "You are here",
    },
    ...results.map((result) => ({
      id: result.venue.id,
      coordinate: {
        latitude: result.venue.latitude,
        longitude: result.venue.longitude,
      },
      description: `${result.venue.address}, ${result.venue.city}`,
      title: result.venue.name,
    })),
  ];

  function handlePinPress(pinId: string) {
    if (pinId === "user-location") {
      return;
    }

    setSelectedVenueId(pinId);

    const tappedResult = results.find((result) => result.venue.id === pinId);

    if (!tappedResult) {
      return;
    }

    void openDirections({
      address: `${tappedResult.venue.address}, ${tappedResult.venue.city}, ${tappedResult.venue.region}`,
      destination: {
        latitude: tappedResult.venue.latitude,
        longitude: tappedResult.venue.longitude,
      },
      label: `${tappedResult.venue.name}, ${tappedResult.venue.address}, ${tappedResult.venue.city}`,
    });
  }

  async function requestLocation() {
    setIsLocating(true);
    setLocationError(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        setLocationError(
          "Location access was denied. Still using the demo location.",
        );
        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserLocation({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      });
      setLocationLabel("Using your current location");
    } catch {
      setLocationError(
        "Could not read your location yet. Still using the demo location.",
      );
    } finally {
      setIsLocating(false);
    }
  }

  async function applyManualLocation() {
    const trimmedQuery = manualLocationQuery.trim();

    if (!trimmedQuery) {
      setLocationError(
        "Enter an address or ZIP code to update the search area.",
      );
      return;
    }

    setIsApplyingManualLocation(true);
    setLocationError(null);

    try {
      const manualLocation = await resolveAppLocation(trimmedQuery);

      if (!manualLocation) {
        setLocationError("Could not find that address or ZIP code yet.");
        return;
      }

      setUserLocation(manualLocation.coordinates);
      setLocationLabel(manualLocation.label);
    } finally {
      setIsApplyingManualLocation(false);
    }
  }

  function selectGame(game: Game) {
    startTransition(() => {
      setSelectedGame(game);
      setSearchQuery(game.title);
    });
  }

  function updateSearch(value: string) {
    startTransition(() => {
      setSearchQuery(value);
      setSelectedGame(null);
    });
  }

  function clearFilter() {
    startTransition(() => {
      setSelectedGame(null);
      setSearchQuery("");
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWideLayout && styles.contentWide,
        ]}
        scrollEnabled={Platform.OS === "web" ? true : !isMapInteracting}
      >
        <View style={styles.marqueeRow}>
          <View style={styles.marqueePill}>
            <Text style={styles.marqueeText}>Arcade Radar</Text>
          </View>
          <View style={[styles.marqueePill, styles.marqueePillSecondary]}>
            <Text style={styles.marqueeText}>
              Retro signal, practical search
            </Text>
          </View>
          <Link href="./scout" asChild>
            <Pressable style={scoutLinkStyle}>
              <Text style={styles.marqueeText}>Scout mode</Text>
            </Pressable>
          </Link>
          <Link href="./auth" asChild>
            <Pressable style={authLinkStyle}>
              <Text style={styles.marqueeText}>Sign in</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.eyebrow}>Nearby first, game filter second</Text>
          <Text style={styles.title}>
            Find arcades near you and filter the same map by game.
          </Text>
          <Text style={styles.description}>
            Arcade Radar is built to feel fast and useful first, with just
            enough retro-futurist energy to make every search feel like tuning
            into a lost local signal from arcade culture.
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{results.length}</Text>
              <Text style={styles.heroStatLabel}>visible arcades</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>
                {game ? game.title : "All games"}
              </Text>
              <Text style={styles.heroStatLabel}>active filter</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.locationHeader}>
            <View style={styles.locationCopy}>
              <Text style={styles.sectionTitle}>Search your area</Text>
              <Text style={styles.locationText}>{locationLabel}</Text>
            </View>
            <Pressable
              disabled={isLocating}
              onPress={requestLocation}
              style={styles.locationButton}
            >
              <Text style={styles.locationButtonText}>
                {isLocating ? "Locating..." : "Use my location"}
              </Text>
            </Pressable>
          </View>

          {locationError ? (
            <Text style={styles.warningText}>{locationError}</Text>
          ) : null}
          {resultsError ? (
            <Text style={styles.warningText}>{resultsError}</Text>
          ) : null}

          <View style={styles.manualLocationWrap}>
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={setManualLocationQuery}
              placeholder="Enter an address or ZIP code"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              value={manualLocationQuery}
            />
            <Pressable
              disabled={isApplyingManualLocation}
              onPress={applyManualLocation}
              style={[
                styles.secondaryButton,
                isApplyingManualLocation && styles.secondaryButtonDisabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {isApplyingManualLocation ? "Applying..." : "Apply location"}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.helperText}>
            Try a street address or ZIP code like `60647`, `60513`, or `9415
            Ogden Ave`.
          </Text>

          <View style={styles.filterHeader}>
            <Text style={styles.sectionTitle}>Game filter</Text>
            {game ? (
              <Pressable onPress={clearFilter} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>All arcades</Text>
              </Pressable>
            ) : null}
          </View>

          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={updateSearch}
            placeholder="Search for a game like DDR or Marvel vs. Capcom 2"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            value={searchQuery}
          />

          <View style={styles.chipRow}>
            {(searchQuery.trim() ? suggestions : featuredGames).map(
              (suggestion) => (
                <Pressable
                  key={suggestion.id}
                  onPress={() => selectGame(suggestion)}
                  style={[
                    styles.chip,
                    Platform.OS === "web" && styles.chipWeb,
                    game?.id === suggestion.id && styles.chipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipTitle,
                      game?.id === suggestion.id && styles.chipTitleSelected,
                    ]}
                  >
                    {suggestion.title}
                  </Text>
                  <Text style={styles.chipMeta}>
                    {suggestion.manufacturer} • {suggestion.releaseYear}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
        </View>

        <View
          style={[styles.resultsGrid, isWideLayout && styles.resultsGridWide]}
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
              height={isWideLayout ? 420 : 320}
              onMapInteractionChange={setIsMapInteracting}
              onPinPress={handlePinPress}
              pins={pins}
              region={mapRegion}
              selectedPinId={selectedVenueId}
            />

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{results.length}</Text>
                <Text style={styles.summaryLabel}>
                  {game ? "matching arcades" : "nearby arcades"}
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {results[0]
                    ? formatDistanceMiles(results[0].distanceMiles)
                    : "--"}
                </Text>
                <Text style={styles.summaryLabel}>closest distance</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {hasSupabaseCredentials ? "Supabase" : "Mock"}
                </Text>
                <Text style={styles.summaryLabel}>data source</Text>
              </View>
            </View>

            <Text style={styles.mapHint}>
              {isLoadingResults
                ? "Loading nearby arcade data..."
                : game
                ? `Showing only arcades with ${game.title}.`
                : "Showing every nearby arcade from the current data source."}
            </Text>
          </View>

          <View
            style={[
              styles.panel,
              styles.listPanel,
              isWideLayout && styles.listPanelWide,
            ]}
          >
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Arcades</Text>
              <Text style={styles.listMeta}>OpenStreetMap-based map view</Text>
            </View>

            {isLoadingResults ? (
              <Text style={styles.emptyText}>Loading arcades...</Text>
            ) : results.length > 0 ? (
              <View style={styles.resultsList}>
                {results.map((result) => (
                  <ResultCard
                    key={result.venue.id}
                    result={result}
                    selected={selectedVenueId === result.venue.id}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                {game
                  ? "No arcades currently match this game near the selected location."
                  : "No nearby arcades were found for the selected location."}
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
  marqueePillAction: {
    borderColor: theme.colors.brand,
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
    position: "relative",
    overflow: "hidden",
  },
  heroGlow: {
    backgroundColor: theme.colors.highlight,
    borderRadius: 999,
    height: 160,
    opacity: 0.12,
    position: "absolute",
    right: -30,
    top: -30,
    width: 160,
  },
  eyebrow: {
    color: theme.colors.brandMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 40,
    fontWeight: "800",
    lineHeight: 44,
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  heroStat: {
    backgroundColor: "rgba(8, 15, 30, 0.72)",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexGrow: 1,
    gap: 4,
    minWidth: 180,
    padding: theme.spacing.md,
  },
  heroStatValue: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "800",
  },
  heroStatLabel: {
    color: theme.colors.accentMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
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
  listMeta: {
    color: theme.colors.accentMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
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
