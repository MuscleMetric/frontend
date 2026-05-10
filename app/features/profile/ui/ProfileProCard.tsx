// app/features/profile/ui/ProfileProCard.tsx

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Crown, ChevronRight } from "lucide-react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { getTheme } from "@/ui/tokens/theme";

type Props = {
  onPress: () => void;
};

export default function ProfileProCard({ onPress }: Props) {
  const { scheme, typography, layout } = useAppTheme();

  const contrastTheme = getTheme(scheme === "dark" ? "light" : "dark");
  const { colors } = contrastTheme;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderRadius: layout.radius.xl,
          padding: layout.space.lg,
          borderWidth: 1,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.header, { gap: layout.space.md }]}>
        <View
          style={[
            styles.iconWrap,
            {
              width: 42,
              height: 42,
              borderRadius: layout.radius.md,
              backgroundColor: colors.cardPressed,
            },
          ]}
        >
          <Crown size={19} color={colors.primary} />
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
            Upgrade to MuscleMetric Pro
          </Text>

          <Text
            style={[
              styles.subtitle,
              {
                color: colors.textMuted,
                fontSize: typography.size.sub,
                lineHeight: typography.lineHeight.sub,
                fontFamily: typography.fontFamily.medium,
                marginTop: 4,
              },
            ]}
          >
            Unlock deeper analytics, more plans, extra goals, and advanced
            progress insights.
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.button,
          {
            minHeight: 52,
            borderRadius: layout.radius.lg,
            backgroundColor: colors.primary,
            marginTop: layout.space.lg,
          },
        ]}
      >
        <Text
          style={[
            styles.buttonText,
            {
              color: colors.onPrimary,
              fontSize: typography.size.body,
              lineHeight: typography.lineHeight.body,
              fontFamily: typography.fontFamily.bold,
            },
          ]}
        >
          See Pro Features
        </Text>

        <ChevronRight size={18} color={colors.onPrimary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {},
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  textWrap: {
    flex: 1,
  },
  title: {},
  subtitle: {},
  button: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonText: {},
});