import React from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Minimize2 } from "lucide-react-native";

export function LiveHeader(props: {
  title: string;
  subtitle: string;
  timerText: string;
  onMinimize: () => void;
  onMore?: () => void;
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
      {/* Left: Minimise */}
      <View style={{ width: 84, alignItems: "flex-start" }}>
        <Pressable
          testID="live-header-minimize"
          onPress={props.onMinimize}
          hitSlop={10}
        >
          <Minimize2 size={20} color={colors.text} />
        </Pressable>
      </View>

      {/* Center: Title + Subtitle */}
      <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 8 }}>
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

      {/* Right: Timer + More */}
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
            testID="live-header-more"
            onPress={props.onMore}
            hitSlop={10}
            style={{ marginTop: 2, paddingHorizontal: 4, paddingVertical: 2 }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 18,
                fontFamily: typography.fontFamily.bold,
                lineHeight: 18,
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
