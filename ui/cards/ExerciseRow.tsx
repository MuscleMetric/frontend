import React from "react";
import { Pressable, View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Pill } from "@/ui";

export function ExerciseRow({
  title,
  subtitle,
  meta,
  rightNode,
  onPress,
  index,

  // NEW
  variant = "card", // "card" | "plain"
  isFirst = true,
  isLast = true,
  showDivider = false,
  leftBadge, // for per-row badges e.g. Dropset
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  rightNode?: React.ReactNode;
  onPress?: () => void;
  index?: number;

  variant?: "card" | "plain";
  isFirst?: boolean;
  isLast?: boolean;
  showDivider?: boolean;
  leftBadge?: React.ReactNode;
}) {
  const { colors, typography, layout } = useAppTheme();

  const rowInner = (
    <View
      style={{
        paddingHorizontal: variant === "plain" ? layout.space.md : 0,
        paddingVertical: variant === "plain" ? layout.space.md : 0,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {/* Left number bubble */}
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.trackBg,
            alignItems: "center",
            justifyContent: "center",
            marginRight: layout.space.md,
          }}
        >
          <Text
            style={{
              fontFamily: typography.fontFamily.semibold,
              fontSize: typography.size.sub,
              color: colors.textMuted,
            }}
          >
            {index ?? ""}
          </Text>
        </View>

        {/* Main */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                flexShrink: 1,
                fontFamily: typography.fontFamily.semibold,
                fontSize: typography.size.body,
                color: colors.text,
              }}
              numberOfLines={1}
            >
              {title}
            </Text>

            {/* Optional per-row badge (Dropset) */}
            {leftBadge ? leftBadge : null}
          </View>

          {subtitle ? (
            <Text
              style={{
                marginTop: 2,
                fontFamily: typography.fontFamily.medium,
                fontSize: typography.size.sub,
                color: colors.textMuted,
              }}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}

          {meta ? (
            <Text
              style={{
                marginTop: 2,
                fontFamily: typography.fontFamily.medium,
                fontSize: typography.size.meta,
                color: colors.textMuted,
              }}
              numberOfLines={1}
            >
              {meta}
            </Text>
          ) : null}
        </View>

        {/* Right */}
        {rightNode ? <View style={{ marginLeft: layout.space.md }}>{rightNode}</View> : null}
      </View>

      {/* Divider for plain-group mode */}
      {showDivider ? (
        <View
          style={{
            marginTop: layout.space.md,
            height: 1,
            backgroundColor: colors.border,
            opacity: 0.6,
          }}
        />
      ) : null}
    </View>
  );

  if (variant === "plain") {
    return (
      <Pressable
        onPress={onPress}
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: isFirst ? layout.radius.lg : 0,
          borderTopRightRadius: isFirst ? layout.radius.lg : 0,
          borderBottomLeftRadius: isLast ? layout.radius.lg : 0,
          borderBottomRightRadius: isLast ? layout.radius.lg : 0,
          overflow: "hidden",
        }}
      >
        {rowInner}
      </Pressable>
    );
  }

  // default "card"
  return (
    <Pressable onPress={onPress}>
      <Card>{rowInner}</Card>
    </Pressable>
  );
}
