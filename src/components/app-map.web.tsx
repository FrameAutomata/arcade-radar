import { useEffect } from "react";
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

function FitToPins({
  onMapInteractionChange,
  pins,
  region,
}: {
  onMapInteractionChange?: AppMapProps["onMapInteractionChange"];
  pins: AppMapProps["pins"];
  region: AppMapProps["region"];
}) {
  const map = useMap();

  useEffect(() => {
    if (pins.length === 0) {
      map.setView([region.latitude, region.longitude], 12);
      return;
    }

    const bounds = L.latLngBounds(
      pins.map(
        (pin) =>
          [pin.coordinate.latitude, pin.coordinate.longitude] as [
            number,
            number,
          ],
      ),
    );

    map.fitBounds(bounds, {
      padding: [36, 36],
    });
  }, [map, pins, region.latitude, region.longitude]);

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
          <FitToPins
            onMapInteractionChange={onMapInteractionChange}
            pins={pins}
            region={region}
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

      <View style={styles.captionRow}>
        <View style={styles.captionCard}>
          <Text style={styles.captionValue}>
            {pins.filter((pin) => !pin.isUserLocation).length}
          </Text>
          <Text style={styles.captionLabel}>arcade pins</Text>
        </View>
        <View style={styles.captionCard}>
          <Text style={styles.captionValue}>{getDisplayAddress(pins)}</Text>
          <Text style={styles.captionLabel}>address</Text>
        </View>
      </View>
    </View>
  );
}

function getDisplayAddress(pins: AppMapProps["pins"]): string {
  const firstVenuePin = pins.find(
    (pin) => !pin.isUserLocation && pin.description,
  );

  if (firstVenuePin?.description) {
    return firstVenuePin.description;
  }

  return "Address unavailable";
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.md,
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
  captionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  captionCard: {
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.sm,
    flexGrow: 1,
    gap: 4,
    minWidth: 160,
    padding: theme.spacing.md,
  },
  captionValue: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: "800",
  },
  captionLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
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
