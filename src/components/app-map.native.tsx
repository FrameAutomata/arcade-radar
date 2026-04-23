import {
  Camera,
  Layer,
  LogManager,
  Map,
  Marker,
  RasterSource,
  type CameraRef,
  type MapRef,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppMapProps } from '@/components/app-map.types';
import { theme } from '@/constants/theme';

const MAP_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background' as const,
      paint: {
        'background-color': '#08111d',
      },
    },
  ],
};

export function AppMap({
  pins,
  region,
  height = 320,
  onMapInteractionChange,
  onPinPress,
  selectedPinId,
}: AppMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);
  const [zoomLevel, setZoomLevel] = useState(11);

  const bounds = useMemo(
    () =>
      [
        region.longitude - region.longitudeDelta / 2,
        region.latitude - region.latitudeDelta / 2,
        region.longitude + region.longitudeDelta / 2,
        region.latitude + region.latitudeDelta / 2,
      ] as [number, number, number, number],
    [
      region.latitude,
      region.latitudeDelta,
      region.longitude,
      region.longitudeDelta,
    ]
  );

  useEffect(() => {
    LogManager.onLog((event) => {
      if (
        event.level === 'warn' &&
        event.tag === 'Mbgl-HttpRequest' &&
        event.message.includes('stream was reset: CANCEL')
      ) {
        return true;
      }

      return false;
    });
  }, []);

  useEffect(() => {
    cameraRef.current?.fitBounds(bounds, {
      duration: 350,
      padding: { top: 48, right: 48, bottom: 48, left: 48 },
    });
  }, [bounds]);

  async function syncZoomLevel() {
    const nextZoom = await mapRef.current?.getZoom();

    if (typeof nextZoom === 'number') {
      setZoomLevel(nextZoom);
    }
  }

  async function adjustZoom(delta: number) {
    const currentZoom = (await mapRef.current?.getZoom()) ?? zoomLevel;
    const nextZoom = Math.max(3, Math.min(18, currentZoom + delta));

    cameraRef.current?.zoomTo(nextZoom, {
      duration: 180,
    });
    setZoomLevel(nextZoom);
  }

  return (
    <View style={[styles.wrapper, { height }]}>
      <Map
        attribution={false}
        compass={false}
        logo={false}
        mapStyle={MAP_STYLE}
        onDidFinishLoadingMap={syncZoomLevel}
        onRegionDidChange={() => {
          onMapInteractionChange?.(false);
          void syncZoomLevel();
        }}
        onRegionWillChange={() => onMapInteractionChange?.(true)}
        scaleBar={false}
        ref={mapRef}
        style={styles.map}
        touchZoom
      >
        <Camera
          initialViewState={{
            bounds,
            padding: { top: 48, right: 48, bottom: 48, left: 48 },
          }}
          maxZoom={18}
          minZoom={3}
          ref={cameraRef}
        />
        <RasterSource
          attribution="&copy; OpenStreetMap contributors"
          id="osm-raster-source"
          maxzoom={19}
          tileSize={256}
          tiles={['https://tile.openstreetmap.org/{z}/{x}/{y}.png']}
        >
          <Layer id="osm-raster-layer" source="osm-raster-source" type="raster" />
        </RasterSource>

        {pins.map((pin) => (
          <Marker
            key={pin.id}
            anchor="bottom"
            lngLat={[pin.coordinate.longitude, pin.coordinate.latitude]}
            onPress={() => onPinPress?.(pin.id)}
          >
            <View style={styles.markerWrap}>
              <View
                style={[
                  styles.dot,
                  pin.isUserLocation ? styles.userDot : styles.venueDot,
                  selectedPinId === pin.id && styles.dotSelected,
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

      <View style={styles.zoomControls}>
        <Pressable onPress={() => void adjustZoom(1)} style={styles.zoomButton}>
          <Text style={styles.zoomButtonText}>+</Text>
        </Pressable>
        <Pressable onPress={() => void adjustZoom(-1)} style={styles.zoomButton}>
          <Text style={styles.zoomButtonText}>-</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    width: '100%',
  },
  map: {
    flex: 1,
  },
  zoomControls: {
    gap: 8,
    position: 'absolute',
    right: 12,
    top: 12,
  },
  zoomButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(6, 11, 22, 0.9)',
    borderColor: theme.colors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    width: 40,
  },
  zoomButtonText: {
    color: theme.colors.accent,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
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
  dotSelected: {
    height: 24,
    width: 24,
  },
  venueDot: {
    backgroundColor: theme.colors.brand,
  },
  userDot: {
    backgroundColor: theme.colors.accent,
  },
  label: {
    backgroundColor: 'rgba(8, 15, 30, 0.94)',
    borderColor: theme.colors.borderStrong,
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
