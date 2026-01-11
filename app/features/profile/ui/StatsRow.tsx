import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card } from "@/ui";
import type { ProfileOverview } from "../data/profileTypes";

function StatItem({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number;
  onPress?: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flex: 1,
          alignItems: "center",
          paddingVertical: layout.space.md,
        },
        value: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h2,
          lineHeight: typography.lineHeight.h2,
          color: colors.text,
        },
        label: {
          marginTop: 2,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },
      }),
    [colors, typography, layout]
  );

  const content = (
    <View style={styles.wrap}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );

  if (!onPress) return content;

  return <Pressable onPress={onPress}>{content}</Pressable>;
}

export default function StatsRow({ data }: { data: ProfileOverview }) {
  const { colors, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cardInner: {
          paddingHorizontal: layout.space.lg,
          paddingVertical: layout.space.sm,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
        },
        divider: {
          width: StyleSheet.hairlineWidth,
          height: "70%",
          backgroundColor: colors.border,
          opacity: 0.9,
        },
      }),
    [colors, layout]
  );

  return (
    <Card>
      <View style={styles.cardInner}>
        <View style={styles.row}>
          <StatItem
            label="Workouts"
            value={data.counts.workouts_total ?? 0}
            onPress={() => router.push("/features/workouts/history")}
          />
          <View style={styles.divider} />
          <StatItem
            label="Followers"
            value={data.counts.followers_count ?? 0}
            onPress={() => router.push("/(tabs)/social")}
          />
          <View style={styles.divider} />
          <StatItem
            label="Following"
            value={data.counts.following_count ?? 0}
            onPress={() => router.push("/(tabs)/social")}
          />
        </View>
      </View>
    </Card>
  );
}
