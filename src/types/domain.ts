export type InventoryStatus =
  | 'confirmed_present'
  | 'rumored_present'
  | 'temporarily_unavailable'
  | 'removed';

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
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  verifiedByCount: number;
  notes?: string;
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
