import React from "react";
import { View, Text } from "react-native";
import { BlurView } from "expo-blur";
import { Icon } from "@/ui";

export type ShareTokens = {
  fg: string;
  muted: string;
  muted2: string;
  border: string;
  hairline: string;
  surface: string;
  surfaceStrong: string;
  activeBorder: string;
  activeSurface: string;
  brandAccent?: string;
  useBlur: boolean;
};

export type ShareScale = {
  // layout
  contentW: number;
  // spacings
  gapSm: number;
  gapMd: number;
  gapLg: number;
  // radii
  rChip: number;
  rTile: number;
  rCard: number;
  rBanner: number;
  // paddings
  pxChip: number;
  pyChip: number;
  pxTile: number;
  pyTile: number;
  pxCard: number;
  pyCard: number;
  pxBanner: number;
  pyBanner: number;
  // text sizes
  chipText: number;
  tileLabel: number;
  tileValue: number;
  exName: number;
  exSub: number;
  exValue: number;
  prKicker: number;
  prTitle: number;
  prRight: number;
};

export function makeScale(width: number): ShareScale {
  // Designed for 1080x1920 but scales down reasonably
  const k = width / 1080;

  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

  const contentW = Math.min(Math.round(width * 0.86), 960);

  return {
    contentW,

    gapSm: clamp(Math.round(12 * k), 10, 16),
    gapMd: clamp(Math.round(18 * k), 14, 24),
    gapLg: clamp(Math.round(28 * k), 20, 36),

    rChip: 999,
    rTile: clamp(Math.round(20 * k), 16, 26),
    rCard: clamp(Math.round(30 * k), 22, 38),
    rBanner: clamp(Math.round(26 * k), 20, 34),

    pxChip: clamp(Math.round(16 * k), 12, 20),
    pyChip: clamp(Math.round(12 * k), 10, 16),

    pxTile: clamp(Math.round(16 * k), 12, 22),
    pyTile: clamp(Math.round(16 * k), 12, 22),

    pxCard: clamp(Math.round(22 * k), 16, 28),
    pyCard: clamp(Math.round(22 * k), 16, 28),

    pxBanner: clamp(Math.round(18 * k), 14, 24),
    pyBanner: clamp(Math.round(16 * k), 12, 22),

    chipText: clamp(Math.round(14 * k), 12, 16),

    tileLabel: clamp(Math.round(12 * k), 10, 14),
    tileValue: clamp(Math.round(26 * k), 20, 32),

    exName: clamp(Math.round(24 * k), 18, 28),
    exSub: clamp(Math.round(13 * k), 11, 15),
    exValue: clamp(Math.round(20 * k), 16, 24),

    prKicker: clamp(Math.round(11 * k), 10, 12),
    prTitle: clamp(Math.round(20 * k), 16, 24),
    prRight: clamp(Math.round(16 * k), 13, 18),
  };
}

export function formatVolumeKg(v?: number | null) {
  if (v == null) return "—";
  const r = Math.round(v);
  if (r >= 1000) return `${Math.round(r / 100) / 10}k`;
  return `${r}`;
}

export function bestTopSetLabel(ex: any) {
  const candidates = (ex.sets ?? [])
    .filter((s: any) => s.weightKg != null && s.reps != null)
    .sort((a: any, b: any) => (b.weightKg ?? 0) - (a.weightKg ?? 0));
  const top = candidates[0];
  if (top?.weightKg != null && top?.reps != null) return `${top.weightKg}kg × ${top.reps}`;
  return `${(ex.sets ?? []).length} sets`;
}

export function pickBestPR(data: any) {
  return data?.prs?.[0] ?? null;
}

export function Surface({
  children,
  tokens,
  intensity = 24,
  style,
}: {
  children: React.ReactNode;
  tokens: ShareTokens;
  intensity?: number;
  style?: any;
}) {
  if (tokens.useBlur) {
    return (
      <BlurView intensity={intensity} tint="dark" style={[{ overflow: "hidden" }, style]}>
        {children}
      </BlurView>
    );
  }
  return <View style={[{ overflow: "hidden" }, style]}>{children}</View>;
}

