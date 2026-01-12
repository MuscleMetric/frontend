// app/features/profile/settings/privacy.tsx
import React, { useMemo } from "react";
import { Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, ScreenHeader } from "@/ui";

export default function PrivacyPolicyScreen() {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles({ colors, typography, layout }), [colors, typography, layout]);

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <ScreenHeader title="Privacy Policy" />

      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <Text style={styles.h}>Summary</Text>
          <Text style={styles.p}>
            MuscleMetric stores your profile and workout data to power your training history, progress, and goals.
            We don’t sell your personal data.
          </Text>

          <Text style={styles.h}>What we store</Text>
          <Text style={styles.p}>
            • Profile details (name, training preferences){"\n"}
            • Workout history (sessions, sets, reps, weights){"\n"}
            • Activity metrics (streaks, achievements){"\n"}
            • Device tokens (only for notifications, if enabled)
          </Text>

          <Text style={styles.h}>Control</Text>
          <Text style={styles.p}>
            You can change your profile details anytime. If you want your account deleted, contact support and we’ll handle it.
          </Text>

          <Text style={styles.foot}>
            This is a lightweight in-app summary. If you have a full policy URL later, we can swap this screen to render it.
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
