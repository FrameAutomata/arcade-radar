import { Linking, Platform } from 'react-native';

import type { Coordinates } from '@/lib/geo';

interface OpenDirectionsParams {
  destination: Coordinates;
  address?: string;
  label: string;
}

function encodeLabel(label: string): string {
  return encodeURIComponent(label);
}

export async function openDirections({
  destination,
  address,
  label,
}: OpenDirectionsParams): Promise<void> {
  const latLng = `${destination.latitude},${destination.longitude}`;
  const namedDestination = [label.trim(), address?.trim()]
    .filter(Boolean)
    .join(', ');
  const destinationQuery = namedDestination || address?.trim() || latLng;
  const encodedDestination = encodeURIComponent(destinationQuery);
  const encodedLabel = encodeLabel(label);

  const candidates =
    Platform.OS === 'ios'
      ? [
          `comgooglemaps://?daddr=${encodedDestination}&directionsmode=driving`,
          `http://maps.apple.com/?daddr=${encodedDestination}&dirflg=d&q=${encodedLabel}`,
          `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`,
        ]
      : Platform.OS === 'android'
        ? [
            `google.navigation:q=${encodedDestination}`,
            `geo:0,0?q=${encodedDestination}`,
            `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`,
          ]
        : [
            `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`,
          ];

  for (const candidate of candidates) {
    const supported = await Linking.canOpenURL(candidate);

    if (supported) {
      await Linking.openURL(candidate);
      return;
    }
  }

  await Linking.openURL(
    `https://www.google.com/maps/search/?api=1&query=${encodedDestination}`
  );
}
