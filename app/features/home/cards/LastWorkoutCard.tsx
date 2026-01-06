import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BaseCard } from "../ui/BaseCard";

export function LastWorkoutCard({ card }: { card: any }) {
  const title = String(card?.title ?? "Last workout");
  const completedAt = card?.completed_at ? String(card.completed_at) : null;
  const duration = card?.duration_seconds == null ? null : Number(card.duration_seconds);
  const sets = card?.sets_completed == null ? null : Number(card.sets_completed);

  const meta = [
    duration ? `${Math.round(duration / 60)}m` : null,
    sets != null ? `${sets} sets` : null,
  ].filter(Boolean);

  return (
    <BaseCard>
      <View style={{ gap: 10 }}>
        <Text style={styles.kicker}>Last session</Text>

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <Text style={styles.subtle}>
          {completedAt
            ? new Date(completedAt).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })
            : "—"}
          {meta.length ? ` · ${meta.join(" · ")}` : ""}
        </Text>
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
  title: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
    color: "rgba(255,255,255,0.92)",
  },
  subtle: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255,255,255,0.55)",
  },
});
