// app/theme.ts
import { DarkTheme as NavDark, DefaultTheme as NavLight } from "@react-navigation/native";

export const LightTheme = {
  ...NavLight,
  colors: {
    ...NavLight.colors,
    // base
    background: "#F7F8FA",
    card: "#FFFFFF",
    text: "#111827",
    border: "#E5E7EB",
    notification: "#0b6aa9",
    muted: "#6b7280",
    subtle: "#9ca3af",
    primaryBg: "#e6f0ff",
    primaryText: "#0b6aa9",
    successBg: "#e6f6ea",
    successText: "#16a34a",
    warnBg: "#fff3e0",
    warnText: "#b45309",
    danger: "#ef4444",
  },
};

export const DarkTheme = {
  ...NavDark,
  colors: {
    ...NavDark.colors,
    background: "#0B1220",   // near-slate/indigo
    card: "#111827",         // slate-900
    text: "#F9FAFB",         // near-white
    border: "#1F2937",
    notification: "#60a5fa",

    muted: "#9CA3AF",
    subtle: "#6B7280",

    primaryBg: "#0f172a",    // deep slate tint
    primaryText: "#93c5fd",
    successBg: "#052e1a",
    successText: "#86efac",
    warnBg: "#3b2a07",
    warnText: "#fcd34d",
    danger: "#f87171",
  },
};
