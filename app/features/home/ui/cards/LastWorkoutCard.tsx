// app/features/home/cards/LastWorkoutCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../../lib/useAppTheme";
import { Card } from "@/ui";

function fmtDuration(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function LastWorkoutCard({ card, summary }: { card: any; summary?: any }) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [colors, typography, layout]);

  const title = String(card?.title ?? "Last workout");
  const completedAt = card?.completed_at ? String(card.completed_at) : null;

  const duration = card?.duration_seconds == null ? null : Number(card.duration_seconds);
  const sets = card?.sets_completed == null ? null : Number(card.sets_completed);

  const metaParts = useMemo(() => {
    const parts: string[] = [];
    const dur = fmtDuration(duration);
    if (dur) parts.push(dur);
    if (sets != null) parts.push(`${sets} sets`);
    return parts;
  }, [duration, sets]);

  return (
    <Card style={styles.card}>
      <View style={{ gap: layout.space.md }}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Last session</Text>
        </View>

        <View style={styles.divider} />

        {/* Content */}
        <View style={{ gap: layout.space.xs }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          <Text style={styles.meta} numberOfLines={2}>
            {fmtDate(completedAt)}
            {metaParts.length ? ` · ${metaParts.join(" · ")}` : ""}
          </Text>
        </View>
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

    divider: {
      height: StyleSheet.hairlineWidth,
      width: "100%",
      opacity: 0.9,
      backgroundColor: colors.trackBorder,
    },

    title: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.body,
      color: colors.text,
      letterSpacing: -0.2,
    },

    meta: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.meta,
      color: colors.textMuted,
      lineHeight: 18,
    },
  });
