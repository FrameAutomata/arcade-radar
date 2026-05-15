import type { Database } from '@/types/database';

export type ScoutReportType =
  | 'confirmed_present'
  | 'missing'
  | 'temporarily_unavailable'
  | 'new_machine'
  | 'quantity_changed';

export interface ScoutVenue {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  region: string;
}

export interface PendingInventoryReport {
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

export interface PendingVenueSubmission {
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

export interface PendingGameSubmission {
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

export interface CreatedScoutVenueResult {
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

export interface CreatedScoutGameResult {
  id: string;
  slug: string;
  title: string;
  manufacturer: string | null;
  releaseYear: number | null;
  aliases: string[];
  categories: string[];
}

export interface SubmittedVenueSubmissionResult {
  submissionId: string;
  submissionStatus: string;
}

export interface SubmittedGameSubmissionResult {
  submissionId: string;
  submissionStatus: string;
}

export interface ApprovedInventoryReportResult {
  reportId: string;
  venueGameId: string;
  resultingAvailabilityStatus: string;
  resultingQuantity: number;
}

export interface RejectedInventoryReportResult {
  reportId: string;
  reportStatus: Database['public']['Tables']['inventory_reports']['Row']['status'];
  reviewedAt: string;
}

export interface WithdrawnInventoryReportResult {
  reportId: string;
  reportStatus: Database['public']['Tables']['inventory_reports']['Row']['status'];
  withdrawnAt: string;
}

export interface ApprovedVenueSubmissionResult {
  submissionId: string;
  createdVenueId: string;
  createdVenueSlug: string;
  createdVenueName: string;
}

export interface ApprovedGameSubmissionResult {
  submissionId: string;
  createdGameId: string;
  createdGameSlug: string;
  createdGameTitle: string;
}

export interface RejectedSubmissionResult {
  submissionId: string;
  submissionStatus: string;
  reviewedAt: string;
}

export interface WithdrawnSubmissionResult {
  submissionId: string;
  submissionStatus: string;
  withdrawnAt: string;
}

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
