// ui/cards/ExerciseRow.tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

export function ExerciseRow({
  title,
  subtitle,
  meta,
  status = "none",
  onPress,
  rightNode,
}: {
  title: string;
  subtitle?: string;
  meta?: string; // e.g. "3 sets • 8–12 reps" or "Completed: 60×8, 60×8"
  status?: "none" | "active" | "done";
  onPress?: () => void;
  rightNode?: React.ReactNode;
}) {
  const { colors, typography, layout } = useAppTheme();

  const borderColor = status === "active" ? colors.primary : colors.border;

  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: layout.space.md,
        borderRadius: layout.radius.xl,
        borderWidth: 1,
        borderColor,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: layout.space.md }}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: status === "done" ? "transparent" : colors.border,
            backgroundColor: status === "done" ? colors.successBg : "transparent",
          }}
        >
          {status === "done" ? <Icon name={"checkmark" as any} size={16} color={colors.success} /> : null}
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontFamily: typography.fontFamily.semibold }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.regular }} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
          {meta ? (
            <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.medium, fontSize: typography.size.meta }} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>

        {rightNode ? <View>{rightNode}</View> : <Icon name={"chevron-forward" as any} size={18} color={colors.textMuted} />}
      </View>
    </Pressable>
  );
}
