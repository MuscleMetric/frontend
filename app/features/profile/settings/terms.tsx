// app/features/profile/settings/terms.tsx
import React, { useMemo } from "react";
import { Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, ScreenHeader } from "@/ui";

export default function TermsScreen() {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles({ colors, typography, layout }), [colors, typography, layout]);

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <ScreenHeader title="Terms & Conditions" />

      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <Text style={styles.h}>Summary</Text>
          <Text style={styles.p}>
            MuscleMetric helps you track training. You’re responsible for your own workouts, load selection, and safety.
          </Text>

          <Text style={styles.h}>Fair use</Text>
          <Text style={styles.p}>
            Don’t abuse the platform, spam other users, or attempt to access data that isn’t yours.
          </Text>

          <Text style={styles.h}>Health disclaimer</Text>
          <Text style={styles.p}>
            This app is not medical advice. If you have any conditions or injuries, consult a professional before training.
          </Text>

          <Text style={styles.h}>Changes</Text>
          <Text style={styles.p}>
            We may update these terms as the product evolves. We’ll keep the tone clear and notify you for major changes.
          </Text>

          <Text style={styles.foot}>
            This is a lightweight in-app summary. When you have your full terms URL, we can render the complete text here.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles({ colors, typography, layout }: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    container: {
      padding: layout.space.lg,
      paddingBottom: layout.space.xxl,
    },
    h: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.text,
      marginBottom: 6,
      marginTop: layout.space.md,
    },
    p: {
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },
    foot: {
      marginTop: layout.space.lg,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.meta,
      lineHeight: typography.lineHeight.meta,
      color: colors.textMuted,
    },
  });
}
