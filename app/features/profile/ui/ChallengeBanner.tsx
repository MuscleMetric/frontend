import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Target } from "lucide-react-native";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Button, Pill } from "@/ui";

export default function ChallengeBanner() {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          overflow: "hidden",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        accent: {
          height: 4,
          backgroundColor: colors.primary,
        },
        inner: {
          padding: layout.space.lg,
          gap: layout.space.md,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          gap: layout.space.md,
        },
        iconWrap: {
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
        },
        titleWrap: {
          flex: 1,
          gap: 4,
        },
        eyebrow: {
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.primary,
          textTransform: "uppercase",
          letterSpacing: 0.6,
        },
        title: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },
        body: {
          gap: layout.space.sm,
        },
        sub: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
          color: colors.text,
        },
        muted: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.textMuted,
        },
        footer: {
          marginTop: layout.space.xs,
          gap: layout.space.sm,
        },
      }),
    [colors, typography, layout]
  );

  return (
    <Card style={styles.card}>
      <View style={styles.accent} />

      <View style={styles.inner}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Target size={22} color={colors.primary} strokeWidth={2.4} />
          </View>

          <View style={styles.titleWrap}>
            <Text style={styles.eyebrow}>No active plan</Text>
            <Text style={styles.title}>Start your next training block</Text>
          </View>

          <Pill tone="primary" label="New" />
        </View>

        <View style={styles.body}>
          <Text style={styles.sub}>
            Create a focused plan for strength, size, or consistency.
          </Text>

          <Text style={styles.muted}>
            Add workouts from scratch or reuse saved workouts to build it faster.
          </Text>
        </View>

        <View style={styles.footer}>
          <Button
            title="Create plan"
            onPress={() => router.push("/features/plans/create/planInfo")}
          />
        </View>
      </View>
    </Card>
  );
}