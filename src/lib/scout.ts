import { hasSupabaseCredentials } from '@/lib/env';
import { searchGamesLive } from '@/lib/live-data';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { Game } from '@/types/domain';

type VenueTableRow = Pick<
  Database['public']['Tables']['venues']['Row'],
  'id' | 'name' | 'slug' | 'street_address' | 'city' | 'region'
>;

interface ScoutVenue {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  region: string;
}

interface PendingInventoryReport {
  reportId: string;
  venueGameId: string | null;
  venueId: string;
  venueName: string;
  gameId: string;
  gameTitle: string;
  reportType: string;
  quantity: number;
  machineLabel: string | null;
  notes: string | null;
  createdAt: string;
  submittedBy: string;
}

interface CreatedScoutVenueResult {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  region: string;
  postalCode: string | null;
  country: string;
  latitude: number;
  longitude: number;
}

interface CreatedScoutGameResult {
  id: string;
  slug: string;
  title: string;
  manufacturer: string | null;
  releaseYear: number | null;
  aliases: string[];
  categories: string[];
}

interface SubmittedVenueSubmissionResult {
  submissionId: string;
  submissionStatus: string;
}

interface SubmittedGameSubmissionResult {
  submissionId: string;
  submissionStatus: string;
}

interface PendingVenueSubmission {
  submissionId: string;
  submittedBy: string;
  name: string;
  streetAddress: string | null;
  city: string;
  region: string;
  postalCode: string | null;
  country: string;
  latitude: number;
  longitude: number;
  website: string | null;
  notes: string | null;
  createdAt: string;
}

interface PendingGameSubmission {
  submissionId: string;
  submittedBy: string;
  title: string;
  manufacturer: string | null;
  releaseYear: number | null;
  aliases: string[];
  categories: string[];
  notes: string | null;
  createdAt: string;
}

interface WithdrawnInventoryReportResult {
  reportId: string;
  reportStatus: Database['public']['Tables']['inventory_reports']['Row']['status'];
  withdrawnAt: string;
}

interface ApprovedVenueSubmissionResult {
  submissionId: string;
  createdVenueId: string;
  createdVenueSlug: string;
  createdVenueName: string;
}

interface ApprovedGameSubmissionResult {
  submissionId: string;
  createdGameId: string;
  createdGameSlug: string;
  createdGameTitle: string;
}

interface RejectedSubmissionResult {
  submissionId: string;
  submissionStatus: string;
  reviewedAt: string;
}

interface WithdrawnSubmissionResult {
  submissionId: string;
  submissionStatus: string;
  withdrawnAt: string;
}

interface ApprovedInventoryReportResult {
  reportId: string;
  venueGameId: string;
  resultingAvailabilityStatus: string;
  resultingQuantity: number;
}

interface RejectedInventoryReportResult {
  reportId: string;
  reportStatus: Database['public']['Tables']['inventory_reports']['Row']['status'];
  reviewedAt: string;
}

export type ScoutReportType =
  | 'confirmed_present'
  | 'missing'
  | 'temporarily_unavailable'
  | 'new_machine'
  | 'quantity_changed';

export function getScoutErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  ) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'details' in error &&
    typeof error.details === 'string' &&
    error.details.trim()
  ) {
    return error.details;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown Scout Mode error.';
  }
}

