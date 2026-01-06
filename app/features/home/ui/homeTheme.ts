// app/features/home/ui/homeTheme.ts
import { Platform } from "react-native";

function inferIsDark(colors: any) {
  const bg = colors?.background ?? colors?.card ?? "#FFFFFF";
  if (typeof bg !== "string") return false;

  if (bg.startsWith("#") && (bg.length === 7 || bg.length === 4)) {
    const hex =
      bg.length === 4
        ? "#" + bg[1] + bg[1] + bg[2] + bg[2] + bg[3] + bg[3]
        : bg;

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum < 0.45;
  }

  return false;
}

type PillTone = "neutral" | "primary" | "blue" | "green" | "amber" | "red";

type StatusToneKey = "complete" | "on_track" | "behind" | "neutral";

type StatusToneCfg = {
  pill: PillTone;
  fill: string;
  iconBg: string;
  iconBd: string;
  iconTx: string;
};

export function homeTokens(colors: any) {
  const isDark = inferIsDark(colors);

  const cardBg =
    colors?.card ?? colors?.surface ?? (isDark ? "#111827" : "#FFFFFF");
  const surface = colors?.surface ?? cardBg;

  const cardBorder =
    colors?.border ??
    (isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)");

  const shadow =
    Platform.OS === "ios"
      ? isDark
        ? {
            shadowOpacity: 0.06,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
          }
        : {
            shadowOpacity: 0.10,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 10 },
          }
      : { elevation: isDark ? 1 : 2 };

  const text = colors?.text ?? (isDark ? "#F9FAFB" : "#0F172A");
  const subtle =
    colors?.subtle ??
    (isDark ? "rgba(255,255,255,0.65)" : "rgba(15,23,42,0.55)");
  const muted = colors?.muted ?? subtle;

  const primary = colors?.primary ?? "#0EA5E9";
  const primarySoft = isDark
    ? "rgba(56,189,248,0.18)"
    : "rgba(14,165,233,0.12)";

  const trackBg = isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.06)";
  const trackBorder =
    isDark ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)";

  // ✅ Explicitly typed so EVERY tone has iconBg/iconBd/iconTx
  const statusTone: Record<StatusToneKey, StatusToneCfg> = {
    complete: {
      pill: "green",
      fill: isDark ? "rgba(34,197,94,0.95)" : "rgba(34,197,94,0.90)",
      iconBg: isDark ? "rgba(34,197,94,0.16)" : "rgba(34,197,94,0.10)",
      iconBd: isDark ? "rgba(34,197,94,0.22)" : "rgba(34,197,94,0.18)",
      iconTx: isDark ? "rgba(187,247,208,0.95)" : "#16A34A",
    },
    on_track: {
      pill: "amber",
      fill: isDark ? "rgba(245,158,11,0.95)" : "rgba(245,158,11,0.90)",
      iconBg: isDark ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.12)",
      iconBd: isDark ? "rgba(245,158,11,0.24)" : "rgba(245,158,11,0.18)",
      iconTx: isDark ? "rgba(254,243,199,0.95)" : "#B45309",
    },
    behind: {
      // ✅ neutral/primary vibe (not red)
      pill: "primary",
      fill: isDark ? "rgba(56,189,248,0.85)" : "rgba(14,165,233,0.80)",
      iconBg: primarySoft,
      iconBd: isDark ? "rgba(56,189,248,0.20)" : "rgba(14,165,233,0.18)",
      iconTx: primary,
    },
    neutral: {
      pill: "neutral",
      fill: primary,
      iconBg: primarySoft,
      iconBd: isDark ? "rgba(56,189,248,0.20)" : "rgba(14,165,233,0.18)",
      iconTx: primary,
    },
  };

  return {
    cardBg,
    cardBorder,
    surface,
    shadow,

    text,
    subtle,
    muted,

    primary,
    primarySoft,

    trackBg,
    trackBorder,
    statusTone,

    // keep pill map for Pill component
    pill: {
      neutral: {
        bg: isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.05)",
        bd: isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.08)",
        tx: isDark ? "rgba(255,255,255,0.80)" : "rgba(15,23,42,0.70)",
      },
      primary: {
        bg: primarySoft,
        bd: isDark ? "rgba(56,189,248,0.22)" : "rgba(14,165,233,0.22)",
        tx: primary,
      },
      blue: {
        bg: "rgba(59,130,246,0.12)",
        bd: "rgba(59,130,246,0.22)",
        tx: "#2563EB",
      },
      green: {
        bg: isDark ? "rgba(34,197,94,0.18)" : "rgba(34,197,94,0.12)",
        bd: "rgba(34,197,94,0.22)",
        tx: "#16A34A",
      },
      amber: {
        bg: isDark ? "rgba(245,158,11,0.20)" : "rgba(245,158,11,0.14)",
        bd: "rgba(245,158,11,0.22)",
        tx: "#B45309",
      },
      red: {
        bg: "rgba(239,68,68,0.12)",
        bd: "rgba(239,68,68,0.22)",
        tx: "#DC2626",
      },
    } as Record<PillTone, { bg: string; bd: string; tx: string }>,
  };
}
