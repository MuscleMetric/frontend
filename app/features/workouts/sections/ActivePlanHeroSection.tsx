// app/features/workouts/sections/ActivePlanHeroSection.tsx

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Button, Pill, MiniRing, WorkoutCover } from "@/ui";

import { CoachsTipCard } from "../components/CoachTipCard";

export function ActivePlanHeroSection({
  userId,
  activePlan,
  onStartNext,
}: {
  userId?: string | null;
  activePlan: {
    planId: string;
    title: string;
    metaLine?: string | null;
    progress: { completedCount: number; totalCount: number; pct: number };
    nextWorkout: {
      planWorkoutId: string;
      workoutId: string;
      title: string;
      imageKey: string | null;
    } | null;
    primaryCta: { label: string; action: "start_workout" };
  };
  onStartNext?: (args: { workoutId: string; planWorkoutId: string }) => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  const pct = Math.max(0, Math.min(100, Number(activePlan.progress.pct || 0)));
  const nw = activePlan.nextWorkout;
  const canStart = !!nw;

  return (
    <Card>
      <View style={{ gap: layout.space.md }}>
        {/* Banner first */}
        {nw ? (
          <WorkoutCover
            imageKey={nw.imageKey}
            variant="banner"
            height={140}
            radius={layout.radius.lg}
            // keep banner clean (no title/subtitle inside)
            title={null}
            subtitle={null}
            // slight zoom for nicer crop on banner if needed
            zoom={1.02}
            // pill on banner top-right
            badge={<Pill label="Active Plan" variant="inverted" />}
            badgePosition="topLeft" 
            style={styles.bannerFix} 
          />
        ) : (
          <View
            style={{
              height: 140,
              borderRadius: layout.radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.trackBg,
              justifyContent: "center",
              alignItems: "center",
              padding: layout.space.md,
            }}
          >
            <Text
              style={{
                fontFamily: typography.fontFamily.medium,
                fontSize: typography.size.sub,
                color: colors.textMuted,
              }}
            >
              No next workout available.
            </Text>
          </View>
        )}

        {/* Title row with MiniRing inline */}
        <View style={styles.titleRow}>
          <Text
            numberOfLines={2}
            style={{
              flex: 1,
              fontFamily: typography.fontFamily.bold,
              fontSize: typography.size.h2,
              lineHeight: typography.lineHeight.h2,
              color: colors.text,
              letterSpacing: -0.2,
            }}
          >
            {activePlan.title}
          </Text>

          <MiniRing valuePct={pct} size={44} stroke={6} />
        </View>

        {/* Meta line */}
        {activePlan.metaLine ? (
          <Text
            style={{
              marginTop: -6,
              fontFamily: typography.fontFamily.medium,
              fontSize: typography.size.sub,
              lineHeight: typography.lineHeight.sub,
              color: colors.textMuted,
            }}
          >
            {activePlan.metaLine}
          </Text>
        ) : null}

        {/* Coach tip */}
        <CoachsTipCard userId={userId} />

        {/* Primary CTA */}
        <Button
          title={canStart ? `Start: ${nw!.title}` : "No workout to start"}
          disabled={!canStart}
          onPress={() => {
            if (!nw || !onStartNext) return;
            onStartNext({
              workoutId: nw.workoutId,
              planWorkoutId: nw.planWorkoutId,
            });
          }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  // keeps banner layout stable inside Card padding
  bannerFix: {
    width: "100%",
  },
});
