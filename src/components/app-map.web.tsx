import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import L from "leaflet";
import { MapContainer } from "react-leaflet/MapContainer";
import { Marker } from "react-leaflet/Marker";
import { Popup } from "react-leaflet/Popup";
import { TileLayer } from "react-leaflet/TileLayer";
import { useMap, useMapEvents } from "react-leaflet/hooks";

import type { AppMapProps } from "@/components/app-map.types";
import { theme } from "@/constants/theme";

import "leaflet/dist/leaflet.css";

function createMarkerIcon(isUserLocation: boolean, isSelected: boolean) {
  let coreColor: string;
  let glowColor: string;
  let ringColor: string;

  if (isUserLocation) {
    coreColor = theme.colors.accent;
    glowColor = theme.colors.accent;
    ringColor = "rgba(60,242,211,0.30)";
  } else if (isSelected) {
    coreColor = theme.colors.brand;
    glowColor = theme.colors.accent;
    ringColor = "rgba(60,242,211,0.22)";
  } else {
    coreColor = theme.colors.brand;
    glowColor = theme.colors.brand;
    ringColor = "rgba(255,138,31,0.20)";
  }

  const outerSize = isSelected ? 26 : 20;
  const innerSize = isSelected ? 12 : 10;
  const borderColor = isSelected ? theme.colors.accent : "rgba(255,255,255,0.22)";

  return L.divIcon({
    className: "",
    html: `
      <div style="
        align-items:center;
        background:${ringColor};
        border:2px solid ${borderColor};
        border-radius:999px;
        box-shadow:0 0 12px 3px ${glowColor}55, 0 0 4px 1px ${glowColor}88;
        display:flex;
        height:${outerSize}px;
        justify-content:center;
        transition:all 0.15s ease;
        width:${outerSize}px;
      ">
        <div style="
          background:${coreColor};
          border-radius:999px;
          box-shadow:0 0 6px 2px ${glowColor}99;
          height:${innerSize}px;
          width:${innerSize}px;
        "></div>
      </div>
    `,
    iconAnchor: [outerSize / 2, outerSize / 2],
    iconSize: [outerSize, outerSize],
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

    map.invalidateSize();

    if (region.latitudeDelta <= 0 || region.longitudeDelta <= 0) {
      map.setView([region.latitude, region.longitude], 12, { animate: false });
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
      animate: false,
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

function regionToBounds(region: AppMapProps["region"]): L.LatLngBoundsExpression {
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;
  return [
    [region.latitude - halfLat, region.longitude - halfLng],
    [region.latitude + halfLat, region.longitude + halfLng],
  ];
}

export function AppMap({
  pins,
  region,
  height = 320,
  fullScreen = false,
  onMapInteractionChange,
  onPinPress,
  selectedPinId,
}: AppMapProps) {
  const regionSignature = useMemo(
    () =>
      JSON.stringify({
        latitude: region.latitude,
        latitudeDelta: region.latitudeDelta,
        longitude: region.longitude,
        longitudeDelta: region.longitudeDelta,
      }),
    [region],
  );

  const initialBounds = useMemo(() => regionToBounds(region), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Inject dark Leaflet popup styles once on mount
  useEffect(() => {
    const style = document.createElement("style");
    style.dataset["arcadeRadar"] = "map";
    style.textContent = `
      .leaflet-popup-content-wrapper {
        background: rgba(4, 8, 15, 0.96) !important;
        border: 1px solid ${theme.colors.borderStrong} !important;
        border-radius: ${theme.radius.md}px !important;
        box-shadow: 0 0 18px rgba(60,242,211,0.18), 0 8px 32px rgba(0,0,0,0.6) !important;
        color: ${theme.colors.textPrimary} !important;
      }
      .leaflet-popup-tip {
        background: rgba(4, 8, 15, 0.96) !important;
        box-shadow: none !important;
      }
      .leaflet-popup-content {
        margin: 10px 14px !important;
      }
      .leaflet-popup-close-button {
        color: ${theme.colors.textMuted} !important;
        font-size: 18px !important;
        top: 6px !important;
        right: 8px !important;
      }
      .leaflet-popup-close-button:hover {
        color: ${theme.colors.textPrimary} !important;
        background: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <View style={fullScreen ? styles.wrapperFullScreen : styles.wrapper}>
      <View style={fullScreen ? styles.mapFrameFullScreen : [styles.mapFrame, { height }]}>
        <MapContainer
          bounds={initialBounds}
          boundsOptions={{ padding: [36, 36] }}
          scrollWheelZoom
          style={{ height: fullScreen ? "100%" : height, width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <FitToRegion
            onMapInteractionChange={onMapInteractionChange}
            region={region}
            regionSignature={regionSignature}
          />
          {pins.map((pin) => (
            <Marker
              key={pin.id}
              icon={createMarkerIcon(Boolean(pin.isUserLocation), selectedPinId === pin.id)}
              eventHandlers={{
                click: () => onPinPress?.(pin.id),
              }}
              position={[pin.coordinate.latitude, pin.coordinate.longitude]}
            >
              <Popup>
                <Pressable
                  onPress={() => onPinPress?.(pin.id)}
                  style={styles.popupContent}
                >
                  <Text style={styles.popupTitle}>{pin.title}</Text>
                  {selectedPinId === pin.id ? (
                    <Text style={styles.popupAction}>Click for directions</Text>
                  ) : null}
                  {pin.description ? (
                    <Text style={styles.popupDescription}>{pin.description}</Text>
                  ) : null}
                </Pressable>
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
  wrapperFullScreen: {
    flex: 1,
    height: "100%",
    width: "100%",
  },
  mapFrame: {
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
  },
  mapFrameFullScreen: {
    flex: 1,
    height: "100%",
    overflow: "hidden",
    width: "100%",
  },
  popupContent: {
    gap: 4,
    maxWidth: 220,
  },
  popupTitle: {
    ...theme.type.heading,
    color: theme.colors.textPrimary,
  },
  popupAction: {
    ...theme.type.label,
    color: theme.colors.brand,
  },
  popupDescription: {
    ...theme.type.caption,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
});
