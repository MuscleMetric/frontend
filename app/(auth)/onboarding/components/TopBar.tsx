import React, { useMemo } from "react";
import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";

export function TopBar({
  title = "MuscleMetric",
  stepLabel,
  rightLabel,
  progress,
  onBack,
  icon,
}: {
  title?: string;
  stepLabel?: string;    // e.g. "STEP 1 OF 4"
  rightLabel?: string;   // e.g. "75% Complete" / "100%"
  progress?: number;     // 0..1
  onBack?: () => void;
  icon?: React.ReactNode; // optional brand icon at left of title
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={onBack}
          disabled={!onBack}
          hitSlop={10}
          style={[styles.backBtn, !onBack && { opacity: 0 }]}
        >
          <Text style={styles.backIcon}>‹</Text>
        </Pressable>

        <View style={styles.brandRow}>
          {icon ? <View style={styles.brandIcon}>{icon}</View> : null}
          <Text style={styles.brand}>{title}</Text>
        </View>

        <View style={{ width: 32 }} />
      </View>

      {(stepLabel || rightLabel) && typeof progress === "number" ? (
        <View style={styles.stepWrap}>
          <View style={styles.stepRow}>
            <Text style={styles.stepLabel}>{stepLabel ?? ""}</Text>
            <Text style={styles.rightLabel}>{rightLabel ?? ""}</Text>
          </View>

          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    wrap: {
      paddingTop: Platform.OS === "ios" ? 56 : 18,
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: colors.background,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.04)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    backIcon: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      marginTop: -2,
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    brandIcon: {
      width: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.95,
    },
    brand: {
      color: colors.text,
      fontWeight: "900",
      letterSpacing: 0.2,
      fontSize: 15,
    },
    stepWrap: {
      marginTop: 10,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    stepLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    rightLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "800",
    },
    track: {
      height: 4,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.08)",
      overflow: "hidden",
    },
    fill: {
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
  });
