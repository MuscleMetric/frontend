// app/features/home/cards/WeeklyGoalCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { BaseCard } from "../ui/BaseCard";
import { homeTokens } from "../ui/homeTheme";

export function WeeklyGoalCard({ card }: { card: any }) {
  const { colors } = useAppTheme();
  const t = useMemo(() => homeTokens(colors), [colors]);

  const value = Number(card?.value ?? 0);
  const target = Number(card?.target ?? 0);
  const status = (card?.status ?? "behind") as
    | "on_track"
    | "behind"
    | "complete";

  const pct =
    target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;

  const tone =
    status === "complete"
      ? "complete"
      : status === "on_track"
      ? "on_track"
      : "behind";

  const toneCfg = t.statusTone[tone];

  // subtle icon badge colours (non-negative UI)
  const iconBg = toneCfg.iconBg ?? t.trackBg; // add iconBg to tokens later if you want
  const iconBd = toneCfg.iconBd ?? t.trackBorder;
  const iconTx = toneCfg.iconTx ?? t.text;

  return (
    <BaseCard>
      <View style={{ gap: 14 }}>
        {/* Header row */}
        <View style={styles.topRow}>
          <Text style={[styles.kicker, { color: t.subtle }]}>WEEKLY</Text>

          <View
            style={[
              styles.iconBadge,
              { backgroundColor: iconBg, borderColor: iconBd },
            ]}
          >
            <Text style={[styles.iconText, { color: iconTx }]}>📅</Text>
          </View>
        </View>

        {/* Big value */}
        <View style={styles.bigRow}>
          <Text style={[styles.big, { color: t.text }]}>{value}</Text>
          <Text style={[styles.of, { color: t.subtle }]}>/ {target || "—"}</Text>
        </View>

        <Text style={[styles.caption, { color: t.muted }]}>Workouts done</Text>

        {/* Progress bar */}
        <View
          style={[
            styles.track,
            { backgroundColor: t.trackBg, borderColor: t.trackBorder },
          ]}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${pct}%`,
                backgroundColor: toneCfg.fill,
              },
            ]}
          />
        </View>

        {/* Hint */}
        <Text style={[styles.hint, { color: t.muted }]}>
          {target > 0 ? `${pct}% of your goal` : "Set a weekly goal to track progress"}
        </Text>
      </View>
    </BaseCard>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  kicker: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },

  iconText: {
    fontSize: 16,
    marginTop: 1,
  },

  bigRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },

  big: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
    lineHeight: 38,
  },

  of: {
    fontSize: 14,
    fontWeight: "800",
    paddingBottom: 6,
  },

  caption: {
    marginTop: -6,
    fontSize: 12,
    fontWeight: "800",
  },

  track: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },

  fill: {
    height: "100%",
    borderRadius: 999,
  },

  hint: {
    fontSize: 10,
    fontWeight: "700",
  },
});
