import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { BaseCard } from "../ui/BaseCard";
import { Pill } from "../ui/Pill";
import { homeTokens } from "../ui/homeTheme";

export function LatestPRCard({ card }: { card: any }) {
  const { colors } = useAppTheme();
  const t = useMemo(() => homeTokens(colors), [colors]);

  const exerciseName = String(card?.exercise_name ?? "Personal record");

  const bestWeight = card?.best_weight == null ? null : Number(card.best_weight);
  const bestReps = card?.best_reps == null ? null : Number(card.best_reps);

  const e1rmLabel = String(card?.display_value ?? "");
  const delta = card?.delta_pct == null ? null : Number(card.delta_pct);
  const achievedAt = card?.achieved_at ? String(card.achieved_at) : null;

  const deltaLabel =
    delta == null ? "New" : delta >= 0 ? `+${delta}%` : `${delta}%`;

  // keep your old colour logic for the pill
  const tone = delta == null ? "blue" : delta >= 0 ? "green" : "red";

  const headline =
    bestWeight != null && bestReps != null
      ? `${trim1(bestWeight)} kg × ${bestReps}`
      : "";

  return (
    <BaseCard>
      <View style={{ gap: 10 }}>
        <View style={styles.row}>
          <Text style={[styles.kicker, { color: t.subtle }]}>Latest PR</Text>
          <Pill label={deltaLabel} tone={tone as any} />
        </View>

        <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
          {exerciseName}
        </Text>

        {/* Big text: the set that created the PR */}
        {headline ? (
          <Text style={[styles.big, { color: t.text }]} numberOfLines={1}>
            {headline}
          </Text>
        ) : null}

        {/* Small text under: e1RM */}
        {!!e1rmLabel && (
          <Text style={[styles.subtle, { color: t.muted }]} numberOfLines={1}>
            {e1rmLabel}
          </Text>
        )}

        {achievedAt ? (
          <Text style={[styles.date, { color: t.muted }]}>
            {new Date(achievedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
        ) : null}
      </View>
    </BaseCard>
  );
}

function trim1(n: number) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : String(r);
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  kicker: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },

  title: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
    lineHeight: 20,
  },

  big: {
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.7,
    lineHeight: 30,
    marginTop: 2,
  },

  subtle: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: -2,
  },

  date: {
    fontSize: 12,
    fontWeight: "700",
  },
});
