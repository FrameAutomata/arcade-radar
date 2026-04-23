import type { Coordinates } from '@/lib/geo';

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapPin {
  id: string;
  coordinate: Coordinates;
  title: string;
  description?: string;
  isUserLocation?: boolean;
}

export interface AppMapProps {
  pins: MapPin[];
  region: MapRegion;
  height?: number;
  onPinPress?: (pinId: string) => void;
  onMapInteractionChange?: (isInteracting: boolean) => void;
  selectedPinId?: string | null;
}
