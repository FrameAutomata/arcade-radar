export type InventoryStatus =
  | 'confirmed_present'
  | 'rumored_present'
  | 'temporarily_unavailable'
  | 'removed';

export type VenueStatus = 'active' | 'temporarily_closed' | 'inactive';

export interface VenueDayHours {
  open: string;
  close: string;
}

export interface VenueHours {
  mon?: VenueDayHours;
  tue?: VenueDayHours;
  wed?: VenueDayHours;
  thu?: VenueDayHours;
  fri?: VenueDayHours;
  sat?: VenueDayHours;
  sun?: VenueDayHours;
}

export interface Game {
  id: string;
  slug: string;
  title: string;
  manufacturer: string;
  releaseYear: number;
  aliases: string[];
  categories: string[];
}

export interface VenueInventoryItem {
  gameId: string;
  status: InventoryStatus;
  quantity: number;
  lastVerifiedAt: string;
  note?: string;
  machineLabel?: string;
  confidenceScore?: number;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  region: string;
  postalCode?: string;
  country?: string;
  latitude: number;
  longitude: number;
  status?: VenueStatus;
  lastVerifiedAt?: string;
  verifiedByCount?: number;
  notes?: string;
  website?: string;
  phone?: string;
  entryFee?: string;
  hours?: VenueHours;
  facebook?: string;
  twitter?: string;
  inventory: VenueInventoryItem[];
}

export interface VenueMatch {
  game: Game;
  inventory: VenueInventoryItem;
  venue: Venue;
  distanceMiles: number;
}

export interface NearbyVenueResult {
  venue: Venue;
  distanceMiles: number;
  game?: Game;
  inventory?: VenueInventoryItem;
}
