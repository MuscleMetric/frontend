// app/onboarding/stage3_five_workouts/components/OnboardingHeader.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

export function OnboardingHeader({
  title,
  subtitle,
  stepLabel, // e.g. "1 of 5"
  onBack,
  rightSlot,
}: {
  title?: string;
  subtitle?: string;
  stepLabel?: string;
  onBack?: (() => void) | null;
  rightSlot?: React.ReactNode;
}) {
  const { colors, typography, layout } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, layout.space.md) }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={layout.hitSlop} style={styles.backBtn}>
              <Icon name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.backBtnPlaceholder} />
          )}
        </View>

        <View style={styles.center}>
          <Text style={styles.brand}>MUSCLEMETRIC</Text>
          {!!stepLabel ? <Text style={styles.step}>{stepLabel}</Text> : null}
        </View>

        <View style={styles.right}>{rightSlot ?? <View style={styles.rightPlaceholder} />}</View>
      </View>

      {!!title ? <Text style={styles.title}>{title}</Text> : null}
      {!!subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: layout.space.lg,
      paddingBottom: layout.space.md,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 44,
    },

    left: { width: 56, alignItems: "flex-start", justifyContent: "center" },
    right: { width: 56, alignItems: "flex-end", justifyContent: "center" },

    backBtn: {
      width: 44,
      height: 44,
      borderRadius: layout.radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    backBtnPlaceholder: { width: 44, height: 44 },

    center: { flex: 1, alignItems: "center", justifyContent: "center" },

    brand: {
      color: colors.primary,
      fontFamily: typography.fontFamily.semibold,
      letterSpacing: 2.4,
      fontSize: typography.size.meta,
      textAlign: "center",
    },
    step: {
      marginTop: 4,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      textAlign: "center",
    },

    rightPlaceholder: { width: 44, height: 44 },

    title: {
      marginTop: layout.space.md,
      color: colors.text,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.hero,
      lineHeight: typography.lineHeight.hero,
      letterSpacing: -1.1,
    },

    sub: {
      marginTop: layout.space.sm,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      maxWidth: 520,
    },
  });
