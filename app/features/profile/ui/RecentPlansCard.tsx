import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, ListRow, Pill, Button } from "@/ui";
import type { ProfileOverview } from "../data/profileTypes";

function fmtShortDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export default function RecentPlansCard({ data }: { data: ProfileOverview }) {
  const { colors, typography, layout } = useAppTheme();
  const plans = data.recent_plans ?? [];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: layout.space.sm,
        },
        title: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },
        listGap: { gap: layout.space.sm },
        emptyText: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.textMuted,
        },
        footer: { marginTop: layout.space.md },
      }),
    [colors, typography, layout]
  );

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Recent Plans</Text>
        {plans.length > 0 ? <Pill tone="neutral" label="View all" /> : null}
      </View>

      {plans.length === 0 ? (
        <>
          <Text style={styles.emptyText}>
            No plans yet. Start one to get structure and keep your progress moving.
          </Text>
          <View style={styles.footer}>
            <Button title="Discover plans" onPress={() => router.push("/features/plans")} />
          </View>
        </>
      ) : (
        <>
          <View style={styles.listGap}>
            {plans.slice(0, 3).map((p) => {
              const status = p.is_completed ? "Completed" : "Active";
              const when = p.is_completed
                ? `Completed · ${fmtShortDate(p.completed_at)}`
                : `Active · Ends ${fmtShortDate(p.end_date)}`;

              return (
                <ListRow
                  key={p.id}
                  title={p.title ?? "Plan"}
                  subtitle={when}
                  rightText={status}
                  onPress={() =>
                    router.push({
                      pathname: "/features/plans/history/view",
                      params: { planId: p.id },
                    })
                  }
                />
              );
            })}
          </View>

          <View style={styles.footer}>
            <Button
              variant="secondary"
              title="View all plans"
              onPress={() => router.push("/features/plans/history")}
            />
          </View>
        </>
      )}
    </Card>
  );
}
