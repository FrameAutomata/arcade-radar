import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';

import type { Database } from '@/types/database';

const testUrl = process.env.SUPABASE_TEST_URL?.trim();
const testKey = process.env.SUPABASE_TEST_KEY?.trim();
const testEmail = process.env.SUPABASE_TEST_USER_EMAIL?.trim();
const testPassword = process.env.SUPABASE_TEST_USER_PASSWORD?.trim();
const testGameQuery = process.env.SUPABASE_TEST_GAME_QUERY?.trim() || 'Street';
const testLatitude = Number(process.env.SUPABASE_TEST_LATITUDE ?? 32.7767);
const testLongitude = Number(process.env.SUPABASE_TEST_LONGITUDE ?? -96.797);

const hasReadConfig = Boolean(testUrl && testKey);
const hasWriteConfig = Boolean(hasReadConfig && testEmail && testPassword);
const describeIfConfigured = hasReadConfig ? describe : describe.skip;
const describeWritableIfConfigured = hasWriteConfig ? describe : describe.skip;

type SearchGameRow =
  Database['public']['Functions']['search_games']['Returns'][number];
type NearbyVenueRow =
  Database['public']['Functions']['find_nearest_venues']['Returns'][number];
type PendingInventoryReportRow =
  Database['public']['Functions']['list_my_pending_inventory_reports']['Returns'][number];
type SubmittedInventoryReportRow =
  Database['public']['Functions']['submit_inventory_report']['Returns'][number];
type WithdrawnInventoryReportRow =
  Database['public']['Functions']['withdraw_inventory_report']['Returns'][number];

function makeClient(): SupabaseClient<Database> {
  if (!testUrl || !testKey) {
    throw new Error('SUPABASE_TEST_URL and SUPABASE_TEST_KEY are required.');
  }

  return createClient<Database>(testUrl, testKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

describeIfConfigured('Supabase read RPC integration', () => {
  let client: SupabaseClient<Database>;

  beforeAll(() => {
    client = makeClient();
  });

  it('searches games through the live search_games RPC', async () => {
    const { data, error } = await client.rpc(
      'search_games' as never,
      {
        result_limit: 5,
        search_query: testGameQuery,
      } as never,
    );
    const rows = (data ?? []) as SearchGameRow[];

    expect(error).toBeNull();
    expect(Array.isArray(rows)).toBe(true);

    for (const row of rows) {
      expect(row.game_id).toEqual(expect.any(String));
      expect(row.slug).toEqual(expect.any(String));
      expect(row.title).toEqual(expect.any(String));
      expect(Array.isArray(row.aliases)).toBe(true);
      expect(Array.isArray(row.categories)).toBe(true);
    }
  });

  it('finds nearby venues through the live find_nearest_venues RPC', async () => {
    const { data, error } = await client.rpc(
      'find_nearest_venues' as never,
      {
        max_distance_meters: 160934,
        result_limit: 10,
        user_lat: testLatitude,
        user_lng: testLongitude,
      } as never,
    );
    const rows = (data ?? []) as NearbyVenueRow[];

    expect(error).toBeNull();
    expect(Array.isArray(rows)).toBe(true);

    for (const row of rows) {
      expect(row.venue_id).toEqual(expect.any(String));
      expect(row.venue_name).toEqual(expect.any(String));
      expect(row.latitude).toEqual(expect.any(Number));
      expect(row.longitude).toEqual(expect.any(Number));
      expect(row.distance_meters).toEqual(expect.any(Number));
    }
  });
});

describeWritableIfConfigured('Supabase contribution RPC integration', () => {
  let client: SupabaseClient<Database>;

  beforeAll(async () => {
    client = makeClient();

    const { error } = await client.auth.signInWithPassword({
      email: testEmail!,
      password: testPassword!,
    });

    expect(error).toBeNull();
  });

  it('submits, blocks duplicate, and withdraws an inventory report', async () => {
    const { data: gamesData, error: gameError } = await client.rpc(
      'search_games' as never,
      {
        result_limit: 1,
        search_query: testGameQuery,
      } as never,
    );
    const games = (gamesData ?? []) as SearchGameRow[];

    expect(gameError).toBeNull();

    const selectedGame = games?.[0];

    if (!selectedGame) {
      console.warn('Skipping write integration test: no games found.');
      return;
    }

    const { data: venuesData, error: venueError } = await client.rpc(
      'find_nearest_venues' as never,
      {
        max_distance_meters: 160934,
        result_limit: 1,
        user_lat: testLatitude,
        user_lng: testLongitude,
      } as never,
    );
    const venues = (venuesData ?? []) as NearbyVenueRow[];

    expect(venueError).toBeNull();

    const selectedVenue = venues?.[0];

    if (!selectedVenue) {
      console.warn('Skipping write integration test: no venues found.');
      return;
    }

    const { data: existingReportsData, error: pendingError } = await client.rpc(
      'list_my_pending_inventory_reports' as never,
      {} as never,
    );
    const existingReports = (existingReportsData ?? []) as PendingInventoryReportRow[];

    expect(pendingError).toBeNull();

    for (const report of existingReports ?? []) {
      if (
        report.venue_id === selectedVenue.venue_id &&
        report.game_id === selectedGame.game_id
      ) {
        const { error: withdrawExistingError } = await client.rpc(
          'withdraw_inventory_report' as never,
          {
            selected_report_id: report.report_id,
          } as never,
        );

        expect(withdrawExistingError).toBeNull();
      }
    }

    const { data: submittedReportsData, error: submitError } = await client.rpc(
      'submit_inventory_report' as never,
      {
        reported_machine_label: 'integration-test',
        reported_notes: 'Automated integration test report.',
        reported_quantity: 1,
        selected_game_id: selectedGame.game_id,
        selected_report_type: 'confirmed_present',
        selected_venue_id: selectedVenue.venue_id,
      } as never,
    );
    const submittedReports = (submittedReportsData ?? []) as SubmittedInventoryReportRow[];

    expect(submitError).toBeNull();

    const submittedReport = submittedReports?.[0];
    expect(submittedReport?.report_id).toEqual(expect.any(String));
    expect(submittedReport?.report_status).toBe('pending');

    const { error: duplicateError } = await client.rpc(
      'submit_inventory_report' as never,
      {
        reported_machine_label: 'integration-test',
        reported_notes: 'Duplicate automated integration test report.',
        reported_quantity: 1,
        selected_game_id: selectedGame.game_id,
        selected_report_type: 'confirmed_present',
        selected_venue_id: selectedVenue.venue_id,
      } as never,
    );

    expect(duplicateError?.message).toContain(
      'You already submitted this game at this venue for review.',
    );

    const { data: withdrawnReportsData, error: withdrawError } = await client.rpc(
      'withdraw_inventory_report' as never,
      {
        selected_report_id: submittedReport!.report_id,
      } as never,
    );
    const withdrawnReports = (withdrawnReportsData ?? []) as WithdrawnInventoryReportRow[];

    expect(withdrawError).toBeNull();
    expect(withdrawnReports?.[0]?.report_status).toBe('withdrawn');
  });
});
