// app/features/workouts/live/review/ui/ReviewHeader.tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";

export function ReviewHeader(props: { title?: string; onBack: () => void }) {
  const { colors, typography } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top + 6,
        paddingHorizontal: 16,
        paddingBottom: 10,
        backgroundColor: colors.bg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        position: "relative",
      }}
    >
      <Pressable
        onPress={props.onBack}
        hitSlop={12}
        style={{
          position: "absolute",
          left: 16,
          top: insets.top + 10,
          paddingVertical: 8,
          zIndex: 10,
        }}
      >
        <Text style={{ color: colors.text, fontFamily: typography.fontFamily.semibold, fontSize: 16 }}>
          ←
        </Text>
      </Pressable>

      <Text
        style={{
          textAlign: "center",
          color: colors.text,
          fontFamily: typography.fontFamily.bold,
          fontSize: 18,
          letterSpacing: -0.2,
          paddingVertical: 10,
        }}
      >
        {props.title ?? "Review Workout"}
      </Text>

      <Text
        style={{
          textAlign: "center",
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: 12,
          marginTop: -2,
        }}
      >
        Make sure everything looks right before saving.
      </Text>
    </View>
  );
}
