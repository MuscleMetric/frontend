// app/features/workouts/live/review/ui/ValidationCard.tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { ReviewIssue } from "../reviewTypes";

export function ValidationCard(props: {
  issues: ReviewIssue[];
  onPressReview?: () => void;
}) {
  const { colors, typography } = useAppTheme();
  const count = props.issues.length;

  if (count === 0) return null;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: "#F2D48C",
        backgroundColor: "#FFF6DC",
        borderRadius: 16,
        padding: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#FFE9B3",
          }}
        >
          <Text style={{ fontSize: 16 }}>⚠️</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: "#4E3A00", fontFamily: typography.fontFamily.bold, fontSize: 14 }}>
            Validation Issues
          </Text>
          <Text style={{ color: "#6A5200", fontFamily: typography.fontFamily.medium, fontSize: 12, marginTop: 2 }}>
            {count} thing{count === 1 ? "" : "s"} to review before saving.
          </Text>
        </View>

        {props.onPressReview ? (
          <Pressable onPress={props.onPressReview} hitSlop={10}>
            <Text style={{ color: colors.primary, fontFamily: typography.fontFamily.bold, fontSize: 12 }}>
              Review
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ marginTop: 10, gap: 6 }}>
        {props.issues.slice(0, 3).map((i) => (
          <View key={i.key} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <Text style={{ color: "#6A5200", marginTop: 1 }}>•</Text>
            <Text style={{ flex: 1, color: "#6A5200", fontFamily: typography.fontFamily.medium, fontSize: 12 }}>
              {i.detail}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
