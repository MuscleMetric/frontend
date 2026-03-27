// app/features/workouts/live/session/ActiveWorkoutBar.tsx

import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Play, Dumbbell } from "lucide-react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import { useActiveWorkoutSession } from "./useActiveWorkoutSession";

export function ActiveWorkoutBar() {
  const { colors, typography, layout } = useAppTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const { activeWorkout, hasActiveWorkout, timerText, resumeWorkout, loading } =
    useActiveWorkoutSession();

  const shouldHide = useMemo(() => {
    if (!hasActiveWorkout) return true;
    if (loading) return true;

    if (!pathname) return false;

    return (
      pathname.startsWith("/features/workouts/live") ||
      pathname.startsWith("/features/workouts/review") ||
      pathname.startsWith("/(auth)") ||
      pathname.startsWith("/onboarding")
    );
  }, [hasActiveWorkout, loading, pathname]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          position: "absolute",
          left: 12,
          right: 12,
          bottom: Math.max(insets.bottom + 62, 74),
          borderRadius: 18,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 14,
          paddingVertical: 12,
          shadowOpacity: 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
        iconWrap: {
          width: 38,
          height: 38,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
        },
        textWrap: {
          flex: 1,
          minWidth: 0,
        },
        title: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
        },
        subtitle: {
          marginTop: 2,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
        },
        timerWrap: {
          alignItems: "flex-end",
        },
        timer: {
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.body,
        },
        resume: {
          marginTop: 2,
          color: colors.primary,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
        },
      }),
    [colors, typography, insets.bottom],
  );

  if (shouldHide || !activeWorkout) return null;

  const title = activeWorkout.title?.trim() || "In-progress workout";

  return (
    <Pressable onPress={resumeWorkout} style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Dumbbell size={18} color={colors.text} />
        </View>

        <View style={styles.textWrap}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            Workout active
          </Text>
        </View>

        <View style={styles.timerWrap}>
          <Text style={styles.timer}>{timerText}</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 2,
            }}
          >
            <Play size={12} color={colors.primary} />
            <Text style={styles.resume}>Resume</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}