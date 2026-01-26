// app/features/home/cards/HeroCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { performCTA } from "../cta";
import { Card, Button, Pill, WorkoutCover } from "@/ui";

function fmtDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

/**
 * Detect weekly completion from the server-provided weekly_goal card.
 */
function isWeeklyTargetComplete(summary?: any) {
  const cards = summary?.cards ?? [];
  const wg = cards.find((c: any) => c?.type === "weekly_goal");
  return wg?.status === "complete";
}

export function HeroCard({ card, summary }: { card: any; summary?: any }) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  /* ---------------------------------------------
   * Core state detection
   * ------------------------------------------- */

  const weekComplete =
    summary?.home_variant === "experienced_plan" &&
    isWeeklyTargetComplete(summary);

  const workoutsCount = summary?.workouts_count ?? 0;
  const hasAnyWorkouts =
    workoutsCount > 0 || summary?.has_saved_workouts === true;

  const isNewUser = summary?.home_variant === "new_user";

  /* ---------------------------------------------
   * Workout metadata (for experienced users)
   * ------------------------------------------- */

  const meta = card?.meta ?? {};
  const workoutImageKey = meta?.workout_image_key ?? null;

  const exerciseCount =
    meta?.exercise_count != null ? Number(meta.exercise_count) : null;

  const avgDuration =
    meta?.avg_duration_seconds != null
      ? Number(meta.avg_duration_seconds)
      : null;

  const statsLine = useMemo(() => {
    const parts: string[] = [];
    const d = fmtDuration(avgDuration);
    if (d) parts.push(d);
    if (exerciseCount != null) parts.push(`${exerciseCount} exercises`);
    return parts.length ? parts.join(" · ") : null;
  }, [avgDuration, exerciseCount]);

  /* ---------------------------------------------
   * HERO COPY + CTA DECISION TREE
   * ------------------------------------------- */

  let heroTitle: string;
  let heroSubtitle: string | null;
  let heroPrimary: { label: string; cta: any };
  let heroSecondary: { label: string; cta: any } | null = null;
  let heroBadge: string | null = null;
  let showCover = true;
  let coverHeight = 170;

  // 🟩 Week complete (celebratory, premium, single-CTA)
  if (weekComplete) {
    heroTitle = "Week complete";
    heroSubtitle = "Nice work — you hit your weekly target.";
    heroPrimary = {
      label: "Log a bonus session",
      cta: { action: "open_workouts_tab" },
    };

    // ✅ remove the messy double CTA (and it was duplicate anyway)
    heroSecondary = null;

    heroBadge = "COMPLETED";

    // ✅ keep hero feeling (use WorkoutCover instead of text-only)
    showCover = true;
    coverHeight = 170;
  }

  // 🟦 New user with NO workouts
  else if (isNewUser && !hasAnyWorkouts) {
    heroTitle = "Let’s get your first workout in";
    heroSubtitle =
      "Choose a starter workout below — no pressure, we’ll guide you through it.";
    heroPrimary = {
      label: "Choose a starter workout ↓",
      cta: { action: "scroll_to_starters" }, // or open_workouts_tab
    };
    heroBadge = null;
    showCover = true;
    coverHeight = 190; // extra room so text is never truncated
  }

  // 🟨 User has 1+ workouts (suggested workout)
  else {
    heroTitle = String(card?.title ?? "Your workout");
    heroSubtitle = statsLine ?? card?.subtitle ?? null;
    heroPrimary = {
      label: "Start workout",
      cta: { action: "start_workout" },
    };

    // Only show secondary if multiple workouts exist
    heroSecondary =
      workoutsCount > 1
        ? {
            label: "Choose another",
            cta: { action: "open_workouts_tab" },
          }
        : null;

    heroBadge = workoutsCount > 1 ? "SUGGESTED" : null;
    showCover = true;
  }

  const onPrimary = () => heroPrimary?.cta && performCTA(heroPrimary.cta);
  const onSecondary = () => heroSecondary?.cta && performCTA(heroSecondary.cta);

  /* ---------------------------------------------
   * RENDER
   * ------------------------------------------- */

  return (
    <Card variant="pressable" onPress={onPrimary} style={styles.card}>
      <View style={{ gap: layout.space.sm }}>
        {/* ---------------------------------
         * COVER (all states now, incl weekComplete)
         * --------------------------------- */}
        {showCover ? (
          <WorkoutCover
            imageKey={workoutImageKey ?? "full_body"}
            title={heroTitle}
            subtitle={heroSubtitle}
            height={coverHeight}
            radius={layout.radius.lg}
            badge={heroBadge ? <Pill label={heroBadge} tone="neutral" /> : null}
            badgePosition="topLeft"
          />
        ) : (
          <>
            {/* (no longer used for weekComplete, kept for compatibility) */}
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {heroTitle}
              </Text>
              {heroBadge ? (
                <View style={styles.badgeInTitleRow}>
                  <Pill label={heroBadge} tone="neutral" />
                </View>
              ) : null}
            </View>

            {heroSubtitle ? (
              <Text style={styles.subtitle} numberOfLines={3}>
                {heroSubtitle}
              </Text>
            ) : null}
          </>
        )}

        {/* ---------------------------------
         * CTA ROW
         * --------------------------------- */}
        <View style={styles.ctaWrap}>
          <View style={{ flex: 1 }}>
            <Button
              title={heroPrimary.label}
              onPress={onPrimary}
              variant={
                isNewUser && !hasAnyWorkouts
                  ? "outline" // ✅ calm onboarding CTA
                  : "primary"
              }
              tone="primary"
            />
          </View>

          {heroSecondary ? (
            <View style={styles.secondaryTextBtn}>
              <Button
                title={heroSecondary.label}
                onPress={onSecondary}
                variant="text"
                tone="primary"
                fullWidth={false}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      overflow: "hidden",
      borderRadius: layout.radius.xl,
      padding: layout.space.xs,
      marginTop: layout.space.md,
    },

    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: layout.space.sm,
      paddingHorizontal: layout.space.sm,
      paddingTop: layout.space.sm,
    },

    title: {
      flex: 1,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h1,
      lineHeight: typography.lineHeight.h1,
      letterSpacing: -0.6,
      color: colors.text,
    },

    badgeInTitleRow: {
      marginLeft: layout.space.sm,
    },

    subtitle: {
      paddingHorizontal: layout.space.sm,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.textMuted,
      textAlign: "left",
      marginTop: layout.space.xs,
    },

    ctaWrap: {
      marginTop: layout.space.md,
      flexDirection: "row",
      alignItems: "center",
      gap: layout.space.sm,
      paddingHorizontal: layout.space.sm,
      paddingBottom: layout.space.sm,
    },

    secondaryTextBtn: {
      alignSelf: "center",
    },
  });
