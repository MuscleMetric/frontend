// app/onboarding/stage3_five_workouts/components/StageFooterCTA.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import { PrimaryCTA } from "../../shared/components/PrimaryCTA";

export function StageFooterCTA({
  primaryTitle,
  onPrimary,
  loading,
  secondaryTitle,
  onSecondary,
  helperText,
  topSlot,
}: {
  primaryTitle: string;
  onPrimary: () => void;
  loading?: boolean;

  secondaryTitle?: string;
  onSecondary?: (() => void) | null;

  helperText?: string;
  topSlot?: React.ReactNode; // e.g. pagination dots
}) {
  const { colors, typography, layout } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => makeStyles(colors, typography, layout),
    [colors, typography, layout]
  );

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, layout.space.md) },
      ]}
    >
      {!!topSlot ? <View style={styles.topSlot}>{topSlot}</View> : null}

      <PrimaryCTA title={primaryTitle} onPress={onPrimary} loading={!!loading} />

      {!!secondaryTitle && !!onSecondary ? (
        <Pressable onPress={onSecondary} hitSlop={layout.hitSlop} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>{secondaryTitle}</Text>
        </Pressable>
      ) : null}

      {!!helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    wrap: {
      paddingTop: layout.space.md,
      paddingHorizontal: layout.space.lg,
      backgroundColor: colors.bg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    topSlot: {
      alignItems: "center",
      marginBottom: layout.space.md,
    },
    secondaryBtn: {
      marginTop: layout.space.md,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: layout.space.sm,
    },
    secondaryText: {
      color: colors.textMuted,
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.sub,
    },
    helper: {
      marginTop: layout.space.sm,
      textAlign: "center",
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
    },
  });
