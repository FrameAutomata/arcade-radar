import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { getAuthSessionSummary } from '@/lib/auth';
import { resolveAppLocation } from '@/lib/geocoding';
import {
  approveGameSubmission,
  approveScoutInventoryReport,
  approveVenueSubmission,
  createScoutGame,
  createScoutVenue,
  getScoutSessionUser,
  getScoutErrorMessage,
  listPendingGameSubmissions,
  listMyPendingGameSubmissions,
  listMyPendingScoutReports,
  listMyPendingVenueSubmissions,
  rejectScoutInventoryReport,
  rejectGameSubmission,
  rejectVenueSubmission,
  listPendingScoutReports,
  listPendingVenueSubmissions,
  listScoutVenues,
  searchScoutGames,
  submitScoutGameSubmission,
  submitScoutInventoryReport,
  submitScoutVenueSubmission,
  withdrawGameSubmission,
  withdrawScoutInventoryReport,
  withdrawVenueSubmission,
  type PendingGameSubmission,
  type PendingInventoryReport,
  type PendingVenueSubmission,
  type ScoutReportType,
  type ScoutVenue,
} from '@/lib/scout';
import type { UserRole } from '@/types/database';
import type { Game } from '@/types/domain';

const RECENT_GAMES_STORAGE_KEY = 'arcade-radar:scout:recent-games';
const RECENT_VENUES_STORAGE_KEY = 'arcade-radar:scout:recent-venues';
const RECENT_GAMES_LIMIT = 6;
const RECENT_VENUES_LIMIT = 4;

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

interface SessionSubmission {
  gameId: string;
  gameTitle: string;
  id: string;
  quantity: number;
  reportLabel: string;
  reportType: ScoutReportType;
  submittedAt: string;
  venueId: string;
  venueName: string;
}

interface GroupedPendingReports {
  reports: PendingInventoryReport[];
  venueId: string;
  venueName: string;
}

const QUICK_NOTE_CHIPS = [
  'Controls good',
  'Controls need work',
  'Cabinet down',
  'Screen issue',
  'Sound issue',
  'Near prize counter',
  'Left side',
  'Right side',
];

function parseStoredRecentGames(value: string | null): Game[] {
  if (!value) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((game): game is Game =>
        Boolean(
          game &&
            typeof game.id === 'string' &&
            typeof game.slug === 'string' &&
            typeof game.title === 'string' &&
            typeof game.manufacturer === 'string' &&
            typeof game.releaseYear === 'number' &&
            Array.isArray(game.aliases) &&
            Array.isArray(game.categories),
        ),
      )
      .slice(0, RECENT_GAMES_LIMIT);
  } catch {
    return [];
  }
}

function parseStoredRecentVenues(value: string | null): ScoutVenue[] {
  if (!value) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .filter((venue): venue is ScoutVenue =>
        Boolean(
          venue &&
            typeof venue.id === 'string' &&
            typeof venue.slug === 'string' &&
            typeof venue.name === 'string' &&
            typeof venue.address === 'string' &&
            typeof venue.city === 'string' &&
            typeof venue.region === 'string',
        ),
      )
      .slice(0, RECENT_VENUES_LIMIT);
  } catch {
    return [];
  }
}

function isScoutReportType(value: string | undefined): value is ScoutReportType {
  return REPORT_TYPES.some((reportType) => reportType.value === value);
}

function getReportTypeLabel(reportType: ScoutReportType): string {
  return REPORT_TYPES.find((type) => type.value === reportType)?.label ?? reportType;
}

function getPendingReportLabel(reportType: string): string {
  return isScoutReportType(reportType) ? getReportTypeLabel(reportType) : reportType;
}

function getReportTone(reportType: string) {
  switch (reportType) {
    case 'confirmed_present':
    case 'new_machine':
      return {
        backgroundColor: 'rgba(57, 217, 138, 0.12)',
        borderColor: theme.colors.success,
        textColor: theme.colors.success,
      };
    case 'temporarily_unavailable':
    case 'quantity_changed':
      return {
        backgroundColor: 'rgba(255, 213, 74, 0.12)',
        borderColor: theme.colors.warning,
        textColor: theme.colors.warning,
      };
    case 'missing':
      return {
        backgroundColor: 'rgba(255, 95, 162, 0.12)',
        borderColor: theme.colors.highlight,
        textColor: theme.colors.highlight,
      };
    default:
      return {
        backgroundColor: 'rgba(120, 215, 255, 0.12)',
        borderColor: theme.colors.accentMuted,
        textColor: theme.colors.accentMuted,
      };
  }
}

