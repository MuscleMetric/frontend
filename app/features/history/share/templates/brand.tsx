import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "@/lib/useAppTheme";
import type { ShareWorkoutData } from "../workoutShare";
import {
  ShareTokens,
  MetaChip,
  StatTile,
  Surface,
  Divider,
  ExerciseRow,
  PRBanner,
  bestTopSetLabel,
  formatVolumeKg,
  pickBestPR,
  makeScale,
} from "./shared";
import { Icon } from "@/ui";

export function BrandShareCard({
  data,
  width,
  height,
}: {
  data: ShareWorkoutData;
  width: number;
  height: number;
}) {
  const { typography } = useAppTheme();

  // scale system (makes everything feel “story-sized”)
  const scale = useMemo(() => makeScale(width), [width]);

  // Bigger outer padding (fills canvas better)
  const PAD_X = Math.round(width * 0.07);
  const PAD_TOP = Math.round(height * 0.085);
  const PAD_BOTTOM = Math.round(height * 0.07);

  const tokens: ShareTokens = {
    fg: "#FFFFFF",
    muted: "rgba(255,255,255,0.78)",
    muted2: "rgba(255,255,255,0.52)",
    border: "rgba(255,255,255,0.14)",
    hairline: "rgba(255,255,255,0.09)",
    surface: "rgba(255,255,255,0.08)",
    surfaceStrong: "rgba(255,255,255,0.10)",
    activeBorder: "rgba(60,140,255,0.75)",
    activeSurface: "rgba(10, 90, 255, 0.24)",
    brandAccent: "#3C8CFF",
    useBlur: false,
  };

  const meta = useMemo(() => {
    return {
      volume: formatVolumeKg(data.totalVolumeKg),
      sets: data.totalSets != null ? String(data.totalSets) : "—",
      prs: data.prs?.length != null ? String(data.prs.length) : "0",
    };
  }, [data]);

  const pr = useMemo(() => pickBestPR(data), [data]);

  const maxExercises = 5;
  const moreCount = Math.max(0, (data.exercises?.length ?? 0) - maxExercises);

  return (
    <View
      style={{
        width,
        height,
        backgroundColor: "#071C3E",
        paddingHorizontal: PAD_X,
        paddingTop: PAD_TOP,
        paddingBottom: PAD_BOTTOM,
      }}
    >
      {/* Subtle brand wash */}
      <LinearGradient
        colors={["rgba(10,90,255,0.22)", "rgba(0,0,0,0)"]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />

      {/* Single centered column so it reads as ONE card */}
      <View style={{ flex: 1, alignItems: "center" }}>
        <View style={{ width: scale.contentW, flex: 1, justifyContent: "space-between" }}>
          {/* ===== Header block ===== */}
          <View style={{ alignItems: "center", gap: scale.gapMd }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Icon name="flash" size={18} color={tokens.fg} />
              <Text
                style={{
                  color: tokens.muted,
                  fontSize: 13,
                  letterSpacing: 2.2,
                  fontFamily: typography.fontFamily.semibold,
                }}
              >
                MUSCLEMETRIC
              </Text>
            </View>

            <Text
              numberOfLines={2}
              style={{
                color: tokens.fg,
                fontSize: 92, // bigger title for story format
                lineHeight: 94,
                letterSpacing: -1.4,
                fontFamily: typography.fontFamily.bold,
                textAlign: "center",
                paddingHorizontal: 8,
              }}
            >
              {data.title}
            </Text>

            {/* Meta chips */}
            <View style={{ flexDirection: "row", gap: 12, justifyContent: "center" }}>
              <MetaChip
                icon="calendar"
                text={data.dateLabel}
                tokens={tokens}
                typography={typography}
                scale={scale}
              />
              <MetaChip
                icon="time"
                text={data.durationLabel}
                tokens={tokens}
                typography={typography}
                scale={scale}
              />
            </View>

            {/* Stats tiles */}
            <View style={{ flexDirection: "row", gap: 14, width: "100%", marginTop: 6 }}>
              <StatTile
                label="Volume"
                value={meta.volume}
                active
                tokens={tokens}
                typography={typography}
                scale={scale}
              />
              <StatTile
                label="Sets"
                value={meta.sets}
                tokens={tokens}
                typography={typography}
                scale={scale}
              />
              <StatTile
                label="PRs"
                value={meta.prs}
                tokens={tokens}
                typography={typography}
                scale={scale}
              />
            </View>
          </View>

          {/* ===== Body block (anchored + fuller) ===== */}
          <View style={{ marginTop: scale.gapLg }}>
            <Surface
              tokens={tokens}
              style={{
                width: "100%",
                borderRadius: scale.rCard,
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: tokens.surface,
                paddingVertical: scale.pyCard,
                paddingHorizontal: scale.pxCard,
                gap: scale.gapSm,
              }}
            >
              {(data.exercises ?? []).slice(0, maxExercises).map((ex, idx) => {
                const value = bestTopSetLabel(ex);
                const last = idx === Math.min(maxExercises, data.exercises.length) - 1;

                return (
                  <View key={`${ex.name}-${idx}`} style={{ gap: scale.gapSm }}>
                    <ExerciseRow
                      name={ex.name}
                      value={value}
                      tokens={tokens}
                      typography={typography}
                      scale={scale}
                    />
                    {!last ? <Divider tokens={tokens} /> : null}
                  </View>
                );
              })}

              {moreCount > 0 ? (
                <Text
                  style={{
                    color: tokens.muted,
                    fontSize: 13,
                    fontFamily: typography.fontFamily.semibold,
                    letterSpacing: 0.4,
                    marginTop: 4,
                  }}
                >
                  + {moreCount} more exercises
                </Text>
              ) : null}
            </Surface>
          </View>

          {/* ===== Footer block (feels connected) ===== */}
          <View style={{ gap: scale.gapSm }}>
            <PRBanner pr={pr} tokens={tokens} typography={typography} scale={scale} />
            <Text
              style={{
                textAlign: "center",
                color: tokens.muted2,
                fontSize: 11,
                letterSpacing: 1.4,
                fontFamily: typography.fontFamily.semibold,
              }}
            >
              TRAIN WITH MUSCLEMETRIC
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
