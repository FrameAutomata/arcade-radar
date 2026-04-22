import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { StyleSheet, Text, View } from 'react-native';

import type { AppMapProps } from '@/components/app-map.types';
import { theme } from '@/constants/theme';

const MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

export function AppMap({ pins, region, height = 320 }: AppMapProps) {
  const bounds = [
    region.longitude - region.longitudeDelta / 2,
    region.latitude - region.latitudeDelta / 2,
    region.longitude + region.longitudeDelta / 2,
    region.latitude + region.latitudeDelta / 2,
  ] as [number, number, number, number];

  return (
    <View style={[styles.wrapper, { height }]}>
      <Map mapStyle={MAP_STYLE_URL} style={styles.map}>
        <Camera
          bounds={bounds}
          padding={{ top: 48, right: 48, bottom: 48, left: 48 }}
        />

        {pins.map((pin) => (
          <Marker
            key={pin.id}
            anchor="bottom"
            lngLat={[pin.coordinate.longitude, pin.coordinate.latitude]}
          >
            <View style={styles.markerWrap}>
              <View
                style={[
                  styles.dot,
                  pin.isUserLocation ? styles.userDot : styles.venueDot,
                ]}
              />
              <View style={styles.label}>
                <Text style={styles.labelTitle}>{pin.title}</Text>
                {pin.description ? (
                  <Text style={styles.labelText}>{pin.description}</Text>
                ) : null}
              </View>
            </View>
          </Marker>
        ))}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  map: {
    flex: 1,
  },
  markerWrap: {
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 999,
    borderWidth: 2,
    height: 18,
    width: 18,
  },
  venueDot: {
    backgroundColor: theme.colors.brand,
  },
  userDot: {
    backgroundColor: theme.colors.success,
  },
  label: {
    backgroundColor: 'rgba(9, 17, 29, 0.92)',
    borderColor: theme.colors.border,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  labelTitle: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  labelText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
});
