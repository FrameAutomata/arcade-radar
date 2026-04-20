import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { theme } from '@/constants/theme';
import { getGameById, getVenueById } from '@/data/mock-data';
import {
  formatDistanceMiles,
  formatVerificationAge,
  formatVerificationDate,
} from '@/lib/format';
import { distanceInMiles } from '@/lib/geo';

const fallbackLocation = {
  latitude: 41.9295,
  longitude: -87.7071,
};

function getStatusLabel(status: string): string {
  switch (status) {
    case 'confirmed_present':
      return 'Confirmed on site';
    case 'temporarily_unavailable':
      return 'Temporarily unavailable';
    case 'rumored_present':
      return 'Needs confirmation';
    default:
      return status;
  }
}

export default function VenueDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const venue = params.id ? getVenueById(params.id) : undefined;

  if (!venue) {
    return (
      <View style={styles.missingState}>
        <Stack.Screen options={{ title: 'Venue missing' }} />
        <Text style={styles.missingTitle}>Venue not found</Text>
        <Text style={styles.missingText}>
          This route is wired up, but the current demo dataset does not contain that venue id.
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.name}>{venue.name}</Text>
          <Text style={styles.address}>
            {venue.address}, {venue.city}, {venue.region}
          </Text>
          <Text style={styles.notes}>{venue.notes}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaCard}>
              <Text style={styles.metaValue}>{formatDistanceMiles(distanceMiles)}</Text>
              <Text style={styles.metaLabel}>from demo location</Text>
            </View>
            <View style={styles.metaCard}>
              <Text style={styles.metaValue}>{venue.verifiedByCount}</Text>
              <Text style={styles.metaLabel}>community confirmations</Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Map</Text>
          <MapView
            initialRegion={{
              latitude: venue.latitude,
              longitude: venue.longitude,
              latitudeDelta: 0.04,
              longitudeDelta: 0.04,
            }}
            style={styles.map}
          >
            <Marker
              coordinate={{
                latitude: venue.latitude,
                longitude: venue.longitude,
              }}
              title={venue.name}
            />
          </MapView>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Tracked inventory</Text>
          <View style={styles.inventoryList}>
            {venue.inventory.map((item) => {
              const game = getGameById(item.gameId);

              return (
                <View key={`${venue.id}-${item.gameId}`} style={styles.inventoryCard}>
                  <Text style={styles.inventoryTitle}>{game?.title ?? item.gameId}</Text>
                  <Text style={styles.inventoryMeta}>
                    {getStatusLabel(item.status)} • {item.quantity} machine
                    {item.quantity > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.inventoryMeta}>
                    Last verified {formatVerificationDate(item.lastVerifiedAt)} (
                    {formatVerificationAge(item.lastVerifiedAt)})
                  </Text>
                  {item.note ? <Text style={styles.inventoryNote}>{item.note}</Text> : null}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>What comes next</Text>
          <Text style={styles.nextStep}>
            Hook this screen up to `find_nearest_venues_for_game` and a venue detail query in
            Supabase, then let authenticated players confirm whether each cabinet is still on the
            floor.
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
  hero: {
    backgroundColor: theme.colors.surfaceStrong,
    borderRadius: theme.radius.lg,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  name: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
  },
  address: {
    color: theme.colors.brandMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  notes: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  metaCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    flex: 1,
    gap: 4,
    padding: theme.spacing.md,
  },
  metaValue: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  metaLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
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
  map: {
    borderRadius: theme.radius.md,
    height: 220,
    overflow: 'hidden',
  },
  inventoryList: {
    gap: theme.spacing.sm,
  },
  inventoryCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    gap: 6,
    padding: theme.spacing.md,
  },
  inventoryTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
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
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.sm,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  missingTitle: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  missingText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
