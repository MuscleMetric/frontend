import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "../../../../lib/useAppTheme";

import { Stepper } from "../shared/components/Stepper";
import { TitleBlock } from "../shared/components/TitleBlock";
import { CardShell } from "../shared/components/CardShell";
import { PrimaryCTA } from "../shared/components/PrimaryCTA";
import { SecondaryCTA } from "../shared/components/SecondaryCTA";

import { stage3Copy } from "./copy";
import { markOnboardingStageComplete, markOnboardingStageDismissed } from "../shared/rpc";

export default function Stage3FiveWorkoutsOnboarding() {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);

  async function onPrimary() {
    try {
      setLoading(true);
      await markOnboardingStageComplete("stage3");
    } catch (e: any) {
      console.warn("stage3 complete mark failed:", e?.message ?? e);
    } finally {
      setLoading(false);
      router.replace("/(tabs)/progress");
    }
  }

  async function onDismiss() {
    try {
      await markOnboardingStageDismissed("stage3");
    } catch (e: any) {
      console.warn("stage3 dismiss mark failed:", e?.message ?? e);
    } finally {
      router.replace("/(tabs)");
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.body}>
        <Stepper label={stage3Copy.stepLabel} progress={1} rightLabel="1/1" />

        <TitleBlock title={stage3Copy.title} subtitle={stage3Copy.subtitle} />

        <CardShell>
          <Text style={styles.cardTitle}>What to look for</Text>
          <Text style={styles.cardSub}>
            Check your volume trend and your most repeated lifts. If a lift shows up often,
            that’s where you’ll see strength progress first.
          </Text>
        </CardShell>
      </View>

      <PrimaryCTA
        title={stage3Copy.primaryCta}
        onPress={onPrimary}
        loading={loading}
        rightIcon={<Text style={styles.arrow}>→</Text>}
      />
      <SecondaryCTA title="Not now" onPress={onDismiss} />
    </View>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg ?? colors.background },
    body: { flex: 1, paddingTop: 6, paddingHorizontal: 16 },
    arrow: { color: "#fff", fontWeight: "900", fontSize: 16, marginTop: -1 },

    cardTitle: { color: colors.text, fontWeight: "900", fontSize: 16 },
    cardSub: {
      marginTop: 8,
      color: colors.textMuted ?? colors.subtle,
      fontWeight: "700",
      lineHeight: 18,
    },
  });
