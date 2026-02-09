import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { PrimaryCTA } from "../components/PrimaryCTA";

export function ReadyStep({
  onStart,
}: {
  onStart: () => void;
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.page}>
      <View style={styles.center}>
        <Text style={styles.brand}>MuscleMetric</Text>

        <View style={styles.circleOuter}>
          <View style={styles.circleInner}>
            <Text style={styles.check}>✓</Text>
          </View>
        </View>

        <Text style={styles.title}>You’re ready</Text>
        <Text style={styles.sub}>
          We’ll remember your sets so logging gets faster every session.
        </Text>

        <View style={styles.syncCard}>
          <View style={styles.syncIcon}>
            <Text style={styles.syncBolt}>⚡</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.syncTitle}>Profile Synchronized</Text>
            <Text style={styles.syncSub}>Your preferences are saved</Text>
          </View>
        </View>
      </View>

      <PrimaryCTA title="Start your first workout" onPress={onStart} />
    </View>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    brand: {
      position: "absolute",
      top: 72,
      color: colors.text,
      fontWeight: "900",
      fontSize: 16,
      letterSpacing: 0.2,
      opacity: 0.95,
    },
    circleOuter: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: "rgba(59,130,246,0.10)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(59,130,246,0.20)",
    },
    circleInner: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    check: { color: "#fff", fontSize: 22, fontWeight: "900" },
    title: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: -0.6,
      marginTop: 6,
    },
    sub: {
      color: colors.subtle,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: 20,
      marginTop: 10,
      maxWidth: 280,
    },
    syncCard: {
      marginTop: 28,
      width: "100%",
      borderRadius: 18,
      padding: 14,
      backgroundColor: "rgba(255,255,255,0.05)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    syncIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(59,130,246,0.12)",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(59,130,246,0.25)",
    },
    syncBolt: { color: colors.primary, fontSize: 18 },
    syncTitle: { color: colors.text, fontWeight: "900" },
    syncSub: { color: colors.subtle, fontWeight: "700", marginTop: 2 },
  });
