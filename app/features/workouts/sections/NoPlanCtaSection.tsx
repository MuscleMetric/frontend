import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui";

type Props = {
  workoutsTotal: number; // required now
  onPress: () => void;
};

export function NoPlanCtaSection({ workoutsTotal, onPress }: Props) {
  const { colors, layout, typography } = useAppTheme();

  const isConsistent = workoutsTotal > 5;

  const copy = useMemo(() => {
    if (isConsistent) {
      return {
        title: "Time to Level Up?",
        body: "You’ve been consistent. Unlock structured progression plans.",
        cta: "Explore Plans",
        icon: "trending-up" as const,
      };
    }

    return {
      title: "Build Your First Plan",
      body: "Create a simple weekly structure so you stay consistent and progress faster.",
      cta: "Create a Plan",
      icon: "sparkles" as const,
    };
  }, [isConsistent]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          padding: layout.space.lg,
          flexDirection: "row",
          alignItems: "center",
          gap: layout.space.md,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {/* Icon chip */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: (colors as any).primaryMuted ?? colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Icon name={copy.icon} size={20} color={colors.primary} />
      </View>

      {/* Text */}
      <View style={{ flex: 1, gap: 6 }}>
        <Text
          style={{
            fontFamily: typography.fontFamily.bold,
            fontSize: 16,
            color: colors.text,
            letterSpacing: -0.2,
          }}
          numberOfLines={1}
        >
          {copy.title}
        </Text>

        <Text
          style={{
            fontFamily: typography.fontFamily.regular,
            fontSize: 13,
            lineHeight: 18,
            color: colors.textMuted,
          }}
          numberOfLines={4}
        >
          {copy.body}
        </Text>
      </View>

      {/* CTA pill */}
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: typography.fontFamily.semibold,
            fontSize: 13,
            color: (colors as any).onPrimary ?? "#fff",
          }}
          numberOfLines={1}
        >
          {copy.cta}
        </Text>
      </View>
    </Pressable>
  );
}
