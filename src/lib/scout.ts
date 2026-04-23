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

export type {
  ApprovedInventoryReportResult,
  PendingInventoryReport,
  RejectedInventoryReportResult,
  ScoutVenue,
};
