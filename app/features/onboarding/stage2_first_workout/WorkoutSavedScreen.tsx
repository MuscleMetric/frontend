import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAppTheme } from "@/lib/useAppTheme";

import { SavedPill } from "./components/SavedPill";
import { WorkoutSummaryCard } from "./components/WorkoutSummaryCard";
import { PrimaryCTA } from "../shared/components/PrimaryCTA";

// ✅ Global UI
import { WorkoutCover } from "@/ui/media/WorkoutCover";

type WorkoutSavedProps = {
  workoutTitle: string;
  durationLabel: string; // "42:15"
  setsLabel: string; // "18"
  volumeLabel: string; // "8,450"
  volumeUnit?: string; // "kg" / "lb"
  imageUri?: string | null; // (optional remote URI)
  workoutImageKey?: string | null; // ✅ add this (preferred for WorkoutCover)
  onPrimary: () => void; // callback for CTA
};

export default function WorkoutSaved(props: WorkoutSavedProps) {
  const { colors, typography, layout } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log("Stage2 WorkoutSaved props:", props);
  }, [props]);

  async function onPrimary() {
    if (loading) return;
    setLoading(true);
    try {
      props.onPrimary();
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.page}>
      {/* CONTENT */}
      <View style={[styles.body, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.topCenter}>
          <SavedPill text="Saved" />
        </View>

        <View style={styles.header}>
          <Text style={styles.h1}>Workout saved</Text>
          <Text style={styles.sub}>
            This is now your baseline. Next time gets faster.
          </Text>
        </View>

        {/* ✅ BANNER (matches design) */}
        <View style={styles.bannerWrap}>
          <WorkoutCover
            variant="banner"
            height={190}
            radius={layout.radius.xl ?? layout.radius.lg}
            imageKey={props.workoutImageKey ?? null}
            title={"BASELINE ESTABLISHED"}
            subtitle={props.workoutTitle}
            // optional: tweak focus depending on your images
            focusY={0.55}
            zoom={1}
          />
        </View>

        {/* ✅ STATS CARD (no image; just metrics) */}
        <View style={styles.statsWrap}>
          <WorkoutSummaryCard
            variant="stats"
            workoutTitle={props.workoutTitle}
            durationLabel={props.durationLabel}
            setsLabel={props.setsLabel}
            volumeLabel={props.volumeLabel}
            volumeUnit={props.volumeUnit ?? "kg"}
          />
        </View>

        <View style={{ flex: 1 }} />
      </View>

      {/* FIXED BOTTOM CTA */}
      <View
        style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 14) }]}
      >
        <PrimaryCTA
          title="See what we tracked"
          onPress={onPrimary}
          loading={loading}
        />
      </View>
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },

    body: {
      flex: 1,
      paddingHorizontal: layout.space.lg,
    },

    topCenter: {
      alignItems: "center",
      marginTop: 8,
    },

    header: {
      marginTop: 18,
      alignItems: "center",
      paddingHorizontal: 10,
    },

    h1: {
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.hero,
      lineHeight: typography.lineHeight.hero,
      letterSpacing: -1,
      textAlign: "center",
    },

    sub: {
      marginTop: 10,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      textAlign: "center",
      maxWidth: 360,
    },

    bannerWrap: {
      marginTop: 18,
      alignSelf: "center",
      width: "100%",
      maxWidth: 460,
    },

    statsWrap: {
      marginTop: 14,
      alignSelf: "center",
      width: "100%",
      maxWidth: 460,
    },

    bottom: {
      paddingHorizontal: layout.space.lg,
      paddingTop: 12,
      backgroundColor: colors.bg,
    },
  });
