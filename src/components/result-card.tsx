import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { formatDistanceMiles, formatVerificationAge } from '@/lib/format';
import type { VenueMatch } from '@/types/domain';

function getStatusLabel(status: VenueMatch['inventory']['status']): string {
  switch (status) {
    case 'confirmed_present':
      return 'Confirmed';
    case 'temporarily_unavailable':
      return 'Maintenance';
    case 'rumored_present':
      return 'Rumored';
    default:
      return 'Unknown';
  }
}

function getStatusColor(status: VenueMatch['inventory']['status']): string {
  switch (status) {
    case 'confirmed_present':
      return theme.colors.success;
    case 'temporarily_unavailable':
      return theme.colors.warning;
    case 'rumored_present':
      return theme.colors.brandMuted;
    default:
      return theme.colors.textMuted;
  }
}

interface ResultCardProps {
  match: VenueMatch;
}

export function ResultCard({ match }: ResultCardProps) {
  return (
    <Link
      href={{
        pathname: '/venue/[id]',
        params: { id: match.venue.id },
      }}
      asChild
    >
      <Pressable style={styles.card}>
        <View style={styles.row}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{match.venue.name}</Text>
            <Text style={styles.subtitle}>
              {match.venue.address}, {match.venue.city}
            </Text>
          </View>
          <Text style={styles.distance}>
            {formatDistanceMiles(match.distanceMiles)}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View
            style={[
              styles.badge,
              { backgroundColor: `${getStatusColor(match.inventory.status)}22` },
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
            {match.inventory.quantity > 1 ? 's' : ''}
          </Text>
          <Text style={styles.metaText}>
            {formatVerificationAge(match.inventory.lastVerifiedAt)}
          </Text>
        </View>

        {match.inventory.note ? (
          <Text style={styles.note}>{match.inventory.note}</Text>
        ) : null}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  distance: {
    color: theme.colors.brandMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metaText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  note: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
