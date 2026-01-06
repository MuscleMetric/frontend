import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BaseCard } from "../ui/BaseCard";
import { ProgressBar } from "../ui/ProgressBar";

export function PlanGoalsCard({ card }: { card: any }) {
  const items: Array<{ id: string; title: string; progress_pct: number }> =
    Array.isArray(card?.items) ? card.items : [];

  return (
    <BaseCard>
      <View style={{ gap: 14 }}>
        <Text style={styles.kicker}>Plan goals</Text>

        {items.length === 0 ? (
          <Text style={styles.empty}>No active goals yet.</Text>
        ) : (
          items.map((it) => (
            <View key={it.id} style={{ gap: 8 }}>
              <View style={styles.row}>
                <Text style={styles.title} numberOfLines={1}>
                  {it.title}
                </Text>
                <Text style={styles.pct}>{Math.round(it.progress_pct)}%</Text>
              </View>
              <ProgressBar valuePct={Number(it.progress_pct ?? 0)} />
            </View>
          ))
        )}
      </View>
    </BaseCard>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.60)",
    textTransform: "uppercase",
  },
  empty: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.60)",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
    color: "rgba(255,255,255,0.92)",
    marginRight: 10,
  },
  pct: {
    fontSize: 12,
    fontWeight: "900",
    color: "rgba(255,255,255,0.70)",
  },
});