export function MetaChip({
  icon,
  text,
  tokens,
  typography,
  scale,
}: {
  icon: any;
  text: string;
  tokens: ShareTokens;
  typography: any;
  scale: ShareScale;
}) {
  return (
    <Surface
      tokens={tokens}
      intensity={26}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: scale.pxChip,
        paddingVertical: scale.pyChip,
        borderRadius: scale.rChip,
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.surface,
      }}
    >
      <Icon name={icon} size={16} color={tokens.muted} />
      <Text
        style={{
          color: tokens.fg,
          fontSize: scale.chipText,
          fontFamily: typography.fontFamily.semibold,
          letterSpacing: 0.2,
        }}
      >
        {text}
      </Text>
    </Surface>
  );
}

export function StatTile({
  label,
  value,
  active,
  tokens,
  typography,
  scale,
}: {
  label: string;
  value: string;
  active?: boolean;
  tokens: ShareTokens;
  typography: any;
  scale: ShareScale;
}) {
  return (
    <Surface
      tokens={tokens}
      intensity={28}
      style={{
        flex: 1,
        borderRadius: scale.rTile,
        borderWidth: 1,
        borderColor: active ? tokens.activeBorder : tokens.border,
        backgroundColor: active ? tokens.activeSurface : tokens.surface,
        paddingVertical: scale.pyTile,
        paddingHorizontal: scale.pxTile,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <Text
        style={{
          color: tokens.muted,
          fontSize: scale.tileLabel,
          letterSpacing: 1.6,
          fontFamily: typography.fontFamily.semibold,
        }}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        style={{
          color: tokens.fg,
          fontSize: scale.tileValue,
          letterSpacing: -0.4,
          fontFamily: typography.fontFamily.bold,
        }}
      >
        {value}
      </Text>
    </Surface>
  );
}

export function Divider({ tokens }: { tokens: ShareTokens }) {
  return <View style={{ height: 1, backgroundColor: tokens.hairline }} />;
}

export function ExerciseRow({
  name,
  value,
  tokens,
  typography,
  scale,
}: {
  name: string;
  value: string;
  tokens: ShareTokens;
  typography: any;
  scale: ShareScale;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text
          numberOfLines={1}
          style={{
            color: tokens.fg,
            fontSize: scale.exName,
            letterSpacing: -0.3,
            fontFamily: typography.fontFamily.bold,
          }}
        >
          {name}
        </Text>
        <Text
          style={{
            marginTop: 3,
            color: tokens.muted2,
            fontSize: scale.exSub,
            letterSpacing: 0.8,
            fontFamily: typography.fontFamily.semibold,
          }}
        >
          TOP SET
        </Text>
      </View>

      <Text
        style={{
          color: tokens.fg,
          fontSize: scale.exValue,
          fontFamily: typography.fontFamily.semibold,
          letterSpacing: -0.2,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function PRBanner({
  pr,
  tokens,
  typography,
  scale,
}: {
  pr: any;
  tokens: ShareTokens;
  typography: any;
  scale: ShareScale;
}) {
  if (!pr) return null;

  const right = pr.weightKg != null && pr.reps != null ? `${pr.weightKg}kg × ${pr.reps}` : "PR";

  return (
    <Surface
      tokens={tokens}
      intensity={30}
      style={{
        borderRadius: scale.rBanner,
        borderWidth: 1,
        borderColor: tokens.activeBorder,
        backgroundColor: tokens.activeSurface,
        paddingHorizontal: scale.pxBanner,
        paddingVertical: scale.pyBanner,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(255,255,255,0.10)",
        }}
      >
        <Icon name="trophy" size={18} color={tokens.fg} />
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: tokens.muted,
            fontSize: scale.prKicker,
            letterSpacing: 1.4,
            fontFamily: typography.fontFamily.semibold,
          }}
        >
          NEW PERSONAL BEST
        </Text>
        <Text
          numberOfLines={1}
          style={{
            marginTop: 2,
            color: tokens.fg,
            fontSize: scale.prTitle,
            letterSpacing: -0.2,
            fontFamily: typography.fontFamily.bold,
          }}
        >
          {pr.exerciseName}
        </Text>
      </View>

      <Text
        style={{
          color: tokens.fg,
          fontSize: scale.prRight,
          fontFamily: typography.fontFamily.semibold,
          opacity: 0.95,
        }}
      >
        {right}
      </Text>
    </Surface>
  );
}
