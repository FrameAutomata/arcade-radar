import { Ionicons } from "@expo/vector-icons";
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
  useState,
  startTransition,
} from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppMap } from "@/components/app-map";
import { ResultCard } from "@/components/result-card";
import { BREAKPOINTS, theme } from "@/constants/theme";
import { featuredGames as mockFeaturedGames } from "@/data/mock-data";
import { formatDistanceMiles } from "@/lib/format";
import { resolveAppLocation } from "@/lib/geocoding";
import { buildMapRegion, type Coordinates } from "@/lib/geo";
import {
  findNearbyVenuesLive,
  findVenueMatchesLive,
  getFeaturedGamesLive,
  searchGamesLive,
} from "@/lib/live-data";
import { openDirections } from "@/lib/navigation";
import type { Game } from "@/types/domain";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortLocationLabel(label: string): string {
  if (label.toLowerCase().includes('current location')) return 'My location';
  const first = label.split(',')[0].trim();
  return first.length > 16 ? `${first.slice(0, 14)}…` : first;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DISTANCE_FILTERS_MILES = [10, 25, 50, 100, 250] as const;
const US_FALLBACK_REGION = { latitude: 39.5, longitude: -98.35, latitudeDelta: 60, longitudeDelta: 60 };
const DEFAULT_DISTANCE_FILTER_MILES = 50;
const SEARCH_BAR_H = 52;
const SHEET_PEEK_H = 108;
const INITIAL_SCREEN_H = Dimensions.get("window").height;
const SHEET_EXPANDED_H = Math.min(Math.round(INITIAL_SCREEN_H * 0.58), 520);
const SHEET_HIDDEN_Y = SHEET_EXPANDED_H - SHEET_PEEK_H;

// ─── Reducer ──────────────────────────────────────────────────────────────────

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
  userLocation: Coordinates | null;
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
  isLocating: true,
  isMapInteracting: false,
  locationError: null,
  locationLabel: "",
  manualLocationQuery: "",
  searchQuery: "",
  selectedGame: null,
  selectedVenueId: null,
  userLocation: null,
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RadarScreen() {
  const params = useLocalSearchParams<{ game?: string; location?: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWideLayout = windowWidth >= BREAKPOINTS.wide;
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

  const [showLocationInput, setShowLocationInput] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const appliedDemoParamsRef = useRef<string | null>(null);
  const deferredQuery = useDeferredValue(searchQuery);
  const dragStartY = useRef(SHEET_HIDDEN_Y);

  // ── Bottom sheet animation ─────────────────────────────────────────────────

  const sheetTranslateY = useRef(
    new Animated.Value(SHEET_HIDDEN_Y),
  ).current;

  function snapSheet(expand: boolean) {
    setSheetExpanded(expand);
    dragStartY.current = expand ? 0 : SHEET_HIDDEN_Y;
    Animated.spring(sheetTranslateY, {
      toValue: expand ? 0 : SHEET_HIDDEN_Y,
      useNativeDriver: true,
      damping: 22,
      mass: 0.9,
      stiffness: 240,
    }).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 6,
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation((v) => {
          dragStartY.current = v;
        });
      },
      onPanResponderMove: (_, { dy }) => {
        const next = Math.max(0, Math.min(SHEET_HIDDEN_Y, dragStartY.current + dy));
        sheetTranslateY.setValue(next);
      },
      onPanResponderRelease: (_, { vy, dy }) => {
        const approxCurrent = dragStartY.current + dy;
        const shouldExpand =
          vy < -0.4 || (Math.abs(vy) <= 0.4 && approxCurrent < SHEET_HIDDEN_Y * 0.5);
        const target = shouldExpand ? 0 : SHEET_HIDDEN_Y;
        setSheetExpanded(shouldExpand);
        dragStartY.current = target;
        Animated.spring(sheetTranslateY, {
          toValue: target,
          useNativeDriver: true,
          damping: 22,
          mass: 0.9,
          stiffness: 240,
        }).start();
      },
    }),
  ).current;

  // ── Data queries ──────────────────────────────────────────────────────────

  const { data: featuredGames = mockFeaturedGames } = useQuery<Game[]>({
    queryFn: () => getFeaturedGamesLive(),
    queryKey: ["featuredGames"],
    staleTime: 5 * 60_000,
  });

  const { data: gameSuggestions } = useQuery<Game[]>({
    enabled: deferredQuery.trim().length > 0 && !selectedGame,
    queryFn: () => searchGamesLive(deferredQuery.trim()),
    queryKey: ["gameSuggestions", deferredQuery.trim()],
  });

  const {
    data: results = [],
    error: resultsError,
    isFetching: isLoadingResults,
  } = useQuery({
    enabled: userLocation !== null,
    queryFn: () =>
      selectedGame
        ? findVenueMatchesLive(selectedGame, userLocation!, distanceFilterMiles)
        : findNearbyVenuesLive(userLocation!, distanceFilterMiles),
    queryKey: ["venueResults", selectedGame?.id ?? null, userLocation, distanceFilterMiles],
  });

  // ── Device GPS on mount ───────────────────────────────────────────────────

  useEffect(() => {
    if (Platform.OS === "web") {
      dispatch({ type: "LOCATING_END" });
      return;
    }
    let cancelled = false;
    async function initLocation() {
      dispatch({ type: "LOCATING_START" });
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (permission.status !== "granted") {
          dispatch({ type: "LOCATION_ERROR", error: "Location access denied. Enter an address above to search nearby arcades." });
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          dispatch({
            type: "LOCATION_SET",
            coordinates: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
            label: "Using your current location",
          });
        }
      } catch {
        if (!cancelled) dispatch({ type: "LOCATION_ERROR", error: "Could not get your location. Enter an address above to search nearby arcades." });
      } finally {
        if (!cancelled) dispatch({ type: "LOCATING_END" });
      }
    }
    void initLocation();
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
            if (resolved) dispatch({ type: "LOCATION_SET", coordinates: resolved.coordinates, label: resolved.label });
            else dispatch({ type: "LOCATION_ERROR", error: "Could not find that demo ZIP code." });
          }
        } catch {
          if (!cancelled) dispatch({ type: "LOCATION_ERROR", error: "Could not apply that demo ZIP code." });
        } finally {
          if (!cancelled) dispatch({ type: "MANUAL_LOCATION_APPLYING_END" });
        }
      }
      if (paramGame) {
        startTransition(() => dispatch({ type: "SEARCH_QUERY_CHANGE", query: paramGame }));
        try {
          const [matched] = await searchGamesLive(paramGame, 1);
          if (!cancelled && matched) startTransition(() => dispatch({ type: "GAME_SELECT", game: matched }));
        } catch { /* ignore */ }
      }
    }
    void applyDemoParams();
    return () => { cancelled = true; };
  }, [params.game, params.location]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const mapRegion = useMemo(
    () => userLocation
      ? buildMapRegion(
          userLocation,
          results.map((r) => ({ latitude: r.venue.latitude, longitude: r.venue.longitude })),
        )
      : US_FALLBACK_REGION,
    [results, userLocation],
  );

  const pins = useMemo(
    () => [
      ...(userLocation ? [{ id: "user-location", coordinate: userLocation, isUserLocation: true, title: "You" }] : []),
      ...results.map((r) => ({
        id: r.venue.id,
        coordinate: { latitude: r.venue.latitude, longitude: r.venue.longitude },
        description: `${r.venue.address}, ${r.venue.city}`,
        title: r.venue.name,
      })),
    ],
    [results, userLocation],
  );

  const showDropdown = deferredQuery.trim().length > 0 && !selectedGame;
  const dropdownGames = showDropdown ? (gameSuggestions ?? []) : featuredGames;
  const pillLabel = userLocation === null
    ? (isLocating ? "Locating…" : "Set location")
    : shortLocationLabel(locationLabel);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const selectedVenueResult = selectedVenueId
    ? (results.find((r) => r.venue.id === selectedVenueId) ?? null)
    : null;

  function handlePinPress(pinId: string) {
    if (pinId === "user-location") {
      dispatch({ type: "VENUE_SELECT", venueId: null });
      snapSheet(false);
      return;
    }
    const tapped = results.find((r) => r.venue.id === pinId);
    if (!tapped) return;
    if (selectedVenueId !== pinId) {
      dispatch({ type: "VENUE_SELECT", venueId: pinId });
      snapSheet(false);
      return;
    }
    void openDirections({
      address: `${tapped.venue.address}, ${tapped.venue.city}, ${tapped.venue.region}`,
      destination: { latitude: tapped.venue.latitude, longitude: tapped.venue.longitude },
      label: `${tapped.venue.name}, ${tapped.venue.address}, ${tapped.venue.city}`,
    });
  }

  function dismissVenue() {
    dispatch({ type: "VENUE_SELECT", venueId: null });
    snapSheet(false);
  }

  async function requestLocation() {
    dispatch({ type: "LOCATING_START" });
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        dispatch({ type: "LOCATION_ERROR", error: "Location access denied. Enter an address to search nearby arcades." });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      dispatch({
        type: "LOCATION_SET",
        coordinates: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        label: "Using your current location",
      });
    } catch {
      dispatch({ type: "LOCATION_ERROR", error: "Could not read your location. Enter an address to search nearby arcades." });
    } finally {
      dispatch({ type: "LOCATING_END" });
    }
  }

  async function applyManualLocation() {
    const trimmed = manualLocationQuery.trim();
    if (!trimmed) {
      dispatch({ type: "LOCATION_ERROR", error: "Enter an address or ZIP code." });
      return;
    }
    dispatch({ type: "MANUAL_LOCATION_APPLYING_START" });
    try {
      const resolved = await resolveAppLocation(trimmed);
      if (!resolved) {
        dispatch({ type: "LOCATION_ERROR", error: "Could not find that address or ZIP code." });
        return;
      }
      dispatch({ type: "LOCATION_SET", coordinates: resolved.coordinates, label: resolved.label });
      setShowLocationInput(false);
    } finally {
      dispatch({ type: "MANUAL_LOCATION_APPLYING_END" });
    }
  }

  // ── Web layout ────────────────────────────────────────────────────────────

  if (Platform.OS === "web") {
    return (
      <View style={styles.webRoot}>
        {/* Left panel */}
        <View style={[styles.webSidebar, isWideLayout && styles.webSidebarWide]}>
          <ScrollView
            contentContainerStyle={styles.webSidebarContent}
            scrollEnabled={!isMapInteracting}
          >
            {/* Search */}
            <View style={styles.webSearchWrap}>
              <Ionicons name="search" size={16} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
              <TextInput
                style={styles.webSearchInput as TextStyle}
                placeholder="Search for a game…"
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={(q) => dispatch({ type: "SEARCH_QUERY_CHANGE", query: q })}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {selectedGame ? (
                <Pressable onPress={() => dispatch({ type: "GAME_CLEAR" })} style={styles.clearIconBtn}>
                  <Ionicons name="close" size={16} color={theme.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {/* Game chips */}
            <View style={styles.webGameChips}>
              {(showDropdown ? dropdownGames : featuredGames).map((g) => (
                <Pressable
                  key={g.id}
                  style={[styles.gameChip, selectedGame?.id === g.id && styles.gameChipSelected]}
                  onPress={() => startTransition(() => dispatch({ type: "GAME_SELECT", game: g }))}
                >
                  <Text style={[styles.gameChipTitle, selectedGame?.id === g.id && styles.gameChipTitleSelected]}>
                    {g.title}
                  </Text>
                  <Text style={styles.gameChipMeta}>{g.manufacturer} · {g.releaseYear}</Text>
                </Pressable>
              ))}
            </View>

            {/* Location row */}
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={theme.colors.brand} />
              <Text style={styles.locationLabel} numberOfLines={1}>{pillLabel}</Text>
              <Pressable onPress={() => setShowLocationInput((v) => !v)}>
                <Text style={styles.changeBtn}>Change</Text>
              </Pressable>
              <Pressable onPress={() => void requestLocation()} disabled={isLocating}>
                <Ionicons name={isLocating ? "hourglass" : "locate"} size={16} color={theme.colors.accent} />
              </Pressable>
            </View>

            {showLocationInput ? (
              <View style={styles.locationInputRow}>
                <TextInput
                  style={styles.locationInput}
                  placeholder="Address or ZIP code"
                  placeholderTextColor={theme.colors.textMuted}
                  value={manualLocationQuery}
                  onChangeText={(q) => dispatch({ type: "MANUAL_LOCATION_QUERY_CHANGE", query: q })}
                  autoCapitalize="words"
                  autoCorrect={false}
                  onSubmitEditing={() => void applyManualLocation()}
                  returnKeyType="go"
                />
                <Pressable
                  style={[styles.applyBtn, isApplyingManualLocation && styles.btnDisabled]}
                  onPress={() => void applyManualLocation()}
                  disabled={isApplyingManualLocation}
                >
                  <Text style={styles.applyBtnText}>{isApplyingManualLocation ? "…" : "Go"}</Text>
                </Pressable>
              </View>
            ) : null}

            {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
            {resultsError ? <Text style={styles.errorText}>Could not load arcade data right now.</Text> : null}

            {/* Distance filters */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.distanceRow}
            >
              {DISTANCE_FILTERS_MILES.map((miles) => (
                <Pressable
                  key={miles}
                  style={[styles.distChip, distanceFilterMiles === miles && styles.distChipActive]}
                  onPress={() => dispatch({ type: "DISTANCE_FILTER_CHANGE", miles })}
                >
                  <Text style={[styles.distChipText, distanceFilterMiles === miles && styles.distChipTextActive]}>
                    {miles} mi
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{results.length}</Text>
                <Text style={styles.statLabel}>{selectedGame ? "MATCHES" : "ARCADES"}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {results[0] ? formatDistanceMiles(results[0].distanceMiles) : "—"}
                </Text>
                <Text style={styles.statLabel}>NEAREST</Text>
              </View>
            </View>

            {/* Results */}
            {!userLocation ? (
              <Text style={styles.emptyText}>
                {isLocating
                  ? "Getting your location…"
                  : locationError ?? "Enter an address above to find nearby arcades."}
              </Text>
            ) : isLoadingResults ? (
              <Text style={styles.emptyText}>Scanning for arcades…</Text>
            ) : results.length > 0 ? (
              <View style={styles.resultsList}>
                {results.map((r) => (
                  <ResultCard key={r.venue.id} result={r} selected={selectedVenueId === r.venue.id} />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                {selectedGame
                  ? `No arcades with ${selectedGame.title} within ${distanceFilterMiles} mi.`
                  : `No arcades within ${distanceFilterMiles} mi.`}
              </Text>
            )}
          </ScrollView>
        </View>

        {/* Map */}
        <View style={styles.webMapWrap}>
          <AppMap
            fullScreen
            onMapInteractionChange={(v) => dispatch({ type: "MAP_INTERACTION_CHANGE", isInteracting: v })}
            onPinPress={handlePinPress}
            pins={pins}
            region={mapRegion}
            selectedPinId={selectedVenueId}
          />
        </View>
      </View>
    );
  }

  // ── Native layout ─────────────────────────────────────────────────────────

  return (
    <View style={styles.nativeRoot}>
      {/* Full-screen map */}
      <AppMap
        fullScreen
        onMapInteractionChange={(v) => dispatch({ type: "MAP_INTERACTION_CHANGE", isInteracting: v })}
        onPinPress={handlePinPress}
        pins={pins}
        region={mapRegion}
        selectedPinId={selectedVenueId}
      />

      {/* Floating search bar */}
      <View style={[styles.searchBar, { top: insets.top + 10 }]}>
        {selectedGame ? (
          <View style={styles.selectedGameChip}>
            <Text style={styles.selectedGameText} numberOfLines={1}>{selectedGame.title}</Text>
            <Pressable
              onPress={() => dispatch({ type: "GAME_CLEAR" })}
              style={styles.clearIconBtn}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </View>
        ) : (
          <>
            <Ionicons name="search" size={16} color={theme.colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a game…"
              placeholderTextColor={theme.colors.textMuted}
              value={searchQuery}
              onChangeText={(q) => dispatch({ type: "SEARCH_QUERY_CHANGE", query: q })}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </>
        )}
        <Pressable
          style={[styles.locationPill, showLocationInput && styles.locationPillActive]}
          onPress={() => setShowLocationInput((v) => !v)}
          hitSlop={6}
        >
          <Ionicons
            name="location"
            size={12}
            color={showLocationInput ? theme.colors.accent : theme.colors.brand}
          />
          <Text
            style={[styles.locationPillText, showLocationInput && styles.locationPillTextActive]}
            numberOfLines={1}
          >
            {pillLabel}
          </Text>
        </Pressable>
      </View>

      {/* Game suggestions dropdown */}
      {showDropdown && dropdownGames.length > 0 ? (
        <View style={[styles.dropdown, { top: insets.top + 10 + SEARCH_BAR_H + 4 }]}>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 260 }}>
            {dropdownGames.map((g) => (
              <Pressable
                key={g.id}
                style={styles.dropdownItem}
                onPress={() => startTransition(() => dispatch({ type: "GAME_SELECT", game: g }))}
              >
                <Text style={styles.dropdownItemTitle}>{g.title}</Text>
                <Text style={styles.dropdownItemMeta}>{g.manufacturer} · {g.releaseYear}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Floating location input */}
      {showLocationInput ? (
        <View style={[styles.floatingLocationRow, { top: insets.top + 10 + SEARCH_BAR_H + 4 }]}>
          <View style={styles.floatingLocationInputRow}>
            <TextInput
              autoFocus
              style={styles.floatingLocationInput}
              placeholder="Address or ZIP code"
              placeholderTextColor={theme.colors.textMuted}
              value={manualLocationQuery}
              onChangeText={(q) => dispatch({ type: "MANUAL_LOCATION_QUERY_CHANGE", query: q })}
              autoCapitalize="words"
              autoCorrect={false}
              onSubmitEditing={() => void applyManualLocation()}
              returnKeyType="go"
            />
            <Pressable
              style={styles.locateBtn}
              onPress={() => void requestLocation()}
              disabled={isLocating}
              hitSlop={6}
            >
              <Ionicons
                name={isLocating ? "hourglass-outline" : "locate"}
                size={18}
                color={theme.colors.accent}
              />
            </Pressable>
            <Pressable
              style={[styles.applyBtn, isApplyingManualLocation && styles.btnDisabled]}
              onPress={() => void applyManualLocation()}
              disabled={isApplyingManualLocation}
            >
              <Text style={styles.applyBtnText}>{isApplyingManualLocation ? "…" : "Go"}</Text>
            </Pressable>
          </View>
          {locationError ? (
            <Text style={styles.floatingLocationError}>{locationError}</Text>
          ) : null}
        </View>
      ) : null}

      {/* Bottom sheet */}
      <Animated.View
        pointerEvents="box-none"
        style={[styles.sheet, { height: SHEET_EXPANDED_H, transform: [{ translateY: sheetTranslateY }] }]}
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={styles.sheetHandle}>
          <View style={styles.sheetHandleBar} />
        </View>

        {selectedVenueResult ? (
          /* ── Venue preview (peek) ───────────────────────────────────────── */
          <>
            <View style={styles.venuePreview}>
              {/* Tappable body → venue detail screen */}
              <Link href={`/venue/${selectedVenueResult.venue.id}`} asChild>
                <Pressable style={styles.venuePreviewBody}>
                  <View style={styles.venuePreviewHeader}>
                    <Text style={styles.venuePreviewName} numberOfLines={1}>
                      {selectedVenueResult.venue.name}
                    </Text>
                    <Text style={styles.venuePreviewDist}>
                      {formatDistanceMiles(selectedVenueResult.distanceMiles)}
                    </Text>
                  </View>
                  <View style={styles.venuePreviewAddrRow}>
                    <Text style={styles.venuePreviewAddr} numberOfLines={1}>
                      {selectedVenueResult.venue.address}, {selectedVenueResult.venue.city}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
                  </View>
                </Pressable>
              </Link>

              {/* Quick actions */}
              <View style={styles.venuePreviewActions}>
                <Pressable
                  style={styles.venueDirectionsBtn}
                  onPress={() => void openDirections({
                    address: `${selectedVenueResult.venue.address}, ${selectedVenueResult.venue.city}, ${selectedVenueResult.venue.region}`,
                    destination: { latitude: selectedVenueResult.venue.latitude, longitude: selectedVenueResult.venue.longitude },
                    label: selectedVenueResult.venue.name,
                  })}
                >
                  <Ionicons name="navigate" size={13} color={theme.colors.textOnBrand} />
                  <Text style={styles.venueDirectionsBtnText}>Directions</Text>
                </Pressable>
                <Pressable onPress={dismissVenue} style={styles.venueDismissBtn} hitSlop={8}>
                  <Ionicons name="close" size={18} color={theme.colors.textMuted} />
                </Pressable>
              </View>
            </View>

            {/* Results list shown when expanded */}
            <ScrollView
              scrollEnabled={sheetExpanded}
              contentContainerStyle={styles.resultsList}
              showsVerticalScrollIndicator={false}
              onScrollBeginDrag={() => { if (!sheetExpanded) snapSheet(true); }}
            >
              {results.map((r) => (
                <ResultCard key={r.venue.id} result={r} selected={selectedVenueId === r.venue.id} />
              ))}
            </ScrollView>
          </>
        ) : (
          /* ── Browse mode ────────────────────────────────────────────────── */
          <>
            {/* Distance filter chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.distanceRow}
            >
              {DISTANCE_FILTERS_MILES.map((miles) => (
                <Pressable
                  key={miles}
                  style={[styles.distChip, distanceFilterMiles === miles && styles.distChipActive]}
                  onPress={() => dispatch({ type: "DISTANCE_FILTER_CHANGE", miles })}
                >
                  <Text style={[styles.distChipText, distanceFilterMiles === miles && styles.distChipTextActive]}>
                    {miles} mi
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Results header */}
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                {!userLocation
                  ? (isLocating ? "Locating…" : "No location set")
                  : isLoadingResults
                  ? "Scanning…"
                  : `${results.length} ${selectedGame ? "match" : "arcade"}${results.length === 1 ? "" : "es"}`}
              </Text>
              {results[0] ? (
                <Text style={styles.resultsNearest}>
                  Nearest: {formatDistanceMiles(results[0].distanceMiles)}
                </Text>
              ) : null}
            </View>

            {/* Results list */}
            <ScrollView
              scrollEnabled={sheetExpanded}
              contentContainerStyle={styles.resultsList}
              showsVerticalScrollIndicator={false}
              onScrollBeginDrag={() => { if (!sheetExpanded) snapSheet(true); }}
            >
              {!userLocation ? (
                <Text style={styles.emptyText}>
                  {isLocating
                    ? "Getting your location…"
                    : locationError ?? "Tap the location pill above to set your location."}
                </Text>
              ) : isLoadingResults ? (
                <Text style={styles.emptyText}>Scanning for arcades…</Text>
              ) : results.length > 0 ? (
                results.map((r) => (
                  <ResultCard key={r.venue.id} result={r} selected={selectedVenueId === r.venue.id} />
                ))
              ) : (
                <Text style={styles.emptyText}>
                  {selectedGame
                    ? `No arcades with ${selectedGame.title} within ${distanceFilterMiles} mi.`
                    : `No arcades within ${distanceFilterMiles} mi.`}
                </Text>
              )}
            </ScrollView>
          </>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Native root ────────────────────────────────────────────────────────────
  nativeRoot: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  // ── Search bar (native) ────────────────────────────────────────────────────
  searchBar: {
    alignItems: "center",
    backgroundColor: "rgba(4, 8, 15, 0.92)",
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.xs,
    height: SEARCH_BAR_H,
    left: 12,
    paddingHorizontal: theme.spacing.md,
    position: "absolute",
    right: 12,
    zIndex: 20,
    ...theme.glow.subtle,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    ...theme.type.body,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  selectedGameChip: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  selectedGameText: {
    ...theme.type.bodyMedium,
    color: theme.colors.accent,
    flex: 1,
  },
  clearIconBtn: {
    flexShrink: 0,
  },
  locateBtn: {
    flexShrink: 0,
    padding: 4,
  },
  locationPill: {
    alignItems: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    flexShrink: 1,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationPillActive: {
    backgroundColor: theme.colors.accentDim,
    borderColor: theme.colors.accent,
  },
  locationPillText: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.sansMedium,
    fontSize: 12,
    lineHeight: 16,
    maxWidth: 90,
  },
  locationPillTextActive: {
    color: theme.colors.accent,
  },
  floatingLocationRow: {
    backgroundColor: "rgba(4, 8, 15, 0.92)",
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    left: 12,
    overflow: "hidden",
    position: "absolute",
    right: 12,
    zIndex: 30,
    ...theme.glow.subtle,
  },
  floatingLocationInputRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  floatingLocationInput: {
    color: theme.colors.textPrimary,
    flex: 1,
    fontFamily: theme.fonts.sans,
    fontSize: 15,
    paddingVertical: 10,
  },
  floatingLocationError: {
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    color: theme.colors.warning,
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },

  // ── Dropdown ───────────────────────────────────────────────────────────────
  dropdown: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    left: 12,
    overflow: "hidden",
    position: "absolute",
    right: 12,
    zIndex: 25,
    ...theme.glow.subtle,
  },
  dropdownItem: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    gap: 2,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  dropdownItemTitle: {
    ...theme.type.bodyMedium,
    color: theme.colors.textPrimary,
  },
  dropdownItemMeta: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
  },

  // ── Bottom sheet ───────────────────────────────────────────────────────────
  sheet: {
    backgroundColor: theme.colors.backgroundElevated,
    borderTopColor: theme.colors.borderStrong,
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    zIndex: 10,
  },
  sheetHandle: {
    alignItems: "center",
    paddingBottom: theme.spacing.xs,
    paddingTop: theme.spacing.md,
  },
  sheetHandleBar: {
    backgroundColor: theme.colors.borderStrong,
    borderRadius: 2,
    height: 4,
    width: 40,
  },

  // ── Venue preview (selected state) ────────────────────────────────────────
  venuePreview: {
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    paddingBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 2,
  },
  venuePreviewBody: {
    gap: 3,
    paddingVertical: 4,
  },
  venuePreviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
  },
  venuePreviewName: {
    ...theme.type.heading,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  venuePreviewDist: {
    ...theme.type.label,
    color: theme.colors.brand,
  },
  venuePreviewAddrRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  venuePreviewAddr: {
    ...theme.type.caption,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  venuePreviewActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    paddingVertical: 4,
  },
  venueDirectionsBtn: {
    alignItems: "center",
    backgroundColor: theme.colors.brand,
    borderRadius: theme.radius.pill,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  venueDirectionsBtnText: {
    ...theme.type.label,
    color: theme.colors.textOnBrand,
  },
  venueDismissBtn: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    marginLeft: "auto",
    width: 32,
  },

  // ── Shared (native + web) ──────────────────────────────────────────────────
  locationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  locationLabel: {
    ...theme.type.label,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  changeBtn: {
    ...theme.type.label,
    color: theme.colors.accent,
  },
  locationInputRow: {
    flexDirection: "row",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  },
  locationInput: {
    ...theme.type.body,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    flex: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  applyBtn: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  btnDisabled: { opacity: 0.5 },
  applyBtnText: {
    ...theme.type.bodyMedium,
    color: theme.colors.textOnAccent,
  },
  errorText: {
    ...theme.type.caption,
    color: theme.colors.warning,
    paddingHorizontal: theme.spacing.md,
  },
  distanceRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  distChip: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  distChipActive: {
    backgroundColor: theme.colors.brandDim,
    borderColor: theme.colors.brand,
  },
  distChipText: {
    ...theme.type.monoSmall,
    color: theme.colors.textSecondary,
  },
  distChipTextActive: {
    color: theme.colors.brand,
  },
  resultsHeader: {
    alignItems: "center",
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  resultsCount: {
    ...theme.type.label,
    color: theme.colors.textPrimary,
  },
  resultsNearest: {
    ...theme.type.monoSmall,
    color: theme.colors.textMuted,
  },
  resultsList: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  emptyText: {
    ...theme.type.body,
    color: theme.colors.textSecondary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },

  // ── Web root ───────────────────────────────────────────────────────────────
  webRoot: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: theme.colors.background,
  },
  webSidebar: {
    borderRightColor: theme.colors.border,
    borderRightWidth: 1,
    width: 360,
  },
  webSidebarWide: {
    width: 420,
  },
  webSidebarContent: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  webMapWrap: {
    flex: 1,
  },
  webSearchWrap: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  webSearchInput: {
    ...theme.type.body,
    color: theme.colors.textPrimary,
    flex: 1,
    outlineStyle: "none",
  } as ReturnType<typeof StyleSheet.create>["webSearchInput"],
  webGameChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  gameChip: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: 2,
    padding: theme.spacing.sm,
  },
  gameChipSelected: {
    backgroundColor: theme.colors.brandDim,
    borderColor: theme.colors.brand,
  },
  gameChipTitle: {
    ...theme.type.bodyMedium,
    color: theme.colors.textPrimary,
  },
  gameChipTitleSelected: {
    color: theme.colors.brandMuted,
  },
  gameChipMeta: {
    ...theme.type.caption,
    color: theme.colors.textMuted,
  },
  statsRow: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
    gap: 2,
  },
  statValue: {
    ...theme.type.mono,
    color: theme.colors.textPrimary,
    fontSize: 18,
  },
  statLabel: {
    ...theme.type.tag,
    color: theme.colors.textMuted,
  },
  statDivider: {
    backgroundColor: theme.colors.border,
    height: 32,
    width: 1,
  },
});
