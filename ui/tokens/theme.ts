// ui/tokens/theme.ts
// Single source of truth for colours + typography (+ layout tokens)

// ui/tokens/theme.ts

export type ColorScheme = "light" | "dark";

export type ThemeColors = {
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;

  primary: string;
  success: string;
  warning: string;
  danger: string;

  successBg: string;

  overlay: string;
  cardPressed: string;

  trackBg: string;
  trackBorder: string;

  onPrimary: string;
  onPrimaryMuted: string;
  onPrimaryBorder: string;
  onPrimaryTrackBg: string;
};

// Optional: keep palette as const if you want
export const palette = {
  metricBlue: "#2563EB",
  momentumGreen: "#22C55E",
  peakGold: "#F59E0B",
  controlledRed: "#EF4444",

  lightBg: "#F9FAFB",
  lightSurface: "#FFFFFF",
  lightText: "#0F172A",
  lightTextMuted: "#475569",
  lightBorder: "#E5E7EB",

  darkBg: "#0B1220",
  darkSurface: "#111827",
  darkText: "#F8FAFC",
  darkTextMuted: "#94A3B8",
  darkBorder: "#1F2937",
} as const;

// ✅ KEY CHANGE: use `satisfies` to enforce shape without locking literal types
export const colors = {
  light: {
    bg: palette.lightBg,
    surface: palette.lightSurface,
    text: palette.lightText,
    textMuted: palette.lightTextMuted,
    border: palette.lightBorder,

    primary: palette.metricBlue,
    success: palette.momentumGreen,
    warning: palette.peakGold,
    danger: palette.controlledRed,

    successBg: palette.momentumGreen,

    overlay: "rgba(0,0,0,0.45)",
    cardPressed: "rgba(37,99,235,0.08)",

    trackBg: "rgba(15,23,42,0.06)",
    trackBorder: "rgba(15,23,42,0.10)",

    onPrimary: palette.darkText,
    onPrimaryMuted: palette.darkTextMuted,
    onPrimaryBorder: palette.lightBorder,
    onPrimaryTrackBg: "rgba(255,255,255,0.18)",
  },
  dark: {
    bg: palette.darkBg,
    surface: palette.darkSurface,
    text: palette.darkText,
    textMuted: palette.darkTextMuted,
    border: palette.darkBorder,

    primary: palette.metricBlue,
    success: palette.momentumGreen,
    warning: palette.peakGold,
    danger: palette.controlledRed,

    successBg: palette.momentumGreen,

    overlay: "rgba(0,0,0,0.55)",
    cardPressed: "rgba(37,99,235,0.18)",

    trackBg: "rgba(255,255,255,0.08)",
    trackBorder: "rgba(255,255,255,0.14)",

    onPrimary: palette.darkText,
    onPrimaryMuted: palette.darkTextMuted,
    onPrimaryBorder: palette.lightBorder,
    onPrimaryTrackBg: "rgba(255,255,255,0.18)",
  },
} satisfies Record<ColorScheme, ThemeColors>;

/**
 * Typography: Inter everywhere.
 * Use "Inter" if you load it via expo-font; otherwise swap to system.
 */
export const typography = {
  fontFamily: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
  },

  // Mobile-first scale
  size: {
    hero: 36,
    h1: 24,
    h2: 20,
    h3: 18,
    body: 16,
    sub: 14,
    meta: 12,
  },

  lineHeight: {
    hero: 44,
    h1: 30,
    h2: 26,
    h3: 24,
    body: 22,
    sub: 20,
    meta: 16,
  },
} as const;

export type Typography = typeof typography;

/**
 * Layout tokens (optional but you will thank yourself later).
 */
export const layout = {
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    pill: 999,
  },
  space: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
  hitSlop: 10,
} as const;

export type Layout = typeof layout;

export type AppTheme = {
  scheme: ColorScheme;
  colors: ThemeColors;
  typography: Typography;
  layout: Layout;
};

export function getTheme(scheme: ColorScheme): AppTheme {
  return {
    scheme,
    colors: colors[scheme],
    typography,
    layout,
  };
}
