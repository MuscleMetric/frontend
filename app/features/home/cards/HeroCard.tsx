import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { BaseCard } from "../ui/BaseCard";
import { Pill } from "../ui/Pill";
import { performCTA } from "../cta";
import { homeTokens } from "../ui/homeTheme";

function fmtDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

export function HeroCard({ card }: { card: any }) {
  const { colors } = useAppTheme();
  const t = useMemo(() => homeTokens(colors), [colors]);
  const styles = useMemo(() => makeStyles(t), [t]);

  const badge = card?.badge ? String(card.badge) : null;
  const title = String(card?.title ?? "");
  const subtitle = card?.subtitle ? String(card.subtitle) : null;

  const primary = card?.primary_cta;
  const secondary = card?.secondary_cta;

  const meta = card?.meta ?? {};

  // Top-right: week + workout number (two lines)
  const planWeek = meta?.plan_week_number ?? meta?.week_number ?? null;
  const weekWorkout = meta?.week_workout_number ?? meta?.workout_number ?? null;

  // Under subtitle: duration + exercise count
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

  const onPrimary = () => primary?.cta && performCTA(primary.cta);
  const onSecondary = () => secondary?.cta && performCTA(secondary.cta);

  return (
    <BaseCard onPress={onPrimary} style={styles.card}>
      {/* subtle accent blob */}
      <View pointerEvents="none" style={[styles.accentBlob]} />

      <View style={{ gap: 12 }}>
        {/* Top row: badge left, week/workout right */}
        <View style={styles.topRow}>
          {badge ? (
            <View style={{ alignSelf: "flex-start" }}>
              <Pill label={badge} tone="primary" />
            </View>
          ) : (
            <View />
          )}

          {(planWeek != null || weekWorkout != null) ? (
            <View style={styles.weekBox}>
              {planWeek != null ? (
                <Text style={styles.weekText} numberOfLines={1}>
                  Week {Number(planWeek)}
                </Text>
              ) : null}
              {weekWorkout != null ? (
                <Text style={styles.workoutText} numberOfLines={1}>
                  Workout {Number(weekWorkout)}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        {subtitle ? (
          <View style={{ gap: 6 }}>
            <Text style={styles.subtitle} numberOfLines={3}>
              {subtitle}
            </Text>

            {statsLine ? (
              <Text style={styles.statsLine} numberOfLines={1}>
                {statsLine}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ height: 2 }} />

        <View style={styles.ctaRow}>
          <Pressable
            onPress={onPrimary}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed ? { opacity: 0.92, transform: [{ scale: 0.995 }] } : null,
            ]}
            hitSlop={6}
          >
            <Text style={styles.primaryText}>
              {String(primary?.label ?? "Continue")}
            </Text>
            <Text style={styles.arrow}>→</Text>
          </Pressable>

          {secondary?.cta ? (
            <Pressable
              onPress={onSecondary}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed ? { opacity: 0.9 } : null,
              ]}
              hitSlop={6}
            >
              <Text style={styles.secondaryText}>
                {String(secondary?.label ?? "")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </BaseCard>
  );
}

const makeStyles = (t: any) =>
  StyleSheet.create({
    card: {
      padding: 20,
      borderRadius: 26,
      overflow: "hidden",
    },

    accentBlob: {
      position: "absolute",
      right: -40,
      top: -30,
      width: 140,
      height: 140,
      borderRadius: 999,
      backgroundColor: t.primarySoft,
      opacity: 0.9,
    },

    topRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },

    weekBox: {
      alignItems: "flex-end",
      gap: 2,
    },

    weekText: {
      fontSize: 12,
      fontWeight: "900",
      color: t.subtle,
      letterSpacing: 0.2,
    },

    workoutText: {
      fontSize: 12,
      fontWeight: "900",
      color: t.text,
      letterSpacing: 0.2,
    },

    title: {
      fontSize: 26,
      fontWeight: "900",
      letterSpacing: -0.6,
      color: t.text,
      lineHeight: 30,
    },

    subtitle: {
      fontSize: 14,
      fontWeight: "700",
      color: t.subtle,
      lineHeight: 20,
    },

    statsLine: {
      fontSize: 12,
      fontWeight: "800",
      color: t.text,
      opacity: 0.8,
      letterSpacing: 0.1,
    },

    ctaRow: {
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },

    primaryBtn: {
      flex: 1,
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: t.primary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
    },

    primaryText: {
      fontWeight: "900",
      color: "#fff",
      fontSize: 15,
      letterSpacing: 0.2,
    },

    arrow: {
      color: "#fff",
      fontWeight: "900",
      fontSize: 16,
      marginTop: -1,
    },

    secondaryBtn: {
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: t.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.trackBorder,
      alignItems: "center",
      justifyContent: "center",
    },

    secondaryText: {
      fontWeight: "900",
      color: t.text,
      fontSize: 13,
      letterSpacing: 0.2,
    },
  });
