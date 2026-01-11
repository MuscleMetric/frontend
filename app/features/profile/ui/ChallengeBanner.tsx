import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Button, Pill } from "@/ui";

export default function ChallengeBanner() {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        inner: {
          padding: layout.space.lg,
          gap: layout.space.md,
        },
        title: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },
        sub: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.textMuted,
        },
        topRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: layout.space.md,
        },
      }),
    [colors, typography, layout]
  );

  return (
    <Card variant="primary">
      <View style={styles.inner}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Ready for a new challenge?</Text>
          <Pill tone="primary" label="No active plan" />
        </View>

        <Text style={styles.sub}>
          You have no active plan. Browse our library to find your next goal.
        </Text>

        <Button
          title="Discover plans"
          onPress={() => router.push("/features/plans")}
        />
      </View>
    </Card>
  );
}
