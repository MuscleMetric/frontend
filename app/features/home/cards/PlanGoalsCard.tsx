import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { BaseCard } from "../ui/BaseCard";
import { ProgressBar } from "../ui/ProgressBar";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { homeTokens } from "../ui/homeTheme";

type GoalItem = {
  id: string;
  title: string;
  progress_pct: number;
};

export function PlanGoalsCard({ card }: { card: any }) {
  const { colors } = useAppTheme();
  const t = useMemo(() => homeTokens(colors), [colors]);

  const items: GoalItem[] = Array.isArray(card?.items) ? card.items : [];

  return (
    <BaseCard>
      <View style={{ gap: 14 }}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: t.text }]}>
            Plan goals
          </Text>

          <Pressable
            onPress={() => router.push("/features/goals/goals")}
            hitSlop={10}
            style={({ pressed }) => [pressed ? { opacity: 0.7 } : null]}
          >
            <Text style={[styles.viewAll, { color: "#22c55e" }]}>View all</Text>
          </Pressable>
        </View>

        <View style={[styles.divider, { backgroundColor: t.trackBorder }]} />

        {items.length === 0 ? (
          <Text style={[styles.empty, { color: t.subtle }]}>
            No active goals yet.
          </Text>
        ) : (
          <View style={{ gap: 18 }}>
            {items.map((it) => {
              const pct = Math.round(Number(it.progress_pct ?? 0));

              // Fallbacks so this works even before backend adds labels

              return (
                <View key={it.id} style={{ gap: 10 }}>
                  <View style={styles.rowTop}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text
                        style={[styles.title, { color: t.text }]}
                        numberOfLines={1}
                      >
                        {it.title}
                      </Text>
                    </View>

                    {/* Right side: current value + (pct) */}
                    <View style={styles.rightMeta}>
                      <Text
                        style={[styles.pct, { color: "#22c55e" }]}
                      >{`${pct}%`}</Text>
                    </View>
                  </View>

                  <ProgressBar valuePct={Number(it.progress_pct ?? 0)} />
                </View>
              );
            })}
          </View>
        )}
      </View>
    </BaseCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  viewAll: { fontSize: 14, fontWeight: "900" },

  divider: { height: StyleSheet.hairlineWidth, width: "100%", opacity: 0.9 },
  empty: { fontSize: 13, fontWeight: "700" },

  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  title: { fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },
  target: { fontSize: 12, fontWeight: "700" },

  rightMeta: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    maxWidth: 160,
  },
  current: { fontSize: 16, fontWeight: "900" },
  pct: { fontSize: 14, fontWeight: "900" },
});
