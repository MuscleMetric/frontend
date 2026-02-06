import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function NewUserProgressCard({
  completed,
  target = 5,
}: {
  completed: number;
  target?: number;
}) {
  const { colors, layout, typography } = useAppTheme();
  const pct = Math.min(completed / target, 1);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: layout.radius.lg,
        },
      ]}
    >
      <Text
        style={{
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.h2,
          color: colors.text,
          marginBottom: 6,
        }}
      >
        Unlock your full dashboard
      </Text>

      <Text
        style={{
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          color: colors.textMuted,
          marginBottom: 12,
        }}
      >
        Complete {target} workouts to unlock advanced insights and goals.
      </Text>

      {/* Progress bar */}
      <View
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: colors.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            backgroundColor: colors.primary,
          }}
        />
      </View>

      <Text
        style={{
          marginTop: 8,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.h3,
          color: colors.textMuted,
        }}
      >
        {completed} / {target} workouts completed
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
  },
});
