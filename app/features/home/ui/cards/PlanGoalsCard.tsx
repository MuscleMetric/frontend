// app/features/home/cards/PlanGoalsCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { Card, ProgressBar } from "@/ui";

type GoalItem = {
  id: string;
  title: string;
  progress_pct: number;
};

export function PlanGoalsCard({ card, summary }: { card: any; summary?: any }) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const items: GoalItem[] = Array.isArray(card?.items) ? card.items : [];

  return (
    <Card style={styles.card}>
      <View style={{ gap: layout.space.md }}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Plan goals</Text>

          <Pressable
            onPress={() => router.push("/features/goals/goals")}
            hitSlop={10}
            style={({ pressed }) => [pressed ? { opacity: 0.7 } : null]}
          >
            <Text style={styles.viewAll}>View all</Text>
          </Pressable>
        </View>

        <View style={styles.divider} />

        {items.length === 0 ? (
          <Text style={styles.empty}>No active goals yet.</Text>
        ) : (
          <View style={{ gap: layout.space.lg }}>
            {items.map((it) => {
              const pct = Math.max(0, Math.min(100, Math.round(Number(it.progress_pct ?? 0))));

              return (
                <View key={it.id} style={{ gap: layout.space.sm }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.title} numberOfLines={1}>
                      {it.title}
                    </Text>

                    <Text style={styles.pct} numberOfLines={1}>
                      {pct}%
                    </Text>
                  </View>

                  <ProgressBar valuePct={pct} tone="success" />
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Card>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    card: {
      padding: layout.space.lg,
      borderRadius: layout.radius.xl,
    },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: layout.space.md,
    },

    headerTitle: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2,
      color: colors.text,
      letterSpacing: -0.3,
    },

    viewAll: {
      fontFamily: typography.fontFamily.semibold,
      fontSize: typography.size.sub,
      color: colors.primary, 
    },

    divider: {
      height: StyleSheet.hairlineWidth,
      width: "100%",
      opacity: 0.9,
      backgroundColor: colors.trackBorder,
    },

    empty: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.sub,
      color: colors.textMuted,
    },

    rowTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: layout.space.md,
    },

    title: {
      flex: 1,
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      color: colors.text,
      letterSpacing: -0.2,
    },

    pct: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.sub,
      color: colors.success,
    },
  });