export async function getScoutSessionUser() {
  if (!hasSupabaseCredentials || !supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user ?? null;
}

export async function listScoutVenues(): Promise<ScoutVenue[]> {
  if (!hasSupabaseCredentials || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('venues')
    .select('id, name, slug, street_address, city, region')
    .eq('status', 'active')
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as VenueTableRow[];

  return rows.map((row) => ({
    address: row.street_address ?? 'Address unavailable',
    city: row.city,
    id: row.id,
    name: row.name,
    region: row.region,
    slug: row.slug,
  }));
}

export async function createScoutVenue(input: {
  name: string;
  streetAddress: string;
  city: string;
  region: string;
  postalCode?: string;
  country?: string;
  latitude: number;
  longitude: number;
  website?: string;
  notes?: string;
}): Promise<CreatedScoutVenueResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'create_venue' as never,
    {
      venue_name: input.name.trim(),
      venue_street_address: input.streetAddress.trim(),
      venue_city: input.city.trim(),
      venue_region: input.region.trim(),
      venue_postal_code: input.postalCode?.trim() || null,
      venue_country: input.country?.trim() || 'US',
      venue_latitude: input.latitude,
      venue_longitude: input.longitude,
      venue_website: input.website?.trim() || null,
      venue_notes: input.notes?.trim() || null,
    } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as
    | {
        created_venue_id: string;
        created_venue_slug: string;
        created_venue_name: string;
        created_street_address: string | null;
        created_city: string;
        created_region: string;
        created_postal_code: string | null;
        created_country: string;
        created_latitude: number;
        created_longitude: number;
      }
    | null;

  if (!firstRow) {
    return null;
  }

  return {
    address: firstRow.created_street_address ?? 'Address unavailable',
    city: firstRow.created_city,
    country: firstRow.created_country,
    id: firstRow.created_venue_id,
    latitude: firstRow.created_latitude,
    longitude: firstRow.created_longitude,
    name: firstRow.created_venue_name,
    postalCode: firstRow.created_postal_code,
    region: firstRow.created_region,
    slug: firstRow.created_venue_slug,
  };
}

export async function createScoutGame(input: {
  title: string;
  manufacturer?: string;
  releaseYear?: number | null;
  aliases?: string[];
  categories?: string[];
}): Promise<CreatedScoutGameResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'create_game' as never,
    {
      game_title: input.title.trim(),
      game_manufacturer: input.manufacturer?.trim() || null,
      game_release_year: input.releaseYear ?? null,
      game_aliases:
        input.aliases
          ?.map((alias) => alias.trim())
          .filter(Boolean) ?? [],
      game_categories:
        input.categories
          ?.map((category) => category.trim())
          .filter(Boolean) ?? [],
    } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as
    | {
        created_game_id: string;
        created_game_slug: string;
        created_game_title: string;
        created_game_manufacturer: string | null;
        created_game_release_year: number | null;
        created_game_aliases: string[];
        created_game_categories: string[];
      }
    | null;

  if (!firstRow) {
    return null;
  }

  return {
    aliases: firstRow.created_game_aliases,
    categories: firstRow.created_game_categories,
    id: firstRow.created_game_id,
    manufacturer: firstRow.created_game_manufacturer,
    releaseYear: firstRow.created_game_release_year,
    slug: firstRow.created_game_slug,
    title: firstRow.created_game_title,
  };
}

export async function submitScoutVenueSubmission(input: {
  name: string;
  streetAddress: string;
  city: string;
  region: string;
  postalCode?: string;
  country?: string;
  latitude: number;
  longitude: number;
  website?: string;
  notes?: string;
}): Promise<SubmittedVenueSubmissionResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'submit_venue_submission' as never,
    {
      venue_name: input.name.trim(),
      venue_street_address: input.streetAddress.trim(),
      venue_city: input.city.trim(),
      venue_region: input.region.trim(),
      venue_postal_code: input.postalCode?.trim() || null,
      venue_country: input.country?.trim() || 'US',
      venue_latitude: input.latitude,
      venue_longitude: input.longitude,
      venue_website: input.website?.trim() || null,
      venue_notes: input.notes?.trim() || null,
    } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as
    | {
        submission_id: string;
        submission_status: string;
      }
    | null;

  if (!firstRow) {
    return null;
  }

  return {
    submissionId: firstRow.submission_id,
    submissionStatus: firstRow.submission_status,
  };
}

