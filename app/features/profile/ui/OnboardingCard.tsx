import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, ProgressBar, Button, Pill } from "@/ui";
import type { ProfileOverview } from "../data/profileTypes";

function Row({
  done,
  title,
  subtitle,
  ctaText,
  onPress,
}: {
  done: boolean;
  title: string;
  subtitle: string;
  ctaText: string;
  onPress: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          paddingVertical: layout.space.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        top: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: layout.space.md,
        },
        title: {
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.text,
        },
        subtitle: {
          marginTop: 2,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },
        right: {
          alignItems: "flex-end",
          gap: layout.space.xs,
        },
      }),
    [colors, typography, layout]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.right}>
          <Pill tone={done ? "success" : "neutral"} label={done ? "Done" : "To do"} />
          {!done ? (
            <Button variant="secondary" title={ctaText} onPress={onPress} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function OnboardingCard({ data }: { data: ProfileOverview }) {
  const { colors, typography, layout } = useAppTheme();

  // Only show when onboarding isn't done (3/3)
  if ((data.onboarding?.done_count ?? 0) >= 3) return null;

  const s = data.onboarding.required;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        inner: {
          padding: layout.space.lg,
        },
        title: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },
        sub: {
          marginTop: 4,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.textMuted,
        },
        barWrap: {
          marginTop: layout.space.md,
        },
        rowsWrap: {
          marginTop: layout.space.md,
        },
      }),
    [colors, typography, layout]
  );

  return (
    <Card>
      <View style={styles.inner}>
        <Text style={styles.title}>Finish setting up your profile</Text>
        <Text style={styles.sub}>Complete these steps to personalise your plan.</Text>

        <View style={styles.barWrap}>
          <ProgressBar valuePct={data.onboarding.progress_pct ?? 0} />
        </View>

        <View style={styles.rowsWrap}>
          <Row
            done={!!s.has_saved_details}
            title="Save your details"
            subtitle="Set your level and primary goal."
            ctaText="Continue"
            onPress={() => router.push("/(auth)/onboarding")}
          />
          <Row
            done={!!s.has_completed_workout}
            title="Complete your first workout"
            subtitle="Log a workout to unlock progress tracking."
            ctaText="Find workout"
            onPress={() => router.push("/(tabs)/workout")}
          />
          <Row
            done={!!s.has_followed_official}
            title="Follow MuscleMetric"
            subtitle="Get updates and featured challenges."
            ctaText="Open Social"
            onPress={() => router.push("/(tabs)/social")}
          />
        </View>
      </View>
    </Card>
  );
}
