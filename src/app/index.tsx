import * as Location from 'expo-location';
import { useDeferredValue, useMemo, useState, startTransition } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ResultCard } from '@/components/result-card';
import { theme } from '@/constants/theme';
import {
  defaultUserLocation,
  featuredGames,
  findVenueMatches,
  getGameById,
  searchGames,
  venues,
} from '@/data/mock-data';
import { formatVerificationAge } from '@/lib/format';
import { buildMapRegion } from '@/lib/geo';
import { hasGoogleMapsApiKey, hasSupabaseCredentials } from '@/lib/env';
import type { Coordinates } from '@/lib/geo';

const demoLocationLabel = 'Logan Square demo location';

export default function HomeScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates>(defaultUserLocation);
  const [locationLabel, setLocationLabel] = useState(demoLocationLabel);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const suggestedGames = useMemo(
    () => searchGames(deferredQuery),
    [deferredQuery]
  );

  const selectedGame = useMemo(() => {
    if (!selectedGameId) {
      return null;
    }

    return getGameById(selectedGameId) ?? null;
  }, [selectedGameId]);

  const results = useMemo(() => {
    if (!selectedGame) {
      return [];
    }

    return findVenueMatches(selectedGame.id, userLocation);
  }, [selectedGame, userLocation]);

  const mapVenues = selectedGame
    ? results.map((result) => result.venue)
    : venues;

  const visibleMarkers = mapVenues.map((venue) => ({
    latitude: venue.latitude,
    longitude: venue.longitude,
  }));

  const mapKey = `${selectedGame?.id ?? 'all'}-${userLocation.latitude.toFixed(3)}-${userLocation.longitude.toFixed(3)}`;

  const mapRegion = useMemo(
    () => buildMapRegion(userLocation, visibleMarkers),
    [userLocation, visibleMarkers]
  );

  async function requestLocation() {
    setIsLocating(true);
    setLocationError(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        setLocationError('Location access was denied. Still using the demo location.');
        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setUserLocation({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      });
      setLocationLabel('Using your current location');
    } catch {
      setLocationError('Could not read your location yet. Still using the demo location.');
    } finally {
      setIsLocating(false);
    }
  }

  function selectGame(gameId: string, title: string) {
    startTransition(() => {
      setSelectedGameId(gameId);
      setSearchQuery(title);
    });
  }

  function updateSearch(value: string) {
    startTransition(() => {
      setSearchQuery(value);
      setSelectedGameId(null);
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Search a cabinet, not just an arcade</Text>
          <Text style={styles.title}>Find the nearest spot carrying your game.</Text>
          <Text style={styles.description}>
            This starter app ships with a local Chicago demo dataset and is wired for
            Supabase + PostGIS once you add your backend keys.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>What are you hunting for?</Text>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={updateSearch}
            placeholder="Try Marvel vs. Capcom 2 or DDR"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.input}
            value={searchQuery}
          />

          <View style={styles.chipRow}>
            {(searchQuery.trim() ? suggestedGames : featuredGames).map((game) => (
              <Pressable
                key={game.id}
                onPress={() => selectGame(game.id, game.title)}
                style={[
                  styles.chip,
                  selectedGame?.id === game.id && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipTitle,
                    selectedGame?.id === game.id && styles.chipTitleSelected,
                  ]}
                >
                  {game.title}
                </Text>
                <Text style={styles.chipMeta}>
                  {game.manufacturer} • {game.releaseYear}
                </Text>
              </Pressable>
            ))}
          </View>

          {selectedGame ? (
            <Text style={styles.selectionText}>
              Showing nearby matches for {selectedGame.title}.
            </Text>
          ) : (
            <Text style={styles.selectionText}>
              Pick a title above to see the nearest venues.
            </Text>
          )}
        </View>

        <View style={styles.panel}>
          <View style={styles.locationHeader}>
            <View style={styles.locationCopy}>
              <Text style={styles.sectionTitle}>Where are you searching from?</Text>
              <Text style={styles.locationText}>{locationLabel}</Text>
            </View>
            <Pressable
              disabled={isLocating}
              onPress={requestLocation}
              style={styles.locationButton}
            >
              <Text style={styles.locationButtonText}>
                {isLocating ? 'Locating...' : 'Use my location'}
              </Text>
            </Pressable>
          </View>

          {locationError ? <Text style={styles.warningText}>{locationError}</Text> : null}

          <MapView initialRegion={mapRegion} key={mapKey} style={styles.map}>
            <Marker coordinate={userLocation} title="You are here" />
            {mapVenues.map((venue) => (
              <Marker
                key={venue.id}
                coordinate={{
                  latitude: venue.latitude,
                  longitude: venue.longitude,
                }}
                description={selectedGame?.title ?? 'Demo venue'}
                title={venue.name}
              />
            ))}
          </MapView>

          <View style={styles.factRow}>
            <View style={styles.factCard}>
              <Text style={styles.factValue}>{selectedGame ? results.length : venues.length}</Text>
              <Text style={styles.factLabel}>
                {selectedGame ? 'matching venues' : 'demo venues'}
              </Text>
            </View>
            <View style={styles.factCard}>
              <Text style={styles.factValue}>
                {hasSupabaseCredentials ? 'Live' : 'Mock'}
              </Text>
              <Text style={styles.factLabel}>data source</Text>
            </View>
            <View style={styles.factCard}>
              <Text style={styles.factValue}>
                {hasGoogleMapsApiKey ? 'Ready' : 'Needed'}
              </Text>
              <Text style={styles.factLabel}>maps key</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Nearest arcades</Text>

          {selectedGame ? (
            results.length > 0 ? (
              <View style={styles.resultsList}>
                {results.map((match) => (
                  <ResultCard key={match.venue.id} match={match} />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                No nearby matches in the demo data yet for that title.
              </Text>
            )
          ) : (
            <Text style={styles.emptyText}>
              Search for a game to turn the list into real venue matches.
            </Text>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Backend wiring status</Text>
          <View style={styles.statusList}>
            <Text style={styles.statusLine}>
              Supabase credentials: {hasSupabaseCredentials ? 'configured' : 'missing'}
            </Text>
            <Text style={styles.statusLine}>
              Maps API key: {hasGoogleMapsApiKey ? 'configured' : 'missing for store builds'}
            </Text>
            <Text style={styles.statusLine}>
              Schema target: games, venues, venue inventory, and community verification reports
            </Text>
            {selectedGame && results[0] ? (
              <Text style={styles.statusLine}>
                Best current match: {results[0].venue.name},{' '}
                {formatVerificationAge(results[0].inventory.lastVerifiedAt)}
              </Text>
            ) : null}
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
  hero: {
    backgroundColor: theme.colors.surfaceStrong,
    borderRadius: theme.radius.lg,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  eyebrow: {
    color: theme.colors.brandMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  panel: {
    backgroundColor: theme.colors.surface,
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
  input: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  chipRow: {
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
  chipSelected: {
    borderColor: theme.colors.brand,
    transform: [{ scale: 1.01 }],
  },
  chipTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  chipTitleSelected: {
    color: theme.colors.brandMuted,
  },
  chipMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  selectionText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  locationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  locationCopy: {
    flex: 1,
    gap: 4,
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
  },
  locationButtonText: {
    color: theme.colors.textOnBrand,
    fontSize: 13,
    fontWeight: '700',
  },
  warningText: {
    color: theme.colors.warning,
    fontSize: 13,
    lineHeight: 18,
  },
  map: {
    borderRadius: theme.radius.md,
    height: 240,
    overflow: 'hidden',
  },
  factRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  factCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    flex: 1,
    gap: 4,
    padding: theme.spacing.md,
  },
  factValue: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  factLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
  },
  resultsList: {
    gap: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  statusList: {
    gap: 8,
  },
  statusLine: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