export default function ScoutScreen() {
  const params = useLocalSearchParams<{
    gameId?: string;
    gameCategories?: string;
    gameManufacturer?: string;
    gameReleaseYear?: string;
    gameSlug?: string;
    gameTitle?: string;
    reportType?: string;
    venueId?: string;
  }>();
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 1100;
  const [venues, setVenues] = useState<ScoutVenue[]>([]);
  const [venueQuery, setVenueQuery] = useState('');
  const [selectedVenue, setSelectedVenue] = useState<ScoutVenue | null>(null);
  const [recentVenues, setRecentVenues] = useState<ScoutVenue[]>([]);
  const [gameQuery, setGameQuery] = useState('');
  const [gameResults, setGameResults] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [selectedReportType, setSelectedReportType] =
    useState<ScoutReportType>('confirmed_present');
  const [quantity, setQuantity] = useState('1');
  const [machineLabel, setMachineLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState<UserRole | null>(null);
  const [pendingReports, setPendingReports] = useState<PendingInventoryReport[]>([]);
  const [pendingVenueSubmissions, setPendingVenueSubmissions] = useState<PendingVenueSubmission[]>([]);
  const [pendingGameSubmissions, setPendingGameSubmissions] = useState<PendingGameSubmission[]>([]);
  const [myPendingReports, setMyPendingReports] = useState<PendingInventoryReport[]>([]);
  const [myPendingVenueSubmissions, setMyPendingVenueSubmissions] = useState<PendingVenueSubmission[]>([]);
  const [myPendingGameSubmissions, setMyPendingGameSubmissions] = useState<PendingGameSubmission[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [isLoadingMyPendingItems, setIsLoadingMyPendingItems] = useState(false);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [myPendingMessage, setMyPendingMessage] = useState<string | null>(null);
  const [activeModerationReportId, setActiveModerationReportId] = useState<string | null>(null);
  const [activeModerationSubmissionId, setActiveModerationSubmissionId] = useState<string | null>(null);
  const [activeWithdrawalId, setActiveWithdrawalId] = useState<string | null>(null);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueStreetAddress, setNewVenueStreetAddress] = useState('');
  const [newVenueCity, setNewVenueCity] = useState('');
  const [newVenueRegion, setNewVenueRegion] = useState('TX');
  const [newVenuePostalCode, setNewVenuePostalCode] = useState('');
  const [newVenueWebsite, setNewVenueWebsite] = useState('');
  const [newVenueNotes, setNewVenueNotes] = useState('');
  const [newVenueMessage, setNewVenueMessage] = useState<string | null>(null);
  const [isCreatingVenue, setIsCreatingVenue] = useState(false);
  const [isAddingVenue, setIsAddingVenue] = useState(false);
  const [newGameTitle, setNewGameTitle] = useState('');
  const [newGameManufacturer, setNewGameManufacturer] = useState('');
  const [newGameReleaseYear, setNewGameReleaseYear] = useState('');
  const [newGameAliases, setNewGameAliases] = useState('');
  const [newGameCategories, setNewGameCategories] = useState('');
  const [newGameMessage, setNewGameMessage] = useState<string | null>(null);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isAddingGame, setIsAddingGame] = useState(false);
  const [sessionReportCount, setSessionReportCount] = useState(0);
  const [lastSubmittedSummary, setLastSubmittedSummary] = useState<string | null>(null);
  const [sessionSubmissions, setSessionSubmissions] = useState<SessionSubmission[]>([]);
  const [hasLoadedRecentPicks, setHasLoadedRecentPicks] = useState(false);
  const [appliedRouteGameId, setAppliedRouteGameId] = useState<string | null>(null);
  const [appliedRouteVenueId, setAppliedRouteVenueId] = useState<string | null>(null);

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

  const visibleRecentVenues = useMemo(() => {
    if (!selectedVenue) {
      return recentVenues;
    }

    return recentVenues.filter((venue) => venue.id !== selectedVenue.id);
  }, [recentVenues, selectedVenue]);

  const visibleRecentGames = useMemo(() => {
    if (!selectedGame) {
      return recentGames;
    }

    return recentGames.filter((game) => game.id !== selectedGame.id);
  }, [recentGames, selectedGame]);
  const parsedQuantity = Number(quantity);
  const canSubmitReport =
    Boolean(sessionEmail) &&
    Boolean(selectedVenue && selectedGame) &&
    Number.isFinite(parsedQuantity) &&
    parsedQuantity >= 1 &&
    !isSubmitting;
  const canContribute = Boolean(sessionEmail);
  const reviewQueueCount =
    pendingReports.length + pendingVenueSubmissions.length + pendingGameSubmissions.length;
  const myPendingItemCount =
    myPendingReports.length + myPendingVenueSubmissions.length + myPendingGameSubmissions.length;
  const duplicateSubmission = useMemo(() => {
    if (!selectedVenue || !selectedGame) {
      return null;
    }

    return sessionSubmissions.find(
      (submission) =>
        submission.venueId === selectedVenue.id &&
        submission.gameId === selectedGame.id &&
        submission.reportType === selectedReportType,
    ) ?? null;
  }, [selectedGame, selectedReportType, selectedVenue, sessionSubmissions]);
  const recentSubmissionsForSelectedVenue = useMemo(() => {
    if (!selectedVenue) {
      return sessionSubmissions.slice(0, 5);
    }

    return sessionSubmissions
      .filter((submission) => submission.venueId === selectedVenue.id)
      .slice(0, 5);
  }, [selectedVenue, sessionSubmissions]);
  const pendingReportCountsByGameVenue = useMemo(() => {
    return pendingReports.reduce<Record<string, number>>((counts, report) => {
      const key = `${report.venueId}:${report.gameId}`;
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
  }, [pendingReports]);
  const groupedPendingReports = useMemo<GroupedPendingReports[]>(() => {
    const groupsByVenue = pendingReports.reduce<Record<string, GroupedPendingReports>>(
      (groups, report) => {
        if (!groups[report.venueId]) {
          groups[report.venueId] = {
            reports: [],
            venueId: report.venueId,
            venueName: report.venueName,
          };
        }

        groups[report.venueId].reports.push(report);
        return groups;
      },
      {},
    );

    return Object.values(groupsByVenue);
  }, [pendingReports]);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentPicks() {
      const [storedVenues, storedGames] = await Promise.all([
        AsyncStorage.getItem(RECENT_VENUES_STORAGE_KEY),
        AsyncStorage.getItem(RECENT_GAMES_STORAGE_KEY),
      ]);

      if (!cancelled) {
        setRecentVenues(parseStoredRecentVenues(storedVenues));
        setRecentGames(parseStoredRecentGames(storedGames));
        setHasLoadedRecentPicks(true);
      }
    }

    void loadRecentPicks();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedRecentPicks) {
      return;
    }

    void AsyncStorage.setItem(
      RECENT_VENUES_STORAGE_KEY,
      JSON.stringify(recentVenues),
    );
  }, [hasLoadedRecentPicks, recentVenues]);

  useEffect(() => {
    if (!hasLoadedRecentPicks) {
      return;
    }

    void AsyncStorage.setItem(
      RECENT_GAMES_STORAGE_KEY,
      JSON.stringify(recentGames),
    );
  }, [hasLoadedRecentPicks, recentGames]);

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

      let nextSessionRole: UserRole | null = null;
      let nextSessionEmail: string | null = null;

      try {
        const [user, authSummary] = await Promise.all([
          getScoutSessionUser(),
          getAuthSessionSummary(),
        ]);

        nextSessionEmail = user?.email ?? null;

        if (!cancelled) {
          setSessionEmail(nextSessionEmail);
          setSessionRole(authSummary?.role ?? null);
        }

        nextSessionRole = authSummary?.role ?? null;
      } catch {
        if (!cancelled) {
          setSessionEmail(null);
          setSessionRole(null);
        }
      }

      if (nextSessionEmail) {
        try {
          const [
            nextMyPendingReports,
            nextMyPendingVenueSubmissions,
            nextMyPendingGameSubmissions,
          ] = await Promise.all([
            listMyPendingScoutReports(),
            listMyPendingVenueSubmissions(),
            listMyPendingGameSubmissions(),
          ]);

          if (!cancelled) {
            setMyPendingReports(nextMyPendingReports);
            setMyPendingVenueSubmissions(nextMyPendingVenueSubmissions);
            setMyPendingGameSubmissions(nextMyPendingGameSubmissions);
          }
        } catch {
          if (!cancelled) {
            setMyPendingMessage('Could not load your pending submissions.');
          }
        }
      }

      if (nextSessionRole === 'admin') {
        try {
          const [
            nextPendingReports,
            nextPendingVenueSubmissions,
            nextPendingGameSubmissions,
          ] = await Promise.all([
            listPendingScoutReports(),
            listPendingVenueSubmissions(),
            listPendingGameSubmissions(),
          ]);

          if (!cancelled) {
            setPendingReports(nextPendingReports);
            setPendingVenueSubmissions(nextPendingVenueSubmissions);
            setPendingGameSubmissions(nextPendingGameSubmissions);
          }
        } catch {
          if (!cancelled) {
            setLoadError((currentMessage) =>
              currentMessage ??
              'Scout Mode loaded, but the review queue is unavailable until you sign in with an admin account.',
            );
          }
        } finally {
          if (!cancelled) {
            setIsLoadingQueue(false);
          }
        }
      } else if (!cancelled) {
        setIsLoadingQueue(false);
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
    if (sessionRole !== 'admin') {
      return;
    }

    setIsLoadingQueue(true);

    try {
      const [
        nextPendingReports,
        nextPendingVenueSubmissions,
        nextPendingGameSubmissions,
      ] = await Promise.all([
        listPendingScoutReports(),
        listPendingVenueSubmissions(),
        listPendingGameSubmissions(),
      ]);
      setPendingReports(nextPendingReports);
      setPendingVenueSubmissions(nextPendingVenueSubmissions);
      setPendingGameSubmissions(nextPendingGameSubmissions);
    } catch {
      setQueueMessage('Could not refresh the pending review queue.');
    } finally {
      setIsLoadingQueue(false);
    }
  }

  async function refreshMyPendingItems() {
    if (!sessionEmail) {
      return;
    }

    setIsLoadingMyPendingItems(true);

    try {
      const [
        nextMyPendingReports,
        nextMyPendingVenueSubmissions,
        nextMyPendingGameSubmissions,
      ] = await Promise.all([
        listMyPendingScoutReports(),
        listMyPendingVenueSubmissions(),
        listMyPendingGameSubmissions(),
      ]);

      setMyPendingReports(nextMyPendingReports);
      setMyPendingVenueSubmissions(nextMyPendingVenueSubmissions);
      setMyPendingGameSubmissions(nextMyPendingGameSubmissions);
    } catch {
      setMyPendingMessage('Could not refresh your pending submissions.');
    } finally {
      setIsLoadingMyPendingItems(false);
    }
  }

  async function refreshScoutVenues() {
    const nextVenues = await listScoutVenues();
    setVenues(nextVenues);
    return nextVenues;
  }

  function selectVenueForReport(venue: ScoutVenue) {
    setSelectedVenue(venue);
    setVenueQuery(venue.name);
    setIsAddingVenue(false);
    setRecentVenues((currentVenues) => [
      venue,
      ...currentVenues.filter((currentVenue) => currentVenue.id !== venue.id),
    ].slice(0, RECENT_VENUES_LIMIT));
  }

  useEffect(() => {
    if (!params.venueId || venues.length === 0 || appliedRouteVenueId === params.venueId) {
      return;
    }

    const matchedVenue = venues.find((venue) => venue.id === params.venueId);

    if (matchedVenue) {
      selectVenueForReport(matchedVenue);
      setAppliedRouteVenueId(params.venueId);
      setSubmitMessage(`Ready to scout ${matchedVenue.name}. Pick a game to report.`);
    }
  }, [appliedRouteVenueId, params.venueId, venues]);

  function selectGameForReport(game: Game) {
    setSelectedGame(game);
    setGameQuery(game.title);
    setIsAddingGame(false);
    setRecentGames((currentGames) => [
      game,
      ...currentGames.filter((currentGame) => currentGame.id !== game.id),
    ].slice(0, RECENT_GAMES_LIMIT));
  }

  useEffect(() => {
    if (!params.gameId || !params.gameTitle || appliedRouteGameId === params.gameId) {
      return;
    }

    const releaseYear = Number(params.gameReleaseYear);
    const routeGame: Game = {
      aliases: [],
      categories: params.gameCategories
        ?.split('|')
        .map((category) => category.trim())
        .filter(Boolean) ?? [],
      id: params.gameId,
      manufacturer: params.gameManufacturer ?? 'Unknown',
      releaseYear: Number.isFinite(releaseYear) ? releaseYear : 0,
      slug: params.gameSlug ?? params.gameId,
      title: params.gameTitle,
    };

    selectGameForReport(routeGame);
    setAppliedRouteGameId(params.gameId);

    if (isScoutReportType(params.reportType)) {
      setSelectedReportType(params.reportType);
    }

    setSubmitMessage(`Ready to report ${routeGame.title}. Confirm the status and submit.`);
  }, [
    appliedRouteGameId,
    params.gameId,
    params.gameCategories,
    params.gameManufacturer,
    params.gameReleaseYear,
    params.gameSlug,
    params.gameTitle,
    params.reportType,
  ]);

  function clearSelectedVenue() {
    setSelectedVenue(null);
    setVenueQuery('');
  }

  function cancelAddVenue() {
    setIsAddingVenue(false);
    setNewVenueMessage(null);
  }

  function cancelAddGame() {
    setIsAddingGame(false);
    setNewGameMessage(null);
  }

  function resetReportDetails() {
    setSelectedGame(null);
    setGameQuery('');
    setQuantity('1');
    setMachineLabel('');
    setNotes('');
  }

  function addQuickNote(note: string) {
    setNotes((currentNotes) => {
      const trimmedNotes = currentNotes.trim();

      if (!trimmedNotes) {
        return note;
      }

      if (trimmedNotes.toLowerCase().includes(note.toLowerCase())) {
        return currentNotes;
      }

      return `${trimmedNotes}; ${note}`;
    });
  }

  async function approveReport(reportId: string) {
    setActiveModerationReportId(reportId);
    setQueueMessage(null);

    try {
      const result = await approveScoutInventoryReport(reportId);
      await refreshPendingReports();
      setQueueMessage(
        result
          ? `Report approved. Live inventory now reflects ${result.resultingAvailabilityStatus} with qty ${result.resultingQuantity}.`
          : 'Report approved.',
      );
    } catch {
      setQueueMessage(
        'Approval failed. Confirm you are signed in with an admin account and try again.',
      );
    } finally {
      setActiveModerationReportId(null);
    }
  }

  async function rejectReport(reportId: string) {
    setActiveModerationReportId(reportId);
    setQueueMessage(null);

    try {
      await rejectScoutInventoryReport(reportId);
      await refreshPendingReports();
      setQueueMessage('Report rejected and removed from the pending queue.');
    } catch {
      setQueueMessage(
        'Rejection failed. Confirm you are signed in with an admin account and try again.',
      );
    } finally {
      setActiveModerationReportId(null);
    }
  }

  async function approveVenueReviewItem(submissionId: string) {
    setActiveModerationSubmissionId(submissionId);
    setQueueMessage(null);

    try {
      const result = await approveVenueSubmission(submissionId);
      await Promise.all([refreshPendingReports(), refreshScoutVenues()]);
      setQueueMessage(
        result
          ? `Venue approved: ${result.createdVenueName}.`
          : 'Venue submission approved.',
      );
    } catch {
      setQueueMessage('Venue approval failed. Confirm you are signed in as admin.');
    } finally {
      setActiveModerationSubmissionId(null);
    }
  }

  async function rejectVenueReviewItem(submissionId: string) {
    setActiveModerationSubmissionId(submissionId);
    setQueueMessage(null);

    try {
      await rejectVenueSubmission(submissionId);
      await refreshPendingReports();
      setQueueMessage('Venue submission rejected.');
    } catch {
      setQueueMessage('Venue rejection failed. Confirm you are signed in as admin.');
    } finally {
      setActiveModerationSubmissionId(null);
    }
  }

  async function approveGameReviewItem(submissionId: string) {
    setActiveModerationSubmissionId(submissionId);
    setQueueMessage(null);

    try {
      const result = await approveGameSubmission(submissionId);
      await refreshPendingReports();
      setQueueMessage(
        result
          ? `Game approved: ${result.createdGameTitle}.`
          : 'Game submission approved.',
      );
    } catch {
      setQueueMessage('Game approval failed. Confirm you are signed in as admin.');
    } finally {
      setActiveModerationSubmissionId(null);
    }
  }

  async function rejectGameReviewItem(submissionId: string) {
    setActiveModerationSubmissionId(submissionId);
    setQueueMessage(null);

    try {
      await rejectGameSubmission(submissionId);
      await refreshPendingReports();
      setQueueMessage('Game submission rejected.');
    } catch {
      setQueueMessage('Game rejection failed. Confirm you are signed in as admin.');
    } finally {
      setActiveModerationSubmissionId(null);
    }
  }

  async function withdrawReport(reportId: string) {
    setActiveWithdrawalId(reportId);
    setMyPendingMessage(null);

    try {
      await withdrawScoutInventoryReport(reportId);
      await refreshMyPendingItems();
      setMyPendingMessage('Report withdrawn. You can submit a corrected version now.');
    } catch (error) {
      setMyPendingMessage(getScoutErrorMessage(error));
    } finally {
      setActiveWithdrawalId(null);
    }
  }

  async function withdrawVenueReviewItem(submissionId: string) {
    setActiveWithdrawalId(submissionId);
    setMyPendingMessage(null);

    try {
      await withdrawVenueSubmission(submissionId);
      await refreshMyPendingItems();
      setMyPendingMessage('Venue submission withdrawn. You can submit a corrected version now.');
    } catch (error) {
      setMyPendingMessage(getScoutErrorMessage(error));
    } finally {
      setActiveWithdrawalId(null);
    }
  }

  async function withdrawGameReviewItem(submissionId: string) {
    setActiveWithdrawalId(submissionId);
    setMyPendingMessage(null);

    try {
      await withdrawGameSubmission(submissionId);
      await refreshMyPendingItems();
      setMyPendingMessage('Game submission withdrawn. You can submit a corrected version now.');
    } catch (error) {
      setMyPendingMessage(getScoutErrorMessage(error));
    } finally {
      setActiveWithdrawalId(null);
    }
  }

  async function submitReport() {
    if (!sessionEmail) {
      setSubmitMessage('Sign in or create an account before submitting a report.');
      return;
    }

    if (!selectedVenue || !selectedGame) {
      setSubmitMessage('Pick a venue and a game before submitting a scout report.');
      return;
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
      setSubmitMessage('Quantity must be at least 1.');
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const submittedVenueName = selectedVenue.name;
      const submittedGameTitle = selectedGame.title;

      await submitScoutInventoryReport({
        gameId: selectedGame.id,
        machineLabel,
        notes,
        quantity: parsedQuantity,
        reportType: selectedReportType,
        venueId: selectedVenue.id,
      });

      const reportLabel = getReportTypeLabel(selectedReportType);

      setSessionReportCount((currentCount) => currentCount + 1);
      setLastSubmittedSummary(`${submittedGameTitle} at ${submittedVenueName}`);
      setSessionSubmissions((currentSubmissions) => [
        {
          gameId: selectedGame.id,
          gameTitle: submittedGameTitle,
          id: `${selectedVenue.id}-${selectedGame.id}-${selectedReportType}-${Date.now()}`,
          quantity: parsedQuantity,
          reportLabel,
          reportType: selectedReportType,
          submittedAt: new Date().toISOString(),
          venueId: selectedVenue.id,
          venueName: submittedVenueName,
        },
        ...currentSubmissions,
      ].slice(0, 20));
      setSubmitMessage(
        `Submitted ${submittedGameTitle}. ${submittedVenueName} is still selected for the next cabinet.`,
      );
      resetReportDetails();
      await refreshMyPendingItems();

      if (sessionRole === 'admin') {
        await refreshPendingReports();
      }
    } catch (error) {
      const detail = getScoutErrorMessage(error);
      setSubmitMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createVenueFromForm() {
    if (!sessionEmail) {
      setNewVenueMessage('Sign in or create an account before submitting a venue.');
      return;
    }

    if (!newVenueName.trim() || !newVenueStreetAddress.trim() || !newVenueCity.trim() || !newVenueRegion.trim()) {
      setNewVenueMessage('Enter the venue name, street address, city, and region before saving.');
      return;
    }

    setIsCreatingVenue(true);
    setNewVenueMessage(null);

    try {
      const geocodeQuery = [
        newVenueStreetAddress.trim(),
        newVenueCity.trim(),
        newVenueRegion.trim(),
        newVenuePostalCode.trim(),
      ]
        .filter(Boolean)
        .join(', ');

      const resolvedLocation = await resolveAppLocation(geocodeQuery);

      if (!resolvedLocation) {
        setNewVenueMessage('Could not geocode that address yet. Double-check the address and try again.');
        return;
      }

      if (sessionRole !== 'admin') {
        const submittedVenue = await submitScoutVenueSubmission({
          name: newVenueName,
          streetAddress: newVenueStreetAddress,
          city: newVenueCity,
          country: 'US',
          latitude: resolvedLocation.coordinates.latitude,
          longitude: resolvedLocation.coordinates.longitude,
          notes: newVenueNotes,
          postalCode: newVenuePostalCode,
          region: newVenueRegion,
          website: newVenueWebsite,
        });

        if (!submittedVenue) {
          setNewVenueMessage('Venue submission did not return a review item. Try again.');
          return;
        }

        setNewVenueName('');
        setNewVenueStreetAddress('');
        setNewVenueCity('');
        setNewVenueRegion('TX');
        setNewVenuePostalCode('');
        setNewVenueWebsite('');
        setNewVenueNotes('');
        setNewVenueMessage('Venue submitted for admin review. It will appear in search after approval.');
        await refreshMyPendingItems();
        return;
      }

      const createdVenue = await createScoutVenue({
        name: newVenueName,
        streetAddress: newVenueStreetAddress,
        city: newVenueCity,
        country: 'US',
        latitude: resolvedLocation.coordinates.latitude,
        longitude: resolvedLocation.coordinates.longitude,
        notes: newVenueNotes,
        postalCode: newVenuePostalCode,
        region: newVenueRegion,
        website: newVenueWebsite,
      });

      if (!createdVenue) {
        setNewVenueMessage('Venue creation did not return a saved venue. Try again.');
        return;
      }

      const nextVenues = await refreshScoutVenues();
      const matchedVenue =
        nextVenues.find((venue) => venue.id === createdVenue.id) ??
        {
          address: createdVenue.address,
          city: createdVenue.city,
          id: createdVenue.id,
          name: createdVenue.name,
          region: createdVenue.region,
          slug: createdVenue.slug,
        };

      selectVenueForReport(matchedVenue);
      setNewVenueName('');
      setNewVenueStreetAddress('');
      setNewVenueCity('');
      setNewVenueRegion('TX');
      setNewVenuePostalCode('');
      setNewVenueWebsite('');
      setNewVenueNotes('');
      setNewVenueMessage(`Saved ${createdVenue.name} and selected it for the next report.`);
    } catch (error) {
      const detail = getScoutErrorMessage(error);
      setNewVenueMessage(
        sessionRole === 'admin'
          ? `Could not create that venue yet: ${detail}`
          : detail,
      );
    } finally {
      setIsCreatingVenue(false);
    }
  }

  async function createGameFromForm() {
    if (!sessionEmail) {
      setNewGameMessage('Sign in or create an account before submitting a game.');
      return;
    }

    if (!newGameTitle.trim()) {
      setNewGameMessage('Enter the game title before saving.');
      return;
    }

    const parsedReleaseYear = newGameReleaseYear.trim()
      ? Number(newGameReleaseYear)
      : null;

    if (
      parsedReleaseYear !== null &&
      (!Number.isInteger(parsedReleaseYear) || parsedReleaseYear < 1970 || parsedReleaseYear > 2100)
    ) {
      setNewGameMessage('Release year must be a whole number between 1970 and 2100.');
      return;
    }

    setIsCreatingGame(true);
    setNewGameMessage(null);

    try {
      const nextAliases = newGameAliases
        .split('|')
        .map((alias) => alias.trim())
        .filter(Boolean);
      const nextCategories = newGameCategories
        .split('|')
        .map((category) => category.trim())
        .filter(Boolean);

      if (sessionRole !== 'admin') {
        const submittedGame = await submitScoutGameSubmission({
          aliases: nextAliases,
          categories: nextCategories,
          manufacturer: newGameManufacturer,
          releaseYear: parsedReleaseYear,
          title: newGameTitle,
        });

        if (!submittedGame) {
          setNewGameMessage('Game submission did not return a review item. Try again.');
          return;
        }

        setNewGameTitle('');
        setNewGameManufacturer('');
        setNewGameReleaseYear('');
        setNewGameAliases('');
        setNewGameCategories('');
        setNewGameMessage('Game submitted for admin review. It will appear in search after approval.');
        await refreshMyPendingItems();
        return;
      }

      const createdGame = await createScoutGame({
        aliases: nextAliases,
        categories: nextCategories,
        manufacturer: newGameManufacturer,
        releaseYear: parsedReleaseYear,
        title: newGameTitle,
      });

      if (!createdGame) {
        setNewGameMessage('Game creation did not return a saved game. Try again.');
        return;
      }

      const selectedCreatedGame: Game = {
        id: createdGame.id,
        slug: createdGame.slug,
        title: createdGame.title,
        manufacturer: createdGame.manufacturer ?? '',
        releaseYear: createdGame.releaseYear ?? 0,
        aliases: createdGame.aliases,
        categories: createdGame.categories,
      };

      selectGameForReport(selectedCreatedGame);
      setGameResults((currentResults) => [selectedCreatedGame, ...currentResults]);
      setNewGameTitle('');
      setNewGameManufacturer('');
      setNewGameReleaseYear('');
      setNewGameAliases('');
      setNewGameCategories('');
      setNewGameMessage(`Saved ${createdGame.title} and selected it for the next report.`);
    } catch (error) {
      const detail = getScoutErrorMessage(error);
      setNewGameMessage(
        sessionRole === 'admin'
          ? `Could not create that game yet: ${detail}`
          : detail,
      );
    } finally {
      setIsCreatingGame(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isWideLayout && styles.contentWide,
        ]}
      >
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
              <Text style={styles.heroStatValue}>
                {sessionEmail ? sessionRole ?? 'contributor' : 'guest'}
              </Text>
              <Text style={styles.heroStatLabel}>current access role</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{reviewQueueCount}</Text>
              <Text style={styles.heroStatLabel}>pending review items</Text>
            </View>
          </View>
        </View>

        {loadError ? <Text style={styles.warningText}>{loadError}</Text> : null}

        <View style={styles.sessionPanel}>
          <View style={styles.sessionPanelHeader}>
            <Text style={styles.sectionTitle}>Field session</Text>
            <Text style={styles.sessionBadge}>
              {sessionReportCount === 1
                ? '1 report this session'
                : `${sessionReportCount} reports this session`}
            </Text>
          </View>
          <Text style={styles.helperText}>
            Scout Mode now keeps your selected venue after each submission, so you can
            walk cabinet-to-cabinet and only pick the next game.
          </Text>
          {lastSubmittedSummary ? (
            <Text style={styles.helperMessage}>Last submitted: {lastSubmittedSummary}</Text>
          ) : null}
          {recentSubmissionsForSelectedVenue.length > 0 ? (
            <View style={styles.sessionHistory}>
              <Text style={styles.shortcutLabel}>
                {selectedVenue ? `Recently submitted here` : 'Recent submissions'}
              </Text>
              {recentSubmissionsForSelectedVenue.map((submission) => (
                <View key={submission.id} style={styles.sessionHistoryItem}>
                  <Text style={styles.sessionHistoryTitle}>
                    {submission.gameTitle}
                  </Text>
                  <Text style={styles.sessionHistoryMeta}>
                    {submission.reportLabel} • Qty {submission.quantity}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {sessionEmail ? (
          <View style={styles.panel}>
            <View style={styles.queueHeader}>
              <View>
                <Text style={styles.sectionTitle}>My pending submissions</Text>
                <Text style={styles.queueHeaderMeta}>
                  {myPendingItemCount} pending item{myPendingItemCount === 1 ? '' : 's'}
                </Text>
              </View>
              <Pressable
                onPress={() => void refreshMyPendingItems()}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>
                  {isLoadingMyPendingItems ? 'Refreshing...' : 'Refresh'}
                </Text>
              </Pressable>
            </View>

            {myPendingMessage ? (
              <Text style={styles.helperMessage}>{myPendingMessage}</Text>
            ) : null}

            {isLoadingMyPendingItems ? (
              <Text style={styles.emptyText}>Loading your pending submissions...</Text>
            ) : myPendingItemCount > 0 ? (
              <View style={styles.cardList}>
                {myPendingReports.map((report) => (
                  <View key={report.reportId} style={styles.queueCard}>
                    <View style={styles.queueCardTop}>
                      <Text style={styles.queueTitle}>{report.gameTitle}</Text>
                      <Text style={styles.queueMeta}>{getPendingReportLabel(report.reportType)}</Text>
                    </View>
                    <Text style={styles.queueMeta}>
                      {report.venueName} • Qty {report.quantity}
                      {report.machineLabel ? ` • ${report.machineLabel}` : ''}
                    </Text>
                    {report.notes ? (
                      <Text style={styles.queueNote}>{report.notes}</Text>
                    ) : null}
                    <View style={styles.queueActions}>
                      <Pressable
                        disabled={activeWithdrawalId === report.reportId}
                        onPress={() => void withdrawReport(report.reportId)}
                        style={[
                          styles.queueActionButton,
                          styles.queueRejectButton,
                          activeWithdrawalId === report.reportId && styles.queueActionButtonDisabled,
                        ]}
                      >
                        <Text style={styles.queueRejectButtonText}>
                          {activeWithdrawalId === report.reportId ? 'Working...' : 'Withdraw'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}

                {myPendingVenueSubmissions.map((submission) => (
                  <View key={submission.submissionId} style={styles.queueCard}>
                    <Text style={styles.queueTitle}>{submission.name}</Text>
                    <Text style={styles.queueMeta}>
                      Venue submission • {submission.streetAddress ? `${submission.streetAddress}, ` : ''}
                      {submission.city}, {submission.region}
                    </Text>
                    {submission.notes ? (
                      <Text style={styles.queueNote}>{submission.notes}</Text>
                    ) : null}
                    <View style={styles.queueActions}>
                      <Pressable
                        disabled={activeWithdrawalId === submission.submissionId}
                        onPress={() => void withdrawVenueReviewItem(submission.submissionId)}
                        style={[
                          styles.queueActionButton,
                          styles.queueRejectButton,
                          activeWithdrawalId === submission.submissionId && styles.queueActionButtonDisabled,
                        ]}
                      >
                        <Text style={styles.queueRejectButtonText}>
                          {activeWithdrawalId === submission.submissionId ? 'Working...' : 'Withdraw'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}

                {myPendingGameSubmissions.map((submission) => (
                  <View key={submission.submissionId} style={styles.queueCard}>
                    <Text style={styles.queueTitle}>{submission.title}</Text>
                    <Text style={styles.queueMeta}>
                      Game submission • {submission.manufacturer ?? 'Unknown manufacturer'}
                      {submission.releaseYear ? ` • ${submission.releaseYear}` : ''}
                    </Text>
                    {submission.notes ? (
                      <Text style={styles.queueNote}>{submission.notes}</Text>
                    ) : null}
                    <View style={styles.queueActions}>
                      <Pressable
                        disabled={activeWithdrawalId === submission.submissionId}
                        onPress={() => void withdrawGameReviewItem(submission.submissionId)}
                        style={[
                          styles.queueActionButton,
                          styles.queueRejectButton,
                          activeWithdrawalId === submission.submissionId && styles.queueActionButtonDisabled,
                        ]}
                      >
                        <Text style={styles.queueRejectButtonText}>
                          {activeWithdrawalId === submission.submissionId ? 'Working...' : 'Withdraw'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>
                You do not have any pending submissions right now.
              </Text>
            )}
          </View>
        ) : null}

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
                <View style={styles.selectionActions}>
                  <Pressable onPress={clearSelectedVenue} style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>Change venue</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Text style={styles.helperText}>
                Search by venue name or address, then tap the matching arcade.
              </Text>
            )}
            {visibleRecentVenues.length > 0 ? (
              <View style={styles.shortcutBlock}>
                <Text style={styles.shortcutLabel}>Recent venues</Text>
                <View style={styles.shortcutRow}>
                  {visibleRecentVenues.map((venue) => (
                    <Pressable
                      key={venue.id}
                      onPress={() => selectVenueForReport(venue)}
                      style={styles.shortcutChip}
                    >
                      <Text style={styles.shortcutChipText}>{venue.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            {visibleVenues.length > 0 ? (
              <View style={styles.cardList}>
                {visibleVenues.map((venue) => (
                  <Pressable
                    key={venue.id}
                    onPress={() => selectVenueForReport(venue)}
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
            {canContribute && !selectedVenue && !isAddingVenue ? (
              <Pressable
                onPress={() => setIsAddingVenue(true)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Add missing venue</Text>
              </Pressable>
            ) : null}
            {canContribute && !selectedVenue && isAddingVenue ? (
              <View style={styles.subPanel}>
                <View style={styles.subPanelHeader}>
                  <Text style={styles.subPanelTitle}>Add a new venue</Text>
                  <Pressable onPress={cancelAddVenue} style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>Cancel</Text>
                  </Pressable>
                </View>
                <Text style={styles.helperText}>
                  If the arcade is missing, submit it here. Admin approval adds it to the live venue list.
                </Text>
                <TextInput
                  onChangeText={setNewVenueName}
                  placeholder="Venue name"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                  value={newVenueName}
                />
                <TextInput
                  onChangeText={setNewVenueStreetAddress}
                  placeholder="Street address"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                  value={newVenueStreetAddress}
                />
                <View style={styles.inlineFields}>
                  <TextInput
                    onChangeText={setNewVenueCity}
                    placeholder="City"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.input, styles.inlineInput]}
                    value={newVenueCity}
                  />
                  <TextInput
                    autoCapitalize="characters"
                    onChangeText={setNewVenueRegion}
                    placeholder="State"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.input, styles.inlineInputSmall]}
                    value={newVenueRegion}
                  />
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setNewVenuePostalCode}
                    placeholder="ZIP"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.input, styles.inlineInputSmall]}
                    value={newVenuePostalCode}
                  />
                </View>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={setNewVenueWebsite}
                  placeholder="Website (optional)"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                  value={newVenueWebsite}
                />
                <TextInput
                  multiline
                  onChangeText={setNewVenueNotes}
                  placeholder="Venue note (optional)"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[styles.input, styles.notesInput]}
                  value={newVenueNotes}
                />
                {newVenueMessage ? (
                  <Text style={styles.helperMessage}>{newVenueMessage}</Text>
                ) : null}
                <Pressable
                  disabled={isCreatingVenue}
                  onPress={() => void createVenueFromForm()}
                  style={[styles.secondaryButton, isCreatingVenue && styles.primaryButtonMuted]}
                >
                  <Text style={styles.secondaryButtonText}>
                    {isCreatingVenue
                      ? sessionRole === 'admin'
                        ? 'Saving venue...'
                        : 'Submitting venue...'
                      : sessionRole === 'admin'
                      ? 'Save new venue'
                      : 'Submit venue for review'}
                  </Text>
                </Pressable>
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
            {visibleRecentGames.length > 0 ? (
              <View style={styles.shortcutBlock}>
                <Text style={styles.shortcutLabel}>Recent games</Text>
                <View style={styles.shortcutRow}>
                  {visibleRecentGames.map((game) => (
                    <Pressable
                      key={game.id}
                      onPress={() => selectGameForReport(game)}
                      style={styles.shortcutChip}
                    >
                      <Text style={styles.shortcutChipText}>{game.title}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            {visibleGameResults.length > 0 ? (
              <View style={styles.cardList}>
                {visibleGameResults.map((game) => (
                  <Pressable
                    key={game.id}
                    onPress={() => selectGameForReport(game)}
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
            {canContribute && !selectedGame && !isAddingGame ? (
              <Pressable
                onPress={() => setIsAddingGame(true)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Add missing game</Text>
              </Pressable>
            ) : null}
            {canContribute && !selectedGame && isAddingGame ? (
              <View style={styles.subPanel}>
                <View style={styles.subPanelHeader}>
                  <Text style={styles.subPanelTitle}>Add a new game</Text>
                  <Pressable onPress={cancelAddGame} style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>Cancel</Text>
                  </Pressable>
                </View>
                <Text style={styles.helperText}>
                  Use this when a real cabinet is missing from the catalog. Admin approval adds it to live search.
                </Text>
                <TextInput
                  onChangeText={setNewGameTitle}
                  placeholder="Game title"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                  value={newGameTitle}
                />
                <View style={styles.inlineFields}>
                  <TextInput
                    onChangeText={setNewGameManufacturer}
                    placeholder="Manufacturer"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.input, styles.inlineInput]}
                    value={newGameManufacturer}
                  />
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setNewGameReleaseYear}
                    placeholder="Year"
                    placeholderTextColor={theme.colors.textMuted}
                    style={[styles.input, styles.inlineInputSmall]}
                    value={newGameReleaseYear}
                  />
                </View>
                <TextInput
                  onChangeText={setNewGameAliases}
                  placeholder="Aliases (pipe-separated)"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                  value={newGameAliases}
                />
                <TextInput
                  onChangeText={setNewGameCategories}
                  placeholder="Categories (pipe-separated)"
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                  value={newGameCategories}
                />
                {newGameMessage ? (
                  <Text style={styles.helperMessage}>{newGameMessage}</Text>
                ) : null}
                <Pressable
                  disabled={isCreatingGame}
                  onPress={() => void createGameFromForm()}
                  style={[styles.secondaryButton, isCreatingGame && styles.primaryButtonMuted]}
                >
                  <Text style={styles.secondaryButtonText}>
                    {isCreatingGame
                      ? sessionRole === 'admin'
                        ? 'Saving game...'
                        : 'Submitting game...'
                      : sessionRole === 'admin'
                      ? 'Save new game'
                      : 'Submit game for review'}
                  </Text>
                </Pressable>
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
            <View style={styles.shortcutBlock}>
              <Text style={styles.shortcutLabel}>Quick notes</Text>
              <View style={styles.shortcutRow}>
                {QUICK_NOTE_CHIPS.map((note) => (
                  <Pressable
                    key={note}
                    onPress={() => addQuickNote(note)}
                    style={styles.shortcutChip}
                  >
                    <Text style={styles.shortcutChipText}>{note}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {submitMessage ? (
              <Text style={styles.helperMessage}>{submitMessage}</Text>
            ) : null}
            {duplicateSubmission ? (
              <View style={styles.duplicateWarning}>
                <Text style={styles.duplicateWarningTitle}>
                  Possible duplicate
                </Text>
                <Text style={styles.duplicateWarningText}>
                  You already submitted {duplicateSubmission.reportLabel.toLowerCase()} for {duplicateSubmission.gameTitle} at this venue during this session.
                </Text>
              </View>
            ) : null}

            <Pressable
              disabled={!canSubmitReport}
              onPress={() => void submitReport()}
              style={[styles.primaryButton, !canSubmitReport && styles.primaryButtonMuted]}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting
                  ? 'Submitting...'
                  : canSubmitReport
                  ? 'Submit scout report'
                  : !sessionEmail
                  ? 'Sign in to submit'
                  : 'Pick venue and game to submit'}
              </Text>
            </Pressable>
          </View>

          {sessionRole === 'admin' ? (
            <View style={[styles.panel, styles.queuePanel]}>
              <View style={styles.queueHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Review queue</Text>
                  <Text style={styles.queueHeaderMeta}>
                    {reviewQueueCount} pending item{reviewQueueCount === 1 ? '' : 's'}
                  </Text>
                </View>
                <Pressable onPress={() => void refreshPendingReports()} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Refresh</Text>
                </Pressable>
              </View>
              {queueMessage ? <Text style={styles.helperMessage}>{queueMessage}</Text> : null}

              {isLoadingQueue ? (
                <Text style={styles.emptyText}>Loading pending review items...</Text>
              ) : reviewQueueCount > 0 ? (
                <View style={styles.cardList}>
                  {pendingVenueSubmissions.length > 0 ? (
                    <View style={styles.queueVenueGroup}>
                      <View style={styles.queueVenueHeader}>
                        <Text style={styles.queueVenueTitle}>Venue submissions</Text>
                        <Text style={styles.queueVenueCount}>
                          {pendingVenueSubmissions.length} pending
                        </Text>
                      </View>
                      <View style={styles.cardList}>
                        {pendingVenueSubmissions.map((submission) => (
                          <View key={submission.submissionId} style={styles.queueCard}>
                            <Text style={styles.queueTitle}>{submission.name}</Text>
                            <Text style={styles.queueMeta}>
                              {submission.streetAddress ? `${submission.streetAddress}, ` : ''}
                              {submission.city}, {submission.region}
                              {submission.postalCode ? ` ${submission.postalCode}` : ''}
                            </Text>
                            {submission.website ? (
                              <Text style={styles.queueMeta}>{submission.website}</Text>
                            ) : null}
                            {submission.notes ? (
                              <Text style={styles.queueNote}>{submission.notes}</Text>
                            ) : null}
                            <Text style={styles.queueMeta}>Submitted by {submission.submittedBy}</Text>
                            <View style={styles.queueActions}>
                              <Pressable
                                disabled={activeModerationSubmissionId === submission.submissionId}
                                onPress={() => void approveVenueReviewItem(submission.submissionId)}
                                style={[
                                  styles.queueActionButton,
                                  styles.queueApproveButton,
                                  activeModerationSubmissionId === submission.submissionId && styles.queueActionButtonDisabled,
                                ]}
                              >
                                <Text style={styles.queueApproveButtonText}>
                                  {activeModerationSubmissionId === submission.submissionId ? 'Working...' : 'Approve'}
                                </Text>
                              </Pressable>
                              <Pressable
                                disabled={activeModerationSubmissionId === submission.submissionId}
                                onPress={() => void rejectVenueReviewItem(submission.submissionId)}
                                style={[
                                  styles.queueActionButton,
                                  styles.queueRejectButton,
                                  activeModerationSubmissionId === submission.submissionId && styles.queueActionButtonDisabled,
                                ]}
                              >
                                <Text style={styles.queueRejectButtonText}>Reject</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {pendingGameSubmissions.length > 0 ? (
                    <View style={styles.queueVenueGroup}>
                      <View style={styles.queueVenueHeader}>
                        <Text style={styles.queueVenueTitle}>Game submissions</Text>
                        <Text style={styles.queueVenueCount}>
                          {pendingGameSubmissions.length} pending
                        </Text>
                      </View>
                      <View style={styles.cardList}>
                        {pendingGameSubmissions.map((submission) => (
                          <View key={submission.submissionId} style={styles.queueCard}>
                            <Text style={styles.queueTitle}>{submission.title}</Text>
                            <Text style={styles.queueMeta}>
                              {submission.manufacturer ?? 'Unknown manufacturer'}
                              {submission.releaseYear ? ` • ${submission.releaseYear}` : ''}
                            </Text>
                            {submission.categories.length > 0 ? (
                              <Text style={styles.queueNote}>
                                Categories: {submission.categories.join(', ')}
                              </Text>
                            ) : null}
                            {submission.aliases.length > 0 ? (
                              <Text style={styles.queueNote}>
                                Aliases: {submission.aliases.join(', ')}
                              </Text>
                            ) : null}
                            {submission.notes ? (
                              <Text style={styles.queueNote}>{submission.notes}</Text>
                            ) : null}
                            <Text style={styles.queueMeta}>Submitted by {submission.submittedBy}</Text>
                            <View style={styles.queueActions}>
                              <Pressable
                                disabled={activeModerationSubmissionId === submission.submissionId}
                                onPress={() => void approveGameReviewItem(submission.submissionId)}
                                style={[
                                  styles.queueActionButton,
                                  styles.queueApproveButton,
                                  activeModerationSubmissionId === submission.submissionId && styles.queueActionButtonDisabled,
                                ]}
                              >
                                <Text style={styles.queueApproveButtonText}>
                                  {activeModerationSubmissionId === submission.submissionId ? 'Working...' : 'Approve'}
                                </Text>
                              </Pressable>
                              <Pressable
                                disabled={activeModerationSubmissionId === submission.submissionId}
                                onPress={() => void rejectGameReviewItem(submission.submissionId)}
                                style={[
                                  styles.queueActionButton,
                                  styles.queueRejectButton,
                                  activeModerationSubmissionId === submission.submissionId && styles.queueActionButtonDisabled,
                                ]}
                              >
                                <Text style={styles.queueRejectButtonText}>Reject</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {groupedPendingReports.map((group) => (
                    <View key={group.venueId} style={styles.queueVenueGroup}>
                      <View style={styles.queueVenueHeader}>
                        <Text style={styles.queueVenueTitle}>{group.venueName}</Text>
                        <Text style={styles.queueVenueCount}>
                          {group.reports.length} report{group.reports.length === 1 ? '' : 's'}
                        </Text>
                      </View>

                      <View style={styles.cardList}>
                        {group.reports.map((report) => {
                          const reportTone = getReportTone(report.reportType);
                          const reportKey = `${report.venueId}:${report.gameId}`;
                          const duplicatePendingCount =
                            pendingReportCountsByGameVenue[reportKey] ?? 0;
                          const submittedThisSession = sessionSubmissions.some(
                            (submission) =>
                              submission.venueId === report.venueId &&
                              submission.gameId === report.gameId,
                          );

                          return (
                            <View key={report.reportId} style={styles.queueCard}>
                              <View style={styles.queueCardTop}>
                                <Text style={styles.queueTitle}>{report.gameTitle}</Text>
                                <Text
                                  style={[
                                    styles.queueTypePill,
                                    {
                                      backgroundColor: reportTone.backgroundColor,
                                      borderColor: reportTone.borderColor,
                                      color: reportTone.textColor,
                                    },
                                  ]}
                                >
                                  {getPendingReportLabel(report.reportType)}
                                </Text>
                              </View>
                              <Text style={styles.queueMeta}>
                                Qty {report.quantity}
                                {report.machineLabel ? ` • ${report.machineLabel}` : ''}
                              </Text>
                              {report.notes ? (
                                <Text style={styles.queueNote}>{report.notes}</Text>
                              ) : null}
                              <Text style={styles.queueMeta}>Submitted by {report.submittedBy}</Text>
                              {duplicatePendingCount > 1 || submittedThisSession ? (
                                <View style={styles.queueHints}>
                                  {duplicatePendingCount > 1 ? (
                                    <Text style={styles.queueHintText}>
                                      {duplicatePendingCount} pending reports for this game here
                                    </Text>
                                  ) : null}
                                  {submittedThisSession ? (
                                    <Text style={styles.queueHintText}>
                                      Also reported during this session
                                    </Text>
                                  ) : null}
                                </View>
                              ) : null}
                              <View style={styles.queueActions}>
                                <Pressable
                                  disabled={activeModerationReportId === report.reportId}
                                  onPress={() => void approveReport(report.reportId)}
                                  style={[
                                    styles.queueActionButton,
                                    styles.queueApproveButton,
                                    activeModerationReportId === report.reportId && styles.queueActionButtonDisabled,
                                  ]}
                                >
                                  <Text style={styles.queueApproveButtonText}>
                                    {activeModerationReportId === report.reportId ? 'Working...' : 'Approve'}
                                  </Text>
                                </Pressable>
                                <Pressable
                                  disabled={activeModerationReportId === report.reportId}
                                  onPress={() => void rejectReport(report.reportId)}
                                  style={[
                                    styles.queueActionButton,
                                    styles.queueRejectButton,
                                    activeModerationReportId === report.reportId && styles.queueActionButtonDisabled,
                                  ]}
                                >
                                  <Text style={styles.queueRejectButtonText}>Reject</Text>
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>
                  No reports are waiting for review.
                </Text>
              )}
            </View>
          ) : null}
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
    alignSelf: 'center',
    maxWidth: 1440,
    width: '100%',
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
  sessionPanel: {
    backgroundColor: 'rgba(8, 15, 30, 0.76)',
    borderColor: theme.colors.accentMuted,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  sessionPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.md,
    justifyContent: 'space-between',
  },
  sessionBadge: {
    color: theme.colors.brandMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sessionHistory: {
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
  sessionHistoryItem: {
    backgroundColor: 'rgba(8, 15, 30, 0.68)',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 10,
  },
  sessionHistoryTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  sessionHistoryMeta: {
    color: theme.colors.textSecondary,
    fontSize: 12,
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
  selectionActions: {
    alignItems: 'flex-start',
    marginTop: theme.spacing.xs,
  },
  ghostButton: {
    backgroundColor: 'rgba(8, 15, 30, 0.7)',
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ghostButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  shortcutBlock: {
    gap: theme.spacing.xs,
  },
  shortcutLabel: {
    color: theme.colors.accentMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  shortcutRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  shortcutChip: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  shortcutChipText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  subPanel: {
    backgroundColor: 'rgba(8, 15, 30, 0.66)',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  subPanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  subPanelTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  inlineFields: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  inlineInput: {
    flex: 1,
  },
  inlineInputSmall: {
    flexBasis: 92,
    flexGrow: 0,
    minWidth: 92,
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
  duplicateWarning: {
    backgroundColor: 'rgba(255, 213, 74, 0.12)',
    borderColor: theme.colors.warning,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: 4,
    padding: theme.spacing.md,
  },
  duplicateWarningTitle: {
    color: theme.colors.warning,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  duplicateWarningText: {
    color: theme.colors.textSecondary,
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
  queueHeaderMeta: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 2,
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
  queueVenueGroup: {
    backgroundColor: 'rgba(8, 15, 30, 0.54)',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
  },
  queueVenueHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'space-between',
  },
  queueVenueTitle: {
    color: theme.colors.textPrimary,
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  queueVenueCount: {
    color: theme.colors.accentMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
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
  queueTypePill: {
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
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
  queueHints: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  queueHintText: {
    backgroundColor: 'rgba(255, 213, 74, 0.1)',
    borderColor: theme.colors.warning,
    borderRadius: 999,
    borderWidth: 1,
    color: theme.colors.warning,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  queueActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  queueActionButton: {
    alignItems: 'center',
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  queueActionButtonDisabled: {
    opacity: 0.6,
  },
  queueApproveButton: {
    backgroundColor: theme.colors.brand,
    borderColor: theme.colors.brand,
  },
  queueApproveButtonText: {
    color: theme.colors.textOnBrand,
    fontSize: 13,
    fontWeight: '800',
  },
  queueRejectButton: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.warning,
  },
  queueRejectButtonText: {
    color: theme.colors.warning,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
});
