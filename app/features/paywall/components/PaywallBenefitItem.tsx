import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LucideIcon } from "lucide-react-native";
import { useAppTheme } from "@/lib/useAppTheme";

type PaywallBenefitItemProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  compact?: boolean;
};

export default function PaywallBenefitItem({
  icon: Icon,
  title,
  description,
  compact = false,
}: PaywallBenefitItemProps) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: layout.radius.xl,
          padding: layout.space.lg,
        },
        compact && styles.compactCard,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            borderRadius: layout.radius.md,
            backgroundColor: colors.cardPressed, // subtle tinted background
          },
        ]}
      >
        <Icon size={18} color={colors.primary} />
      </View>

      <View style={styles.textWrap}>
        <Text
          style={[
            styles.title,
            {
              color: colors.text,
              fontSize: typography.size.h3,
              lineHeight: typography.lineHeight.h3,
              fontFamily: typography.fontFamily.bold,
            },
          ]}
        >
          {title}
        </Text>

        {!!description && (
          <Text
            style={[
              styles.description,
              {
                color: colors.textMuted,
                fontSize: typography.size.sub,
                lineHeight: typography.lineHeight.sub,
                fontFamily: typography.fontFamily.medium,
              },
            ]}
          >
            {description}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  compactCard: {
    minHeight: 112,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
  },
  title: {},
  description: {
    marginTop: 6,
  },
});