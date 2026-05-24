import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { Pill, Icon } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";
import { ProgressSection } from "../components/ProgressSection";
import type { ProgressOverview } from "../data/progress.types";
import { formatKg } from "../data/progress.mapper";

type Tone = "success" | "warning" | "neutral";

function pctChange(curr: number, prev: number) {
  if (!isFinite(curr) || !isFinite(prev) || prev <= 0) return null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function formatDeltaInt(curr: number, prev: number) {
  const d = curr - prev;
  if (!isFinite(d)) return null;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d}`;
}

function workoutsBand(n: number): { label: string; tone: Tone; hint: string } {
  if (n >= 13) {
    return {
      label: "High log count",
      tone: "success",
      hint: "This month includes a high number of logged workouts.",
    };
  }

  if (n >= 8) {
    return {
      label: "Active month",
      tone: "success",
      hint: "This month includes regular logged workouts.",
    };
  }

  if (n >= 4) {
    return {
      label: "Logged activity",
      tone: "warning",
      hint: "This month includes several logged workouts.",
    };
  }

  if (n >= 1) {
    return {
      label: "Started logging",
      tone: "neutral",
      hint: "This month includes your first logged workouts.",
    };
  }

  return {
    label: "No data yet",
    tone: "neutral",
    hint: "Log a workout to start building your progress summary.",
  };
}

function volumeBand(avgVol: number): { label: string; tone: Tone; hint: string } {
  if (avgVol >= 10000) {
    return {
      label: "Higher logged volume",
      tone: "success",
      hint: "Average logged volume per workout is higher in this period.",
    };
  }

  if (avgVol >= 5000) {
    return {
      label: "Moderate logged volume",
      tone: "neutral",
      hint: "Average logged volume per workout is in the middle range.",
    };
  }

  if (avgVol > 0) {
    return {
      label: "Lower logged volume",
      tone: "warning",
      hint: "Average logged volume per workout is lower in this period.",
    };
  }

  return {
    label: "No volume data",
    tone: "neutral",
    hint: "Volume appears after logged weighted sets.",
  };
}

function toneChipStyle(colors: any, tone: Tone) {
  const base = {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  };

  if (tone === "success") {
    return {
      ...base,
      backgroundColor: (colors.success ?? colors.primary) + "1A",
      borderColor: (colors.success ?? colors.primary) + "55",
    };
  }

  if (tone === "warning") {
    return {
      ...base,
      backgroundColor: (colors.warning ?? colors.primary) + "1A",
      borderColor: (colors.warning ?? colors.primary) + "55",
    };
  }

  return {
    ...base,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  };
}

function toneChipText(colors: any, tone: Tone) {
  if (tone === "success") return colors.success ?? colors.primary;
  if (tone === "warning") return colors.warning ?? colors.primary;
  return colors.textMuted;
}

function formatPercentDelta(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value}%`;
}

function safeHeadline(momentum: ProgressOverview["momentum"]) {
  if (momentum.status === "new_user") {
    return "Your progress summary starts here";
  }

  if (momentum.status === "returning") {
    return "Your recent workout summary";
  }

  if (momentum.status === "on_fire") {
    return "Your recent logged activity";
  }

  return "Your progress overview";
}

export default function MomentumHeroSection({
  momentum,
}: {
  momentum: ProgressOverview["momentum"];
}) {
  const { colors } = useAppTheme();

  const badge =
    momentum.status === "on_fire"
      ? "ACTIVE PERIOD"
      : momentum.status === "returning"
        ? "RECENT RETURN"
        : momentum.status === "new_user"
          ? "GET STARTED"
          : "SUMMARY";

  const w = momentum.workouts_30d ?? 0;
  const wPrev = momentum.workouts_prev_30d ?? 0;
  const vol = momentum.volume_30d ?? 0;
  const volPrev = momentum.volume_prev_30d ?? 0;

  const wDelta = useMemo(() => formatDeltaInt(w, wPrev), [w, wPrev]);
  const wPct = useMemo(() => pctChange(w, wPrev), [w, wPrev]);
  const volPct = useMemo(() => pctChange(vol, volPrev), [vol, volPrev]);

  const workouts = useMemo(() => workoutsBand(w), [w]);
  const avgVol = w > 0 ? vol / w : 0;
  const volume = useMemo(() => volumeBand(avgVol), [avgVol]);

  return (
    <ProgressSection>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Pill label={badge} />

        <View style={toneChipStyle(colors, workouts.tone)}>
          <Text
            style={{
              color: toneChipText(colors, workouts.tone),
              fontWeight: "900",
              fontSize: 12,
              letterSpacing: 0.4,
            }}
          >
            {workouts.label.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text
        style={{
          color: colors.text,
          fontSize: 22,
          fontWeight: "900",
          letterSpacing: -0.3,
          marginTop: 10,
        }}
      >
        {safeHeadline(momentum)}
      </Text>

      <Text style={{ color: colors.textMuted, marginTop: 4 }}>
        {workouts.hint}
      </Text>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <Kpi
          title="Workouts logged (30d)"
          value={`${w}`}
          sub={
            wPrev > 0
              ? `${wDelta ?? "—"} (${formatPercentDelta(wPct)}) vs previous 30d`
              : "First 30-day comparison period"
          }
          meaning="Shows the number of workouts logged in this period."
          tone={workouts.tone}
        />

        <Kpi
          title="Volume logged (30d)"
          value={formatKg(vol)}
          sub={
            volPrev > 0
              ? `${formatPercentDelta(volPct)} vs previous 30d`
              : "First 30-day comparison period"
          }
          meaning="Volume is calculated from logged weight and reps."
          tone={volume.tone}
        />
      </View>

      <View
        style={{
          marginTop: 10,
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 12,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Icon name="flash" size={18} color={colors.text} />

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {volume.label}
          </Text>
          <Text style={{ color: colors.textMuted }}>
            Avg logged volume per workout: {formatKg(avgVol)} · {volume.hint}
          </Text>
        </View>
      </View>
    </ProgressSection>
  );
}

function Kpi({
  title,
  value,
  sub,
  meaning,
  tone,
}: {
  title: string;
  value: string;
  sub: string;
  meaning: string;
  tone: Tone;
}) {
  const { colors } = useAppTheme();

  const border =
    tone === "success"
      ? colors.success ?? colors.primary
      : tone === "warning"
        ? colors.warning ?? colors.primary
        : colors.border;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{title}</Text>

      <Text
        style={{
          color: colors.text,
          fontWeight: "900",
          fontSize: 22,
          marginTop: 4,
        }}
      >
        {value}
      </Text>

      <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 12 }}>
        {sub}
      </Text>

      <Text style={{ color: colors.textMuted, marginTop: 6, fontSize: 12 }}>
        {meaning}
      </Text>
    </View>
  );
}