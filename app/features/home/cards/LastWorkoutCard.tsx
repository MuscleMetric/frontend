import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { BaseCard } from "../ui/BaseCard";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { homeTokens } from "../ui/homeTheme";

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
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function LastWorkoutCard({ card }: { card: any }) {
  const { colors } = useAppTheme();
  const t = useMemo(() => homeTokens(colors), [colors]);

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
    <BaseCard>
      <View style={{ gap: 12 }}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: t.text }]}>Last session</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: t.trackBorder }]} />

        {/* Content */}
        <View style={{ gap: 6 }}>
          <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
            {title}
          </Text>

          <Text style={[styles.meta, { color: t.subtle }]}>
            {fmtDate(completedAt)}
            {metaParts.length ? ` · ${metaParts.join(" · ")}` : ""}
          </Text>
        </View>
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

  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
    opacity: 0.9,
  },

  title: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
  },

  meta: {
    fontSize: 12,
    fontWeight: "700",
  },
});
