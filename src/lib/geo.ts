export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_MILES = 3958.8;
const DEFAULT_MAX_FIT_DISTANCE_MILES = 100;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceInMiles(
  origin: Coordinates,
  destination: Coordinates
): number {
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  const centralAngle =
    2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return EARTH_RADIUS_MILES * centralAngle;
}

export function buildMapRegion(
  origin: Coordinates,
  destinations: Coordinates[],
  maxFitDistanceMiles = DEFAULT_MAX_FIT_DISTANCE_MILES
): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} {
  const nearbyDestinations = destinations.filter(
    (destination) =>
      distanceInMiles(origin, destination) <= maxFitDistanceMiles
  );
  const points = [origin, ...nearbyDestinations];
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max(maxLatitude - minLatitude, 0.08) * 1.6,
    longitudeDelta: Math.max(maxLongitude - minLongitude, 0.08) * 1.6,
  };
}
