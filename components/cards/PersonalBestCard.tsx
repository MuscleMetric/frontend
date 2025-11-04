// components/home/PersonalBestCardContent.tsx
import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";

type PR = {
  exercise_name: string;
  weight: number;
  reps: number;
  prev_weight?: number | null;
  pct_increase?: number | null;
} | null;

export function PersonalBestCardContent({
  colors,
  loading,
  pr,
}: {
  colors: any;
  loading: boolean;
  pr: PR;
}) {
  const s = styles(colors);

  // derive % increase if not provided by the view
  const pctInc =
    pr?.pct_increase != null
      ? Number(pr.pct_increase)
      : pr?.prev_weight && pr.prev_weight > 0
      ? ((Number(pr.weight) - Number(pr.prev_weight)) / Number(pr.prev_weight)) *
        100
      : null;

  const incLabel =
    pctInc == null ? "First record" : `${pctInc >= 0 ? "+" : ""}${pctInc.toFixed(1)}%`;

  const incStyle =
    pctInc == null
      ? s.badgeNeutral
      : pctInc >= 0
      ? s.badgeUp
      : s.badgeDown;

  return (
    <View style={{ width: "100%" }}>
      <Text style={s.title}>PERSONAL BEST</Text>

      {loading ? (
        <ActivityIndicator />
      ) : pr ? (
        <View style={s.block}>
          <Text
            style={s.big}
            numberOfLines={2}
            ellipsizeMode="tail"
            allowFontScaling={false}
          >
            New PR: {pr.exercise_name}
          </Text>

          <View style={s.row}>
            <Text style={s.value}>
              {Number(pr.weight).toFixed(1)} kg × {pr.reps}
            </Text>
            <Text style={[s.badge, incStyle]}>{incLabel}</Text>
          </View>

          {pr?.prev_weight != null && pr.prev_weight > 0 && (
            <Text style={s.subtle}>
              Prev best: {Number(pr.prev_weight).toFixed(1)} kg
            </Text>
          )}
        </View>
      ) : (
        <Text style={s.subtle}>Hit a heavy set to register a PR.</Text>
      )}
    </View>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    title: {
      color: colors.subtle,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0.5,
      marginBottom: 10,
      textTransform: "uppercase",
    },
    block: { minWidth: 0, gap: 4 },
    big: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 22,
    },
    row: {
      marginTop: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    value: { color: colors.text, fontWeight: "800" },
    subtle: { color: colors.subtle, fontSize: 12 },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      fontWeight: "800",
      overflow: "hidden",
    },
    badgeUp: {
      color: colors.successText,
      backgroundColor: (colors.successBg ?? "#16a34a22"),
    },
    badgeDown: {
      color: colors.warnText,
      backgroundColor: (colors.warnBg ?? "#f59e0b22"),
    },
    badgeNeutral: { color: colors.subtle, backgroundColor: "#ffffff11" },
  });
