import MapView, { Marker } from 'react-native-maps';

import type { AppMapProps } from '@/components/app-map.types';

export function AppMap({ pins, region, height = 320 }: AppMapProps) {
  const mapKey = `${region.latitude.toFixed(3)}-${region.longitude.toFixed(3)}-${pins.length}`;

  return (
    <MapView
      initialRegion={region}
      key={mapKey}
      style={{ borderRadius: 18, height, overflow: 'hidden' }}
    >
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          coordinate={pin.coordinate}
          description={pin.description}
          title={pin.title}
        />
      ))}
    </MapView>
  );
}
