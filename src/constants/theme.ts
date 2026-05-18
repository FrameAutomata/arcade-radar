export const BREAKPOINTS = {
  wide: 1100,
} as const;

export const theme = {
  // ─── Typography ──────────────────────────────────────────────────────────────
  // Font family names — loaded in _layout.tsx via useFonts
  fonts: {
    sans: "SpaceGrotesk",
    sansMedium: "SpaceGrotesk-Medium",
    sansSemiBold: "SpaceGrotesk-SemiBold",
    sansBold: "SpaceGrotesk-Bold",
    mono: "SpaceMono",
    monoBold: "SpaceMono-Bold",
  },

  // Predefined text styles — use these instead of bare fontSize/fontWeight
  type: {
    display: {
      fontFamily: "SpaceGrotesk-Bold",
      fontSize: 30,
      lineHeight: 36,
      letterSpacing: -0.5,
    },
    title: {
      fontFamily: "SpaceGrotesk-SemiBold",
      fontSize: 20,
      lineHeight: 26,
      letterSpacing: -0.3,
    },
    heading: {
      fontFamily: "SpaceGrotesk-SemiBold",
      fontSize: 15,
      lineHeight: 21,
      letterSpacing: -0.1,
    },
    body: {
      fontFamily: "SpaceGrotesk",
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0,
    },
    bodyMedium: {
      fontFamily: "SpaceGrotesk-Medium",
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: 0,
    },
    label: {
      fontFamily: "SpaceGrotesk-Medium",
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 0.2,
    },
    caption: {
      fontFamily: "SpaceGrotesk",
      fontSize: 11,
      lineHeight: 15,
      letterSpacing: 0.1,
    },
    // Monospace — use for distances, counts, timestamps, IDs
    mono: {
      fontFamily: "SpaceMono",
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0,
    },
    monoSmall: {
      fontFamily: "SpaceMono",
      fontSize: 11,
      lineHeight: 16,
      letterSpacing: 0,
    },
    // Tag — STATUS CONFIRMED etc.
    tag: {
      fontFamily: "SpaceGrotesk-Bold",
      fontSize: 10,
      lineHeight: 12,
      letterSpacing: 1.0,
    },
  },

  // ─── Colors ──────────────────────────────────────────────────────────────────
  colors: {
    // Backgrounds — layered dark navy
    background: "#04080f",
    backgroundElevated: "#070c16",

    // Surfaces
    surface: "#0b1525",
    surfaceRaised: "#0f1c30",
    surfaceMuted: "#08111e",
    surfaceStrong: "#132038",
    surfaceGlass: "rgba(7, 12, 22, 0.88)",

    // Borders
    border: "#162540",
    borderStrong: "#2a4060",
    borderAccent: "#3cf2d3",

    // Brand — orange (venue pins, primary CTAs)
    brand: "#ff8a1f",
    brandMuted: "#ffb248",
    brandDim: "rgba(255, 138, 31, 0.12)",

    // Accent — cyan (user location, active states, highlights)
    accent: "#3cf2d3",
    accentMuted: "#7af5e2",
    accentDim: "rgba(60, 242, 211, 0.10)",

    // Highlight — pink (alerts, removal, critical)
    highlight: "#ff5fa2",
    highlightDim: "rgba(255, 95, 162, 0.10)",

    // Status
    success: "#39d98a",
    successDim: "rgba(57, 217, 138, 0.10)",
    warning: "#ffd54a",
    warningDim: "rgba(255, 213, 74, 0.10)",

    // Text
    textPrimary: "#eef2ff",
    textSecondary: "#8098b8",
    textMuted: "#3d5470",
    textOnBrand: "#1a0900",
    textOnAccent: "#011a15",

    // Utility
    shadow: "#010306",
    overlay: "rgba(4, 8, 15, 0.82)",
  },

  // ─── Glow ────────────────────────────────────────────────────────────────────
  // Shadow presets for neon glow effects
  glow: {
    brand: {
      shadowColor: "#ff8a1f",
      shadowOpacity: 0.55,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 0 },
      elevation: 10,
    },
    accent: {
      shadowColor: "#3cf2d3",
      shadowOpacity: 0.5,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 0 },
      elevation: 10,
    },
    subtle: {
      shadowColor: "#3cf2d3",
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    highlight: {
      shadowColor: "#ff5fa2",
      shadowOpacity: 0.45,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 0 },
      elevation: 10,
    },
  },

  // ─── Spacing ─────────────────────────────────────────────────────────────────
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  // ─── Radius ──────────────────────────────────────────────────────────────────
  // Sharper than before — retro-futuristic prefers angles over bubbles
  radius: {
    xs: 3,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    pill: 999,
  },

  // ─── Animation ───────────────────────────────────────────────────────────────
  animation: {
    fast: 140,
    normal: 240,
    slow: 380,
  },
} as const;
