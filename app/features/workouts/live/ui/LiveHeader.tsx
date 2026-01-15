import React from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function LiveHeader(props: {
  title: string;
  subtitle: string;
  timerText: string; // "00:45"
  onClose: () => void; // X -> confirm discard
  onMore?: () => void; // optional
}) {
  const { colors, typography } = useAppTheme();
    const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.bg,
      }}
    >
      {/* Left: X */}
      <View style={{ width: 54, alignItems: "flex-start" }}>
        <Pressable onPress={props.onClose} hitSlop={10}>
          <Text
            style={{
              color: colors.danger ?? "#ef4444",
              fontSize: 28,
              fontFamily: typography.fontFamily.bold,
              lineHeight: 28,
            }}
          >
            ×
          </Text>
        </Pressable>
      </View>

      {/* Center: Title + Subtitle */}
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text
          style={{
            fontFamily: typography.fontFamily.bold,
            fontSize: typography.size.h2,
            color: colors.text,
            letterSpacing: -0.3,
          }}
          numberOfLines={1}
        >
          {props.title}
        </Text>
        <Text
          style={{
            fontFamily: typography.fontFamily.regular,
            fontSize: typography.size.sub,
            color: colors.textMuted,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {props.subtitle}
        </Text>
      </View>

      {/* Right: Timer (and optional ⋯) */}
      <View style={{ width: 84, alignItems: "flex-end" }}>
        <Text
          style={{
            fontFamily: typography.fontFamily.bold,
            fontSize: 28,
            color: colors.text,
            letterSpacing: -0.4,
          }}
          numberOfLines={1}
        >
          {props.timerText}
        </Text>

        {!!props.onMore && (
          <Pressable
            onPress={props.onMore}
            hitSlop={10}
            style={{ marginTop: 2 }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 18,
                fontWeight: "900",
              }}
            >
              ⋯
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
