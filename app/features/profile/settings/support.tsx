// app/features/profile/settings/support.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Button, ListRow, ScreenHeader } from "@/ui";

const SUPPORT_EMAIL = "cunninghamharry09@icloud.com";

export default function SupportScreen() {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles({ colors, typography, layout }), [colors, typography, layout]);

  function mailto(subject: string) {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
    Linking.openURL(url).catch(() => {});
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={styles.safe}>
      <ScreenHeader title="Help & Support" />

      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <Text style={styles.title}>Need help?</Text>
          <Text style={styles.sub}>
            If something feels off, tell us what happened and we’ll fix it.
          </Text>

          <View style={styles.btnRow}>
            <Button title="Contact support" onPress={() => mailto("MuscleMetric support")} />
            <Button
              variant="secondary"
              title="Report a bug"
              onPress={() => mailto("Bug report — MuscleMetric")}
            />
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>Quick links</Text>

          <View style={styles.listGap}>
            <ListRow
              title="FAQ"
              subtitle="Common questions"
              onPress={() => Linking.openURL("https://musclemetric.app/faq").catch(() => {})}
            />
            <ListRow
              title="Feedback"
              subtitle="Suggest improvements"
              onPress={() => Linking.openURL("https://musclemetric.app/feedback").catch(() => {})}
            />
          </View>
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>What to include</Text>
          <Text style={styles.sub}>
            Your device model, what you tapped, and a screenshot (if possible). That’s enough for us to reproduce it.
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
      gap: layout.space.md,
    },

    title: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h3,
      lineHeight: typography.lineHeight.h3,
      color: colors.text,
    },
    sub: {
      marginTop: 6,
      fontFamily: typography.fontFamily.regular,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
    },

    btnRow: { marginTop: layout.space.md, gap: layout.space.sm },

    sectionTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.sub,
      lineHeight: typography.lineHeight.sub,
      color: colors.textMuted,
      marginBottom: layout.space.sm,
    },

    listGap: { gap: layout.space.sm },
  });
}
