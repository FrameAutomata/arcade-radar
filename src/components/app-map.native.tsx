import {
  Camera,
  Layer,
  LogManager,
  Map,
  Marker,
  RasterSource,
  type CameraRef,
  type MapRef,
} from "@maplibre/maplibre-react-native";
import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { AppMapProps } from "@/components/app-map.types";
import { theme } from "@/constants/theme";

const MAP_STYLE = {
  version: 8 as const,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background" as const,
      paint: {
        "background-color": theme.colors.background,
      },
    },
  ],
};

const CARTO_DARK_TILES = [
  "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
];

export function AppMap({
  pins,
  region,
  height = 320,
  fullScreen = false,
  onMapInteractionChange,
  onPinPress,
  selectedPinId,
}: AppMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);

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
    ],
  );

  useEffect(() => {
    LogManager.onLog((event) => {
      if (
        event.level === "warn" &&
        event.tag === "Mbgl-HttpRequest" &&
        event.message.includes("stream was reset: CANCEL")
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

  async function adjustZoom(delta: number) {
    const currentZoom = (await mapRef.current?.getZoom()) ?? 11;
    const nextZoom = Math.max(3, Math.min(18, currentZoom + delta));
    cameraRef.current?.zoomTo(nextZoom, { duration: 180 });
  }

  return (
    <View style={fullScreen ? styles.wrapperFullScreen : [styles.wrapper, { height }]}>
      <Map
        attribution={false}
        compass={false}
        logo={false}
        mapStyle={MAP_STYLE}
        onRegionDidChange={() => onMapInteractionChange?.(false)}
        onRegionWillChange={() => onMapInteractionChange?.(true)}
        ref={mapRef}
        scaleBar={false}
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
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          id="carto-dark-source"
          maxzoom={19}
          tileSize={256}
          tiles={CARTO_DARK_TILES}
        >
          <Layer
            id="carto-dark-layer"
            source="carto-dark-source"
            type="raster"
          />
        </RasterSource>

        {pins.map((pin) => {
          const isSelected = selectedPinId === pin.id && !pin.isUserLocation;
          return (
            <Marker
              key={pin.id}
              anchor="center"
              lngLat={[pin.coordinate.longitude, pin.coordinate.latitude]}
              onPress={() => onPinPress?.(pin.id)}
            >
              {pin.isUserLocation ? (
                <View pointerEvents="none" style={styles.userDotOuter}>
                  <View style={styles.userDotInner} />
                </View>
              ) : isSelected ? (
                <View pointerEvents="none" style={styles.venueDotSelectedOuter}>
                  <View style={styles.venueDotSelectedInner} />
                </View>
              ) : (
                <View pointerEvents="none" style={styles.venueDot} />
              )}
            </Marker>
          );
        })}
      </Map>

      <View style={styles.zoomControls}>
        <Pressable onPress={() => void adjustZoom(1)} style={styles.zoomBtn}>
          <Text style={styles.zoomBtnText}>+</Text>
        </Pressable>
        <Pressable onPress={() => void adjustZoom(-1)} style={styles.zoomBtn}>
          <Text style={styles.zoomBtnText}>−</Text>
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
    overflow: "hidden",
    width: "100%",
  },
  wrapperFullScreen: {
    flex: 1,
  },
  map: {
    flex: 1,
  },

  // ── Venue pin ────────────────────────────────────────────────────────────────
  venueDot: {
    backgroundColor: theme.colors.brand,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    borderWidth: 2,
    height: 14,
    shadowColor: theme.colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    width: 14,
  },
  venueDotSelectedOuter: {
    alignItems: "center",
    backgroundColor: "rgba(60, 242, 211, 0.18)",
    borderColor: theme.colors.accent,
    borderRadius: 999,
    borderWidth: 2,
    height: 26,
    justifyContent: "center",
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    width: 26,
  },
  venueDotSelectedInner: {
    backgroundColor: theme.colors.brand,
    borderRadius: 999,
    height: 12,
    shadowColor: theme.colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    width: 12,
  },

  // ── User location pin ────────────────────────────────────────────────────────
  userDotOuter: {
    alignItems: "center",
    backgroundColor: "rgba(60, 242, 211, 0.20)",
    borderColor: theme.colors.accent,
    borderRadius: 999,
    borderWidth: 2,
    height: 22,
    justifyContent: "center",
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    width: 22,
  },
  userDotInner: {
    backgroundColor: theme.colors.accent,
    borderRadius: 999,
    height: 10,
    width: 10,
  },

  // ── Zoom controls ────────────────────────────────────────────────────────────
  zoomControls: {
    bottom: 16,
    gap: 6,
    position: "absolute",
    right: 12,
  },
  zoomBtn: {
    alignItems: "center",
    backgroundColor: "rgba(4, 8, 15, 0.88)",
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    width: 36,
  },
  zoomBtnText: {
    color: theme.colors.accent,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22,
  },
});