export async function submitScoutGameSubmission(input: {
  title: string;
  manufacturer?: string;
  releaseYear?: number | null;
  aliases?: string[];
  categories?: string[];
  notes?: string;
}): Promise<SubmittedGameSubmissionResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'submit_game_submission' as never,
    {
      game_title: input.title.trim(),
      game_manufacturer: input.manufacturer?.trim() || null,
      game_release_year: input.releaseYear ?? null,
      game_aliases:
        input.aliases
          ?.map((alias) => alias.trim())
          .filter(Boolean) ?? [],
      game_categories:
        input.categories
          ?.map((category) => category.trim())
          .filter(Boolean) ?? [],
      game_notes: input.notes?.trim() || null,
    } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as
    | {
        submission_id: string;
        submission_status: string;
      }
    | null;

  if (!firstRow) {
    return null;
  }

  return {
    submissionId: firstRow.submission_id,
    submissionStatus: firstRow.submission_status,
  };
}

export async function searchScoutGames(query: string): Promise<Game[]> {
  return searchGamesLive(query, 8);
}

export async function submitScoutInventoryReport(input: {
  venueId: string;
  gameId: string;
  reportType: ScoutReportType;
  quantity: number;
  notes?: string;
  machineLabel?: string;
}) {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'submit_inventory_report' as never,
    {
      selected_venue_id: input.venueId,
      selected_game_id: input.gameId,
      selected_report_type: input.reportType,
      reported_quantity: input.quantity,
      reported_notes: input.notes?.trim() || null,
      reported_machine_label: input.machineLabel?.trim() || null,
    } as never,
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function listPendingScoutReports(): Promise<PendingInventoryReport[]> {
  if (!hasSupabaseCredentials || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc(
    'list_pending_inventory_reports' as never,
    {} as never,
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    report_id: string;
    venue_game_id: string | null;
    venue_id: string;
    venue_name: string;
    game_id: string;
    game_title: string;
    report_type: string;
    quantity: number;
    machine_label: string | null;
    notes: string | null;
    created_at: string;
    submitted_by: string;
  }>).map((row) => ({
    createdAt: row.created_at,
    gameId: row.game_id,
    gameTitle: row.game_title,
    machineLabel: row.machine_label,
    notes: row.notes,
    quantity: row.quantity,
    reportId: row.report_id,
    reportType: row.report_type,
    submittedBy: row.submitted_by,
    venueGameId: row.venue_game_id,
    venueId: row.venue_id,
    venueName: row.venue_name,
  }));
}

export async function listMyPendingScoutReports(): Promise<PendingInventoryReport[]> {
  if (!hasSupabaseCredentials || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc(
    'list_my_pending_inventory_reports' as never,
    {} as never,
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    report_id: string;
    venue_game_id: string | null;
    venue_id: string;
    venue_name: string;
    game_id: string;
    game_title: string;
    report_type: string;
    quantity: number;
    machine_label: string | null;
    notes: string | null;
    created_at: string;
    submitted_by: string;
  }>).map((row) => ({
    createdAt: row.created_at,
    gameId: row.game_id,
    gameTitle: row.game_title,
    machineLabel: row.machine_label,
    notes: row.notes,
    quantity: row.quantity,
    reportId: row.report_id,
    reportType: row.report_type,
    submittedBy: row.submitted_by,
    venueGameId: row.venue_game_id,
    venueId: row.venue_id,
    venueName: row.venue_name,
  }));
}

export async function approveScoutInventoryReport(
  reportId: string,
): Promise<ApprovedInventoryReportResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'approve_inventory_report' as never,
    {
      selected_report_id: reportId,
    } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as
    | {
        report_id: string;
        venue_game_id: string;
        resulting_availability_status: string;
        resulting_quantity: number;
      }
    | null;

  if (!firstRow) {
    return null;
  }

  return {
    reportId: firstRow.report_id,
    resultingAvailabilityStatus: firstRow.resulting_availability_status,
    resultingQuantity: firstRow.resulting_quantity,
    venueGameId: firstRow.venue_game_id,
  };
}

export async function rejectScoutInventoryReport(
  reportId: string,
  rejectionReason?: string,
): Promise<RejectedInventoryReportResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'reject_inventory_report' as never,
    {
      selected_report_id: reportId,
      rejection_reason: rejectionReason?.trim() || null,
    } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as
    | {
        report_id: string;
        report_status: Database['public']['Tables']['inventory_reports']['Row']['status'];
        reviewed_at: string;
      }
    | null;

  if (!firstRow) {
    return null;
  }

  return {
    reportId: firstRow.report_id,
    reportStatus: firstRow.report_status,
    reviewedAt: firstRow.reviewed_at,
  };
}

