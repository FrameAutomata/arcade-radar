import { hasSupabaseCredentials } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

import type {
  ApprovedVenueSubmissionResult,
  CreatedScoutVenueResult,
  PendingVenueSubmission,
  RejectedSubmissionResult,
  ScoutVenue,
  SubmittedVenueSubmissionResult,
  WithdrawnSubmissionResult,
} from './scout.types';

type VenueTableRow = Pick<
  Database['public']['Tables']['venues']['Row'],
  'id' | 'name' | 'slug' | 'street_address' | 'city' | 'region'
>;

type PendingVenueRow = {
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
};

function mapPendingVenue(row: PendingVenueRow): PendingVenueSubmission {
  return {
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
  };
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

  return ((data ?? []) as VenueTableRow[]).map((row) => ({
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

  const firstRow = (data?.[0] ?? null) as {
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
  } | null;

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

  const firstRow = (data?.[0] ?? null) as {
    submission_id: string;
    submission_status: string;
  } | null;

  if (!firstRow) {
    return null;
  }

  return {
    submissionId: firstRow.submission_id,
    submissionStatus: firstRow.submission_status,
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

  return ((data ?? []) as PendingVenueRow[]).map(mapPendingVenue);
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

  return ((data ?? []) as PendingVenueRow[]).map(mapPendingVenue);
}

export async function approveVenueSubmission(
  submissionId: string,
): Promise<ApprovedVenueSubmissionResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'approve_venue_submission' as never,
    { selected_submission_id: submissionId } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as {
    submission_id: string;
    created_venue_id: string;
    created_venue_slug: string;
    created_venue_name: string;
  } | null;

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

  const firstRow = (data?.[0] ?? null) as {
    submission_id: string;
    submission_status: string;
    reviewed_at: string;
  } | null;

  if (!firstRow) {
    return null;
  }

  return {
    reviewedAt: firstRow.reviewed_at,
    submissionId: firstRow.submission_id,
    submissionStatus: firstRow.submission_status,
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
    { selected_submission_id: submissionId } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as {
    submission_id: string;
    submission_status: string;
    withdrawn_at: string;
  } | null;

  if (!firstRow) {
    return null;
  }

  return {
    submissionId: firstRow.submission_id,
    submissionStatus: firstRow.submission_status,
    withdrawnAt: firstRow.withdrawn_at,
  };
}
