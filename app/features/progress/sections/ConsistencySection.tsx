import React from "react";
import { Text, View } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { ProgressSection } from "../components/ProgressSection";
import type { ProgressOverview } from "../data/progress.types";
import { formatPct } from "../data/progress.mapper";

export default function ConsistencySection({
  consistency,
}: {
  consistency: ProgressOverview["consistency"];
}) {
  const { colors } = useAppTheme();

  return (
    <ProgressSection>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
          Consistency
        </Text>

        <Text style={{ color: colors.textMuted }}>
          {consistency.delta_vs_last_month_pct == null
            ? "—"
            : `${formatPct(consistency.delta_vs_last_month_pct)} vs last month`}
        </Text>
      </View>

      {/* Simple bar row (first pass). We'll replace with a proper chart component next. */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        {consistency.months.map((m) => (
          <MiniBar
            key={m.key}
            label={m.label}
            value={m.workouts_completed}
          />
        ))}
      </View>
    </ProgressSection>
  );
}

function MiniBar({ label, value }: { label: string; value: number }) {
  const { colors } = useAppTheme();
  const h = Math.max(6, Math.min(90, value * 10)); // placeholder scaling

  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <View
        style={{
          height: h,
          width: "100%",
          borderRadius: 10,
          backgroundColor: colors.primary,
          opacity: 0.9,
        }}
      />
      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 6 }}>
        {label}
      </Text>
    </View>
  );
}
