import React, { useMemo } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function TodaySetRow({
  title,
  subtitle,
  imageUri,
  rightStatus = "check",
}: {
  title: string;            // "Bench Press"
  subtitle: string;         // "3 sets x 8 reps @ 60kg"
  imageUri?: string;
  rightStatus?: "check" | "none";
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback} />
        )}

        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>

      {rightStatus === "check" ? <View style={styles.checkDot} /> : null}
    </View>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: layout.radius.lg,
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    left: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
      paddingRight: 10,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.06)",
    },
    avatarFallback: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.08)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    title: {
      color: colors.text,
      fontFamily: typography.fontFamily.semibold,
      fontSize: 16,
      letterSpacing: -0.2,
    },
    subtitle: {
      marginTop: 3,
      color: colors.textMuted,
      fontFamily: typography.fontFamily.medium,
      fontSize: 13,
    },
    checkDot: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.success,
    },
  });
