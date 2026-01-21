import React from "react";
import { Text, View } from "react-native";
import { Pill } from "@/ui";
import { useAppTheme } from "@/lib/useAppTheme";
import { ProgressSection } from "../components/ProgressSection";
import type { ProgressOverview } from "../data/progress.types";
import { formatKg } from "../data/progress.mapper";

export default function MomentumHeroSection({
  momentum,
}: {
  momentum: ProgressOverview["momentum"];
}) {
  const { colors } = useAppTheme();

  const badge =
    momentum.status === "on_fire"
      ? "ON FIRE"
      : momentum.status === "returning"
      ? "WELCOME BACK"
      : momentum.status === "new_user"
      ? "GET STARTED"
      : "STEADY";

  return (
    <ProgressSection>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Pill label={badge} />
      </View>

      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>
        {momentum.headline}
      </Text>

      {!!momentum.subhead && (
        <Text style={{ color: colors.textMuted }}>{momentum.subhead}</Text>
      )}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
        <Kpi label="Workouts (30d)" value={String(momentum.workouts_30d)} />
        <Kpi label="Streak" value={`${momentum.streak_days}d`} />
        <Kpi label="Volume (30d)" value={formatKg(momentum.volume_30d)} />
      </View>
    </ProgressSection>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 18 }}>
        {value}
      </Text>
    </View>
  );
}
