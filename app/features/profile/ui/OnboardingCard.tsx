import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, ProgressBar, Pill, Button } from "@/ui";
import type { ProfileOverview } from "../data/profileTypes";

type StepKey = "save_details" | "complete_workout" | "follow_official";

function stepCopy(key: StepKey) {
  switch (key) {
    case "save_details":
      return {
        title: "Save your details",
        desc: "Set your level and primary goal.",
        cta: "Edit profile",
        onPress: () => router.push("/features/profile/EditProfile"),
      };
    case "complete_workout":
      return {
        title: "Complete your first workout",
        desc: "Log a workout to unlock progress tracking.",
        cta: "Find workout",
        onPress: () => router.push("/(tabs)/workout"),
      };
    case "follow_official":
      return {
        title: "Follow MuscleMetric",
        desc: "Get updates and featured challenges.",
        cta: "Open Social",
        onPress: () => router.push("/(tabs)/social"),
      };
    default:
      return {
        title: "Step",
        desc: "",
        cta: "Open",
        onPress: () => {},
      };
  }
}

function statusTone(done: boolean) {
  return done ? "success" : "neutral";
}

export default function OnboardingCard({ data }: { data: ProfileOverview }) {
  const { colors, typography, layout } = useAppTheme();

  const req = data.onboarding?.required;
  if (!req) return null;

  const steps: Array<{
    key: StepKey;
    done: boolean;
  }> = [
    { key: "save_details", done: !!req.has_saved_details },
    { key: "complete_workout", done: !!req.has_completed_workout },
    { key: "follow_official", done: !!req.has_followed_official },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length;
  const pct = Math.round((doneCount / Math.max(1, totalCount)) * 100);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        inner: {
          padding: layout.space.lg,
          gap: layout.space.lg,
        },

        header: { gap: 6 },
        title: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },
        subtitle: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.textMuted,
        },

        progressRow: {
          gap: layout.space.sm,
        },

        stepsWrap: {
          gap: layout.space.md,
        },

        stepCard: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          padding: layout.space.md,
          gap: layout.space.md,
        },

        stepTopRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: layout.space.md,
        },

        stepText: { flex: 1, gap: 4 },

        stepTitle: {
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.text,
        },
        stepDesc: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },

        ctaWrap: {
          // keeps buttons aligned and predictable
        },

        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          opacity: 0.9,
        },
      }),
    [colors, typography, layout]
  );

  return (
    <Card>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>Finish setting up your profile</Text>
          <Text style={styles.subtitle}>
            Complete these steps to personalise your plan.
          </Text>
        </View>

        <View style={styles.progressRow}>
          <ProgressBar valuePct={pct} />
        </View>

        <View style={styles.divider} />

        <View style={styles.stepsWrap}>
          {steps.map((s) => {
            const copy = stepCopy(s.key);
            const label = s.done ? "Done" : "To do";

            return (
              <View key={s.key} style={styles.stepCard}>
                <View style={styles.stepTopRow}>
                  <View style={styles.stepText}>
                    <Text style={styles.stepTitle}>{copy.title}</Text>
                    <Text style={styles.stepDesc}>{copy.desc}</Text>
                  </View>

                  <Pill tone={statusTone(s.done)} label={label} />
                </View>

                {/* CTA below text */}
                {!s.done ? (
                  <View style={styles.ctaWrap}>
                    <Button variant="secondary" title={copy.cta} onPress={copy.onPress} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
}
