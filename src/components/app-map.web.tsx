import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import L from "leaflet";
import { MapContainer } from "react-leaflet/MapContainer";
import { Marker } from "react-leaflet/Marker";
import { Popup } from "react-leaflet/Popup";
import { TileLayer } from "react-leaflet/TileLayer";
import { useMap, useMapEvents } from "react-leaflet/hooks";

import type { AppMapProps } from "@/components/app-map.types";
import { theme } from "@/constants/theme";

import "leaflet/dist/leaflet.css";

function createMarkerIcon(isUserLocation: boolean) {
  const color = isUserLocation ? theme.colors.success : theme.colors.brand;

  return L.divIcon({
    className: "arcade-radar-marker",
    html: `
      <div style="
        align-items:center;
        background:${color};
        border:2px solid rgba(255,255,255,0.35);
        border-radius:999px;
        box-shadow:0 6px 16px rgba(0,0,0,0.28);
        display:flex;
        height:18px;
        justify-content:center;
        width:18px;
      "></div>
    `,
    iconAnchor: [9, 9],
    iconSize: [18, 18],
  });
}

function FitToRegion({
  onMapInteractionChange,
  region,
  regionSignature,
}: {
  onMapInteractionChange?: AppMapProps["onMapInteractionChange"];
  region: AppMapProps["region"];
  regionSignature: string;
}) {
  const map = useMap();
  const lastAppliedSignature = useRef<string | null>(null);

  useEffect(() => {
    if (lastAppliedSignature.current === regionSignature) {
      return;
    }

    if (region.latitudeDelta <= 0 || region.longitudeDelta <= 0) {
      map.setView([region.latitude, region.longitude], 12);
      lastAppliedSignature.current = regionSignature;
      return;
    }

    const bounds = L.latLngBounds(
      [
        [
          region.latitude - region.latitudeDelta / 2,
          region.longitude - region.longitudeDelta / 2,
        ],
        [
          region.latitude + region.latitudeDelta / 2,
          region.longitude + region.longitudeDelta / 2,
        ],
      ] as [[number, number], [number, number]],
    );

    map.fitBounds(bounds, {
      padding: [36, 36],
    });
    lastAppliedSignature.current = regionSignature;
  }, [map, region, regionSignature]);

  useMapEvents({
    dragend: () => onMapInteractionChange?.(false),
    dragstart: () => onMapInteractionChange?.(true),
    movestart: () => onMapInteractionChange?.(true),
    moveend: () => onMapInteractionChange?.(false),
    zoomend: () => onMapInteractionChange?.(false),
    zoomstart: () => onMapInteractionChange?.(true),
  });

  return null;
}

export function AppMap({
  pins,
  region,
  height = 320,
  onMapInteractionChange,
  onPinPress,
  selectedPinId,
}: AppMapProps) {
  const regionSignature = useMemo(
    () =>
      JSON.stringify(
        {
          latitude: region.latitude,
          latitudeDelta: region.latitudeDelta,
          longitude: region.longitude,
          longitudeDelta: region.longitudeDelta,
        },
      ),
    [region],
  );

  return (
    <View style={styles.wrapper}>
      <View style={[styles.mapFrame, { height }]}>
        <MapContainer
          center={[region.latitude, region.longitude]}
          scrollWheelZoom
          style={styles.map}
          zoom={12}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitToRegion
            onMapInteractionChange={onMapInteractionChange}
            region={region}
            regionSignature={regionSignature}
          />
          {pins.map((pin) => (
            <Marker
              key={pin.id}
              icon={createMarkerIcon(Boolean(pin.isUserLocation))}
              eventHandlers={{
                click: () => onPinPress?.(pin.id),
              }}
              position={[pin.coordinate.latitude, pin.coordinate.longitude]}
            >
              <Popup>
                <View style={styles.popupContent}>
                  <Text style={styles.popupTitle}>{pin.title}</Text>
                  {selectedPinId === pin.id ? (
                    <Text style={styles.popupSelected}>Selected arcade</Text>
                  ) : null}
                  {pin.description ? (
                    <Text style={styles.popupDescription}>
                      {pin.description}
                    </Text>
                  ) : null}
                </View>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },
  mapFrame: {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
  },
  map: {
    height: "100%",
    width: "100%",
  },
  popupContent: {
    gap: 4,
    maxWidth: 220,
  },
  popupTitle: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
  popupSelected: {
    color: "#d97706",
    fontSize: 12,
    fontWeight: "700",
  },
  popupDescription: {
    color: "#334155",
    fontSize: 12,
    lineHeight: 18,
  },
});
