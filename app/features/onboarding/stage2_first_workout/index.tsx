import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "../../../../lib/useAppTheme";

import { Stepper } from "../shared/components/Stepper";
import { TitleBlock } from "../shared/components/TitleBlock";
import { CardShell } from "../shared/components/CardShell";
import { PrimaryCTA } from "../shared/components/PrimaryCTA";

import { stage2Copy } from "./copy";
import { markOnboardingStageComplete } from "../shared/rpc";

export default function Stage2FirstWorkoutOnboarding() {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);

  async function onPrimary() {
    try {
      setLoading(true);
      await markOnboardingStageComplete("stage2");
    } catch (e: any) {
      // don’t block the user; still route
      console.warn("stage2 complete mark failed:", e?.message ?? e);
    } finally {
      setLoading(false);
      router.replace("/(tabs)/workout");
    }
  }

  return (
    <View style={styles.page}>
      <View style={styles.body}>
        <Stepper label={stage2Copy.stepLabel} progress={1} rightLabel="1/1" />

        <TitleBlock title={stage2Copy.title} subtitle={stage2Copy.subtitle} />

        <CardShell>
          <Text style={styles.cardTitle}>Quick tip</Text>
          <Text style={styles.cardSub}>
            Keep your next session simple: repeat the same workout and aim to add one rep
            on a couple of sets. Consistency beats complexity.
          </Text>
        </CardShell>
      </View>

      <PrimaryCTA
        title={stage2Copy.primaryCta}
        onPress={onPrimary}
        loading={loading}
        rightIcon={<Text style={styles.arrow}>→</Text>}
      />
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
