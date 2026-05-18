import { hasSupabaseCredentials } from '@/lib/env';
import { searchGamesLive } from '@/lib/live-data';
import { supabase } from '@/lib/supabase';
import type { Game } from '@/types/domain';

import type {
  ApprovedGameSubmissionResult,
  CreatedScoutGameResult,
  PendingGameSubmission,
  RejectedSubmissionResult,
  SubmittedGameSubmissionResult,
  WithdrawnSubmissionResult,
} from './scout.types';

type PendingGameRow = {
  submission_id: string;
  submitted_by: string;
  title: string;
  manufacturer: string | null;
  release_year: number | null;
  aliases: string[];
  categories: string[];
  notes: string | null;
  created_at: string;
};

function mapPendingGame(row: PendingGameRow): PendingGameSubmission {
  return {
    aliases: row.aliases,
    categories: row.categories,
    createdAt: row.created_at,
    manufacturer: row.manufacturer,
    notes: row.notes,
    releaseYear: row.release_year,
    submissionId: row.submission_id,
    submittedBy: row.submitted_by,
    title: row.title,
  };
}

export async function searchScoutGames(query: string): Promise<Game[]> {
  return searchGamesLive(query, 8);
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
      game_aliases: input.aliases?.map((a) => a.trim()).filter(Boolean) ?? [],
      game_categories: input.categories?.map((c) => c.trim()).filter(Boolean) ?? [],
    } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as {
    created_game_id: string;
    created_game_slug: string;
    created_game_title: string;
    created_game_manufacturer: string | null;
    created_game_release_year: number | null;
    created_game_aliases: string[];
    created_game_categories: string[];
  } | null;

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
      game_aliases: input.aliases?.map((a) => a.trim()).filter(Boolean) ?? [],
      game_categories: input.categories?.map((c) => c.trim()).filter(Boolean) ?? [],
      game_notes: input.notes?.trim() || null,
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

  return ((data ?? []) as PendingGameRow[]).map(mapPendingGame);
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

  return ((data ?? []) as PendingGameRow[]).map(mapPendingGame);
}

export async function approveGameSubmission(
  submissionId: string,
): Promise<ApprovedGameSubmissionResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'approve_game_submission' as never,
    { selected_submission_id: submissionId } as never,
  );

  if (error) {
    throw error;
  }

  const firstRow = (data?.[0] ?? null) as {
    submission_id: string;
    created_game_id: string;
    created_game_slug: string;
    created_game_title: string;
  } | null;

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

export async function withdrawGameSubmission(
  submissionId: string,
): Promise<WithdrawnSubmissionResult | null> {
  if (!hasSupabaseCredentials || !supabase) {
    throw new Error('Supabase is not configured for Scout Mode.');
  }

  const { data, error } = await supabase.rpc(
    'withdraw_game_submission' as never,
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
