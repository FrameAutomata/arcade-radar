import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import {
  getScoutSessionUser,
  listPendingScoutReports,
  listScoutVenues,
  searchScoutGames,
  submitScoutInventoryReport,
  type PendingInventoryReport,
  type ScoutReportType,
  type ScoutVenue,
} from '@/lib/scout';
import type { Game } from '@/types/domain';

const REPORT_TYPES: Array<{
  description: string;
  label: string;
  value: ScoutReportType;
}> = [
  {
    description: 'Machine is confirmed playable on site.',
    label: 'Confirmed',
    value: 'confirmed_present',
  },
  {
    description: 'Machine appears to be gone from the floor.',
    label: 'Missing',
    value: 'missing',
  },
  {
    description: 'Machine is present but currently down.',
    label: 'Maintenance',
    value: 'temporarily_unavailable',
  },
  {
    description: 'New cabinet spotted at the venue.',
    label: 'New machine',
    value: 'new_machine',
  },
  {
    description: 'Quantity on the floor changed.',
    label: 'Qty change',
    value: 'quantity_changed',
  },
];

export default function ScoutScreen() {
  const [venues, setVenues] = useState<ScoutVenue[]>([]);
  const [venueQuery, setVenueQuery] = useState('');
  const [selectedVenue, setSelectedVenue] = useState<ScoutVenue | null>(null);
  const [gameQuery, setGameQuery] = useState('');
  const [gameResults, setGameResults] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedReportType, setSelectedReportType] =
    useState<ScoutReportType>('confirmed_present');
  const [quantity, setQuantity] = useState('1');
  const [machineLabel, setMachineLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [pendingReports, setPendingReports] = useState<PendingInventoryReport[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);

  const filteredVenues = useMemo(() => {
    const normalizedQuery = venueQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return [];
    }

    return venues.filter((venue) => {
      const venueText = `${venue.name} ${venue.address} ${venue.city} ${venue.region}`.toLowerCase();
      return venueText.includes(normalizedQuery);
    });
  }, [venueQuery, venues]);

  const visibleVenues = useMemo(() => {
    if (!selectedVenue) {
      return filteredVenues;
    }

    return filteredVenues.filter((venue) => venue.id !== selectedVenue.id);
  }, [filteredVenues, selectedVenue]);

  const visibleGameResults = useMemo(() => {
    if (!selectedGame) {
      return gameResults;
    }

    return gameResults.filter((game) => game.id !== selectedGame.id);
  }, [gameResults, selectedGame]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapScoutMode() {
      setLoadError(null);

      try {
        const nextVenues = await listScoutVenues();

        if (!cancelled) {
          setVenues(nextVenues);
        }
      } catch {
        if (!cancelled) {
          setLoadError(
            'Could not load venues for Scout Mode. Confirm your Supabase connection and venue policies are ready.',
          );
        }
      }

      try {
        const user = await getScoutSessionUser();

        if (!cancelled) {
          setSessionEmail(user?.email ?? null);
        }
      } catch {
        if (!cancelled) {
          setSessionEmail(null);
        }
      }

      try {
        const nextPendingReports = await listPendingScoutReports();

        if (!cancelled) {
          setPendingReports(nextPendingReports);
        }
      } catch {
        if (!cancelled) {
          setLoadError((currentMessage) =>
            currentMessage ??
            'Scout Mode loaded, but the review queue is unavailable until you sign in with a scout/admin account.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingQueue(false);
        }
      }
    }

    void bootstrapScoutMode();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadGameResults() {
      const normalizedQuery = gameQuery.trim();

      if (!normalizedQuery) {
        setGameResults([]);
        return;
      }

      try {
        const nextResults = await searchScoutGames(normalizedQuery);

        if (!cancelled) {
          setGameResults(nextResults);
        }
      } catch {
        if (!cancelled) {
          setGameResults([]);
        }
      }
    }

    void loadGameResults();

    return () => {
      cancelled = true;
    };
  }, [gameQuery]);

  async function refreshPendingReports() {
    setIsLoadingQueue(true);

    try {
      const nextPendingReports = await listPendingScoutReports();
      setPendingReports(nextPendingReports);
    } catch {
      setLoadError('Could not refresh the pending Scout report queue.');
    } finally {
      setIsLoadingQueue(false);
    }
  }

  async function submitReport() {
    if (!selectedVenue || !selectedGame) {
      setSubmitMessage('Pick a venue and a game before submitting a scout report.');
      return;
    }

    const parsedQuantity = Number(quantity);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
      setSubmitMessage('Quantity must be at least 1.');
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      await submitScoutInventoryReport({
        gameId: selectedGame.id,
        machineLabel,
        notes,
        quantity: parsedQuantity,
        reportType: selectedReportType,
        venueId: selectedVenue.id,
      });

      setSubmitMessage('Scout report submitted. It is now waiting in the review queue.');
      setSelectedGame(null);
      setGameQuery('');
      setQuantity('1');
      setMachineLabel('');
      setNotes('');
      await refreshPendingReports();
    } catch {
      setSubmitMessage(
        'Report submission failed. Make sure you are signed in with a scout/admin account.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.marqueeRow}>
          <View style={styles.marqueePill}>
            <Text style={styles.marqueeText}>Scout mode</Text>
          </View>
          <View style={[styles.marqueePill, styles.marqueePillSecondary]}>
            <Text style={styles.marqueeText}>
              Fast field intake for DFW and beyond
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Text style={styles.eyebrow}>Private workflow</Text>
          <Text style={styles.title}>Capture machine inventory while you are on site.</Text>
          <Text style={styles.description}>
            Scout Mode is designed for fast venue selection, lightweight notes, and
            report-first data capture that can be approved into the live inventory later.
          </Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>
                {sessionEmail ?? 'No session'}
              </Text>
              <Text style={styles.heroStatLabel}>current scout session</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{pendingReports.length}</Text>
              <Text style={styles.heroStatLabel}>pending reports</Text>
            </View>
          </View>
        </View>

        {loadError ? <Text style={styles.warningText}>{loadError}</Text> : null}

        <View style={styles.grid}>
          <View style={[styles.panel, styles.formPanel]}>
            <Text style={styles.sectionTitle}>1. Pick a venue</Text>
            <TextInput
              onChangeText={(value) => {
                setVenueQuery(value);
                setSelectedVenue(null);
              }}
              placeholder="Search venue name or address"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              value={venueQuery}
            />
            {selectedVenue ? (
              <View style={styles.selectionSummary}>
                <Text style={styles.selectionEyebrow}>Selected venue</Text>
                <Text style={styles.selectionTitle}>{selectedVenue.name}</Text>
                <Text style={styles.selectionMeta}>
                  {selectedVenue.address}, {selectedVenue.city}, {selectedVenue.region}
                </Text>
              </View>
            ) : (
              <Text style={styles.helperText}>
                Search by venue name or address, then tap the matching arcade.
              </Text>
            )}
            {visibleVenues.length > 0 ? (
              <View style={styles.cardList}>
                {visibleVenues.map((venue) => (
                  <Pressable
                    key={venue.id}
                    onPress={() => {
                      setSelectedVenue(venue);
                      setVenueQuery(venue.name);
                    }}
                    style={[
                      styles.selectCard,
                      selectedVenue?.id === venue.id && styles.selectCardSelected,
                    ]}
                  >
                    <Text style={styles.selectTitle}>{venue.name}</Text>
                    <Text style={styles.selectMeta}>
                      {venue.address}, {venue.city}, {venue.region}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>2. Pick a game</Text>
            <TextInput
              onChangeText={(value) => {
                setGameQuery(value);
                setSelectedGame(null);
              }}
              placeholder="Search game title"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              value={gameQuery}
            />
            {selectedGame ? (
              <View style={styles.selectionSummary}>
                <Text style={styles.selectionEyebrow}>Selected game</Text>
                <Text style={styles.selectionTitle}>{selectedGame.title}</Text>
                <Text style={styles.selectionMeta}>
                  {selectedGame.manufacturer} • {selectedGame.releaseYear}
                </Text>
              </View>
            ) : (
              <Text style={styles.helperText}>
                Search by cabinet title, then tap the matching game.
              </Text>
            )}
            {visibleGameResults.length > 0 ? (
              <View style={styles.cardList}>
                {visibleGameResults.map((game) => (
                  <Pressable
                    key={game.id}
                    onPress={() => {
                      setSelectedGame(game);
                      setGameQuery(game.title);
                    }}
                    style={[
                      styles.selectCard,
                      selectedGame?.id === game.id && styles.selectCardSelected,
                    ]}
                  >
                    <Text style={styles.selectTitle}>{game.title}</Text>
                    <Text style={styles.selectMeta}>
                      {game.manufacturer} • {game.releaseYear}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>3. Report what you found</Text>
            <View style={styles.typeGrid}>
              {REPORT_TYPES.map((type) => (
                <Pressable
                  key={type.value}
                  onPress={() => setSelectedReportType(type.value)}
                  style={[
                    styles.typeChip,
                    selectedReportType === type.value && styles.typeChipSelected,
                  ]}
                >
                  <Text style={styles.typeChipTitle}>{type.label}</Text>
                  <Text style={styles.typeChipMeta}>{type.description}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              keyboardType="number-pad"
              onChangeText={setQuantity}
              placeholder="Quantity"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              value={quantity}
            />
            <TextInput
              onChangeText={setMachineLabel}
              placeholder="Machine label or cabinet note"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              value={machineLabel}
            />
            <TextInput
              multiline
              onChangeText={setNotes}
              placeholder="Short field note"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.input, styles.notesInput]}
              value={notes}
            />

            {submitMessage ? (
              <Text style={styles.helperMessage}>{submitMessage}</Text>
            ) : null}

            <Pressable
              onPress={() => void submitReport()}
              style={[styles.primaryButton, isSubmitting && styles.primaryButtonMuted]}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? 'Submitting...' : 'Submit scout report'}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.panel, styles.queuePanel]}>
            <View style={styles.queueHeader}>
              <Text style={styles.sectionTitle}>Pending review queue</Text>
              <Pressable onPress={() => void refreshPendingReports()} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Refresh</Text>
              </Pressable>
            </View>

            {isLoadingQueue ? (
              <Text style={styles.emptyText}>Loading pending reports...</Text>
            ) : pendingReports.length > 0 ? (
              <View style={styles.cardList}>
                {pendingReports.map((report) => (
                  <View key={report.reportId} style={styles.queueCard}>
                    <View style={styles.queueCardTop}>
                      <Text style={styles.queueTitle}>{report.venueName}</Text>
                      <Text style={styles.queueType}>{report.reportType}</Text>
                    </View>
                    <Text style={styles.queueMeta}>{report.gameTitle}</Text>
                    <Text style={styles.queueMeta}>
                      Qty {report.quantity}
                      {report.machineLabel ? ` • ${report.machineLabel}` : ''}
                    </Text>
                    {report.notes ? (
                      <Text style={styles.queueNote}>{report.notes}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                No pending reports yet. Your first field report will appear here after submission.
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
  marqueeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  hero: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    gap: theme.spacing.sm,
    overflow: 'hidden',
    padding: theme.spacing.lg,
    position: 'relative',
  },
  heroGlow: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    height: 150,
    opacity: 0.1,
    position: 'absolute',
    right: -24,
    top: -36,
    width: 150,
  },
  eyebrow: {
    color: theme.colors.brandMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 38,
  },
  description: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  heroStat: {
    backgroundColor: 'rgba(8, 15, 30, 0.72)',
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
    fontWeight: '800',
  },
  heroStatLabel: {
    color: theme.colors.accentMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  grid: {
    gap: theme.spacing.lg,
  },
  panel: {
    backgroundColor: theme.colors.surfaceGlass,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  formPanel: {
    width: '100%',
  },
  queuePanel: {
    width: '100%',
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
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
  helperText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  selectionSummary: {
    backgroundColor: 'rgba(8, 15, 30, 0.76)',
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 4,
    padding: theme.spacing.md,
  },
  selectionEyebrow: {
    color: theme.colors.accentMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  selectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  selectionMeta: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  cardList: {
    gap: theme.spacing.sm,
  },
  selectCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 4,
    padding: theme.spacing.md,
  },
  selectCardSelected: {
    backgroundColor: theme.colors.surfaceStrong,
    borderColor: theme.colors.brand,
    shadowColor: theme.colors.brand,
    shadowOpacity: 0.22,
    shadowRadius: 10,
  },
  selectTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  selectMeta: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  typeGrid: {
    gap: theme.spacing.sm,
  },
  typeChip: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 4,
    padding: theme.spacing.md,
  },
  typeChipSelected: {
    borderColor: theme.colors.accent,
  },
  typeChipTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  typeChipMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  helperMessage: {
    color: theme.colors.accentMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  warningText: {
    color: theme.colors.warning,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.brand,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
  },
  primaryButtonMuted: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: theme.colors.textOnBrand,
    fontSize: 15,
    fontWeight: '800',
  },
  queueHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.accentMuted,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  queueCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 6,
    padding: theme.spacing.md,
  },
  queueCardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  queueTitle: {
    color: theme.colors.textPrimary,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  queueType: {
    color: theme.colors.brandMuted,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: theme.spacing.sm,
    textTransform: 'uppercase',
  },
  queueMeta: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  queueNote: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
});
