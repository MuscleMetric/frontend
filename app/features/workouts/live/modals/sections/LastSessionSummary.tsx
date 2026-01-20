// live/modals/sections/LastSessionSummary.tsx
import React from "react";
import { View, Text } from "react-native";
import { fmtDateTime, fmtKg } from "../helpers/format";

export function LastSessionSummary(props: {
  colors: any;
  typography: any;
  lastCompletedAt: string | null;
  lastSessionSets: Array<{ setNumber: number; dropIndex: number; reps: number | null; weight: number | null }>;
}) {
  const { colors, typography } = props;

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 12, alignItems: "center" }}>
      <Text style={{ color: colors.textMuted, fontSize: typography.size.sub, textAlign: "center" }}>
        Last session{props.lastCompletedAt ? ` • ${fmtDateTime(props.lastCompletedAt)}` : ""}
      </Text>

      {props.lastSessionSets.length > 0 ? (
        <View style={{ marginTop: 10, gap: 6, alignItems: "center" }}>
          {props.lastSessionSets
            .filter((s) => (s.dropIndex ?? 0) === 0)
            .slice(0, 6)
            .map((s) => {
              const r = s.reps ?? null;
              const w = s.weight ?? null;

              const label =
                r != null && w != null
                  ? `${r} reps × ${fmtKg(w)}`
                  : r != null
                  ? `${r} reps`
                  : w != null
                  ? `${fmtKg(w)}`
                  : "—";

              return (
                <Text
                  key={`${s.setNumber}-${s.dropIndex}`}
                  style={{
                    color: colors.text,
                    textAlign: "center",
                    fontFamily: typography.fontFamily.medium,
                    fontSize: typography.size.body,
                  }}
                >
                  {s.setNumber}. {label}
                </Text>
              );
            })}
        </View>
      ) : (
        <Text style={{ color: colors.textMuted, marginTop: 8, textAlign: "center" }}>
          No history yet for this exercise.
        </Text>
      )}
    </View>
  );
}