export async function listPendingVenueSubmissions(): Promise<PendingVenueSubmission[]> {
  if (!hasSupabaseCredentials || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc(
    'list_pending_venue_submissions' as never,
    {} as never,
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    submission_id: string;
    submitted_by: string;
    name: string;
    street_address: string | null;
    city: string;
    region: string;
    postal_code: string | null;
    country: string;
    latitude: number;
    longitude: number;
    website: string | null;
    notes: string | null;
    created_at: string;
  }>).map((row) => ({
    city: row.city,
    country: row.country,
    createdAt: row.created_at,
    latitude: row.latitude,
    longitude: row.longitude,
    name: row.name,
    notes: row.notes,
    postalCode: row.postal_code,
    region: row.region,
    streetAddress: row.street_address,
    submissionId: row.submission_id,
    submittedBy: row.submitted_by,
    website: row.website,
  }));
}

export async function listMyPendingVenueSubmissions(): Promise<PendingVenueSubmission[]> {
  if (!hasSupabaseCredentials || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc(
    'list_my_pending_venue_submissions' as never,
    {} as never,
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    submission_id: string;
    submitted_by: string;
    name: string;
    street_address: string | null;
    city: string;
    region: string;
    postal_code: string | null;
    country: string;
    latitude: number;
    longitude: number;
    website: string | null;
    notes: string | null;
    created_at: string;
  }>).map((row) => ({
    city: row.city,
    country: row.country,
    createdAt: row.created_at,
    latitude: row.latitude,
    longitude: row.longitude,
    name: row.name,
    notes: row.notes,
    postalCode: row.postal_code,
    region: row.region,
    streetAddress: row.street_address,
    submissionId: row.submission_id,
    submittedBy: row.submitted_by,
    website: row.website,
  }));
}

export async function listPendingGameSubmissions(): Promise<PendingGameSubmission[]> {
  if (!hasSupabaseCredentials || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc(
    'list_pending_game_submissions' as never,
    {} as never,
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    submission_id: string;
    submitted_by: string;
    title: string;
    manufacturer: string | null;
    release_year: number | null;
    aliases: string[];
    categories: string[];
    notes: string | null;
    created_at: string;
  }>).map((row) => ({
    aliases: row.aliases,
    categories: row.categories,
    createdAt: row.created_at,
    manufacturer: row.manufacturer,
    notes: row.notes,
    releaseYear: row.release_year,
    submissionId: row.submission_id,
    submittedBy: row.submitted_by,
    title: row.title,
  }));
}

export async function listMyPendingGameSubmissions(): Promise<PendingGameSubmission[]> {
  if (!hasSupabaseCredentials || !supabase) {
    return [];
  }

  const { data, error } = await supabase.rpc(
    'list_my_pending_game_submissions' as never,
    {} as never,
  );

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    submission_id: string;
    submitted_by: string;
    title: string;
    manufacturer: string | null;
    release_year: number | null;
    aliases: string[];
    categories: string[];
    notes: string | null;
    created_at: string;
  }>).map((row) => ({
    aliases: row.aliases,
    categories: row.categories,
    createdAt: row.created_at,
    manufacturer: row.manufacturer,
    notes: row.notes,
    releaseYear: row.release_year,
    submissionId: row.submission_id,
    submittedBy: row.submitted_by,
    title: row.title,
  }));
}

export async function withdrawScoutInventoryReport(
  reportId: string,
): Promise<WithdrawnInventoryReportResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'withdraw_inventory_report' as never,
    {
      selected_report_id: reportId,
    } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as
    | {
        report_id: string;
        report_status: Database['public']['Tables']['inventory_reports']['Row']['status'];
        withdrawn_at: string;
      }
    | null;

  if (!firstRow) {
    return null;
  }

  return {
    reportId: firstRow.report_id,
    reportStatus: firstRow.report_status,
    withdrawnAt: firstRow.withdrawn_at,
  };
}

