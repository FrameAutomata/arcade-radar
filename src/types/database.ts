export type VenueStatus = 'active' | 'temporarily_closed' | 'inactive';

export type AvailabilityStatus =
  | 'confirmed_present'
  | 'rumored_present'
  | 'temporarily_unavailable'
  | 'removed';

export type InventoryReportStatus = 'pending' | 'approved' | 'rejected';

export interface Database {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          slug: string;
          title: string;
          manufacturer: string | null;
          release_year: number | null;
          aliases: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          manufacturer?: string | null;
          release_year?: number | null;
          aliases?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          slug?: string;
          title?: string;
          manufacturer?: string | null;
          release_year?: number | null;
          aliases?: string[];
          updated_at?: string;
        };
      };
      venues: {
        Row: {
          id: string;
          slug: string;
          name: string;
          street_address: string | null;
          city: string;
          region: string;
          postal_code: string | null;
          country: string;
          google_place_id: string | null;
          source: string;
          status: VenueStatus;
          last_verified_at: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          street_address?: string | null;
          city: string;
          region: string;
          postal_code?: string | null;
          country?: string;
          google_place_id?: string | null;
          source?: string;
          status?: VenueStatus;
          last_verified_at?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          slug?: string;
          name?: string;
          street_address?: string | null;
          city?: string;
          region?: string;
          postal_code?: string | null;
          country?: string;
          google_place_id?: string | null;
          source?: string;
          status?: VenueStatus;
          last_verified_at?: string | null;
          metadata?: Record<string, unknown>;
          updated_at?: string;
        };
      };
      venue_games: {
        Row: {
          id: string;
          venue_id: string;
          game_id: string;
          quantity: number;
          availability_status: AvailabilityStatus;
          machine_label: string | null;
          notes: string | null;
          confidence_score: number;
          last_seen_at: string | null;
          last_confirmed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          venue_id: string;
          game_id: string;
          quantity?: number;
          availability_status?: AvailabilityStatus;
          machine_label?: string | null;
          notes?: string | null;
          confidence_score?: number;
          last_seen_at?: string | null;
          last_confirmed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          quantity?: number;
          availability_status?: AvailabilityStatus;
          machine_label?: string | null;
          notes?: string | null;
          confidence_score?: number;
          last_seen_at?: string | null;
          last_confirmed_at?: string | null;
          created_by?: string | null;
          updated_at?: string;
        };
      };
      inventory_reports: {
        Row: {
          id: string;
          venue_game_id: string;
          venue_id: string;
          game_id: string;
          user_id: string;
          report_type: string;
          notes: string | null;
          status: InventoryReportStatus;
          reviewed_at: string | null;
          reviewed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          venue_game_id: string;
          venue_id: string;
          game_id: string;
          user_id: string;
          report_type: string;
          notes?: string | null;
          status?: InventoryReportStatus;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
        };
        Update: {
          report_type?: string;
          notes?: string | null;
          status?: InventoryReportStatus;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
        };
      };
    };
    Functions: {
      find_nearest_venues: {
        Args: {
          user_lat: number;
          user_lng: number;
          max_distance_meters?: number;
          result_limit?: number;
        };
        Returns: {
          venue_id: string;
          venue_name: string;
          venue_slug: string;
          street_address: string | null;
          city: string;
          region: string;
          postal_code: string | null;
          latitude: number;
          longitude: number;
          distance_meters: number;
          last_verified_at: string | null;
          tracked_game_count: number;
        }[];
      };
      search_games: {
        Args: {
          search_query: string;
          result_limit?: number;
        };
        Returns: {
          game_id: string;
          slug: string;
          title: string;
          manufacturer: string | null;
          release_year: number | null;
          aliases: string[];
          similarity_score: number;
        }[];
      };
      find_nearest_venues_for_game: {
        Args: {
          selected_game_id: string;
          user_lat: number;
          user_lng: number;
          max_distance_meters?: number;
          result_limit?: number;
        };
        Returns: {
          venue_id: string;
          venue_name: string;
          venue_slug: string;
          street_address: string | null;
          city: string;
          region: string;
          latitude: number;
          longitude: number;
          distance_meters: number;
          quantity: number;
          availability_status: AvailabilityStatus;
          last_confirmed_at: string | null;
          confidence_score: number;
        }[];
      };
      get_venue_details: {
        Args: {
          selected_venue_id: string;
        };
        Returns: {
          venue_id: string;
          venue_name: string;
          venue_slug: string;
          street_address: string | null;
          city: string;
          region: string;
          postal_code: string | null;
          country: string;
          latitude: number;
          longitude: number;
          source: string;
          venue_status: VenueStatus;
          last_verified_at: string | null;
          metadata: Record<string, unknown>;
          verified_report_count: number;
          game_id: string | null;
          game_slug: string | null;
          game_title: string | null;
          manufacturer: string | null;
          release_year: number | null;
          aliases: string[] | null;
          quantity: number | null;
          availability_status: AvailabilityStatus | null;
          machine_label: string | null;
          notes: string | null;
          confidence_score: number | null;
          last_seen_at: string | null;
          last_confirmed_at: string | null;
        }[];
      };
    };
  };
}
