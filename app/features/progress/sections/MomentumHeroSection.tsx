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
  return Math.round(((curr - prev) / prev) * 1000) / 10; // 1dp
}

function formatDeltaInt(curr: number, prev: number) {
  const d = curr - prev;
  if (!isFinite(d)) return null;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d}`;
}

function workoutsBand(n: number): { label: string; tone: Tone; hint: string } {
  if (n >= 13)
    return {
      label: "Elite month",
      tone: "success",
      hint: "You’re training very consistently.",
    };
  if (n >= 8)
    return {
      label: "Strong",
      tone: "success",
      hint: "This is a great pace for progress.",
    };
  if (n >= 4)
    return {
      label: "Building",
      tone: "warning",
      hint: "Good base — aim for 2–3/week.",
    };
  if (n >= 1)
    return {
      label: "Starting",
      tone: "neutral",
      hint: "One more session this week makes it real.",
    };
  return {
    label: "No data yet",
    tone: "neutral",
    hint: "Log your first workout to start tracking.",
  };
}

function intensityBand(avgVol: number): { label: string; tone: Tone; hint: string } {
  if (avgVol >= 10000)
    return {
      label: "High intensity",
      tone: "success",
      hint: "You’re pushing hard per session.",
    };
  if (avgVol >= 5000)
    return {
      label: "Moderate intensity",
      tone: "neutral",
      hint: "Solid workload per workout.",
    };
  if (avgVol > 0)
    return {
      label: "Light intensity",
      tone: "warning",
      hint: "Consider adding a set or two on key lifts.",
    };
  return { label: "—", tone: "neutral", hint: "" };
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

export default function MomentumHeroSection({
  momentum,
}: {
  momentum: ProgressOverview["momentum"];
}) {
  const { colors } = useAppTheme();

  const badge =
    momentum.status === "on_fire"
      ? "ON FIRE"
      : momentum.status === "returning"
      ? "WELCOME BACK"
      : momentum.status === "new_user"
      ? "GET STARTED"
      : "STEADY";

  const w = momentum.workouts_30d ?? 0;
  const wPrev = momentum.workouts_prev_30d ?? 0;
  const vol = momentum.volume_30d ?? 0;
  const volPrev = momentum.volume_prev_30d ?? 0;

  const wDelta = useMemo(() => formatDeltaInt(w, wPrev), [w, wPrev]);
  const wPct = useMemo(() => pctChange(w, wPrev), [w, wPrev]);
  const volPct = useMemo(() => pctChange(vol, volPrev), [vol, volPrev]);

  const workouts = useMemo(() => workoutsBand(w), [w]);
  const avgVol = w > 0 ? vol / w : 0;
  const intensity = useMemo(() => intensityBand(avgVol), [avgVol]);

  return (
    <ProgressSection>
      {/* Top row */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Pill label={badge} />

        {/* ✅ custom chip (no Pill variant typing issues) */}
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

      {/* Headline */}
      <Text
        style={{
          color: colors.text,
          fontSize: 22,
          fontWeight: "900",
          letterSpacing: -0.3,
          marginTop: 10,
        }}
      >
        {momentum.headline}
      </Text>

      {/* Context */}
      <Text style={{ color: colors.textMuted, marginTop: 4 }}>
        {workouts.hint}
      </Text>

      {/* KPI grid */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <Kpi
          title="Workouts (30d)"
          value={`${w}`}
          sub={
            wPrev > 0
              ? `${wDelta ?? "—"} (${wPct}%) vs prev 30d`
              : "Baseline month"
          }
          meaning="Consistency predicts progress more than any single workout."
          tone={workouts.tone}
        />

        <Kpi
          title="Volume (30d)"
          value={formatKg(vol)}
          sub={
            volPrev > 0
              ? `${volPct == null ? "—" : `${volPct > 0 ? "+" : ""}${volPct}%`} vs prev 30d`
              : "Baseline month"
          }
          meaning="Volume = total work (weight × reps)."
          tone={intensity.tone}
        />
      </View>

      {/* Supporting metric: per-workout intensity */}
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
        {/* ✅ replace zap with flash (more likely in your icon set) */}
        <Icon name="flash" size={18} color={colors.text} />

        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "900" }}>
            {intensity.label}
          </Text>
          <Text style={{ color: colors.textMuted }}>
            Avg per workout: {formatKg(avgVol)} · {intensity.hint}
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