export async function withdrawVenueSubmission(
  submissionId: string,
): Promise<WithdrawnSubmissionResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'withdraw_venue_submission' as never,
    {
      selected_submission_id: submissionId,
    } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as
    | {
        submission_id: string;
        submission_status: string;
        withdrawn_at: string;
      }
    | null;

  if (!firstRow) {
    return null;
  }

  return {
    submissionId: firstRow.submission_id,
    submissionStatus: firstRow.submission_status,
    withdrawnAt: firstRow.withdrawn_at,
  };
}

export async function withdrawGameSubmission(
  submissionId: string,
): Promise<WithdrawnSubmissionResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'withdraw_game_submission' as never,
    {
      selected_submission_id: submissionId,
    } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as
    | {
        submission_id: string;
        submission_status: string;
        withdrawn_at: string;
      }
    | null;

  if (!firstRow) {
    return null;
  }

  return {
    submissionId: firstRow.submission_id,
    submissionStatus: firstRow.submission_status,
    withdrawnAt: firstRow.withdrawn_at,
  };
}

export async function approveVenueSubmission(
  submissionId: string,
): Promise<ApprovedVenueSubmissionResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'approve_venue_submission' as never,
    {
      selected_submission_id: submissionId,
    } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as
    | {
        submission_id: string;
        created_venue_id: string;
        created_venue_slug: string;
        created_venue_name: string;
      }
    | null;

  if (!firstRow) {
    return null;
  }

  return {
    createdVenueId: firstRow.created_venue_id,
    createdVenueName: firstRow.created_venue_name,
    createdVenueSlug: firstRow.created_venue_slug,
    submissionId: firstRow.submission_id,
  };
}

export async function rejectVenueSubmission(
  submissionId: string,
): Promise<RejectedSubmissionResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'reject_venue_submission' as never,
    {
      selected_submission_id: submissionId,
      rejection_reason: null,
    } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as
    | {
        submission_id: string;
        submission_status: string;
        reviewed_at: string;
      }
    | null;

  if (!firstRow) {
    return null;
  }

  return {
    reviewedAt: firstRow.reviewed_at,
    submissionId: firstRow.submission_id,
    submissionStatus: firstRow.submission_status,
  };
}

export async function approveGameSubmission(
  submissionId: string,
): Promise<ApprovedGameSubmissionResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'approve_game_submission' as never,
    {
      selected_submission_id: submissionId,
    } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as
    | {
        submission_id: string;
        created_game_id: string;
        created_game_slug: string;
        created_game_title: string;
      }
    | null;

  if (!firstRow) {
    return null;
  }

  return {
    createdGameId: firstRow.created_game_id,
    createdGameSlug: firstRow.created_game_slug,
    createdGameTitle: firstRow.created_game_title,
    submissionId: firstRow.submission_id,
  };
}

export async function rejectGameSubmission(
  submissionId: string,
): Promise<RejectedSubmissionResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'reject_game_submission' as never,
    {
      selected_submission_id: submissionId,
      rejection_reason: null,
    } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as
    | {
        submission_id: string;
        submission_status: string;
        reviewed_at: string;
      }
    | null;

  if (!firstRow) {
    return null;
  }

  return {
    reviewedAt: firstRow.reviewed_at,
    submissionId: firstRow.submission_id,
    submissionStatus: firstRow.submission_status,
  };
}

export type {
  ApprovedGameSubmissionResult,
  ApprovedInventoryReportResult,
  ApprovedVenueSubmissionResult,
  CreatedScoutGameResult,
  CreatedScoutVenueResult,
  PendingGameSubmission,
  PendingInventoryReport,
  PendingVenueSubmission,
  RejectedSubmissionResult,
  RejectedInventoryReportResult,
  ScoutVenue,
  SubmittedGameSubmissionResult,
  SubmittedVenueSubmissionResult,
  WithdrawnInventoryReportResult,
  WithdrawnSubmissionResult,
};
