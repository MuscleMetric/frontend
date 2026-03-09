// app/features/settings/modals/PrimaryGoalModal.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";
import { ModalShell } from "./ModalShell";

type Goal =
  | "get_stronger"
  | "build_muscle"
  | "lose_fat"
  | "improve_endurance"
  | "general_fitness";

export function PrimaryGoalModal({
  open,
  onClose,
  initialGoal,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialGoal: string | null;
  onSaved: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { flex: 1, padding: layout.space.lg, gap: 10 },
        option: {
          paddingVertical: 14,
          paddingHorizontal: layout.space.lg,
          borderRadius: layout.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        },
        optionActive: { backgroundColor: colors.primary },
        title: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body, color: colors.text },
        titleActive: { color: colors.onPrimary },
        desc: { marginTop: 4, color: colors.textMuted, fontFamily: typography.fontFamily.regular, fontSize: typography.size.meta },
        btn: { marginTop: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primary, borderRadius: layout.radius.md, paddingVertical: 12, alignItems: "center" },
        btnText: { color: colors.onPrimary, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
      }),
    [colors, typography, layout]
  );

  const [goal, setGoal] = useState<Goal>("get_stronger");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGoal((initialGoal as Goal) ?? "get_stronger");
    setSaving(false);
  }, [open, initialGoal]);

  const save = useCallback(async () => {
    setSaving(true);
    const res = await supabase.rpc("set_profile_settings_v1", { p_key: "primaryGoal", p_value: goal });
    setSaving(false);

    if (res.error) {
      console.log("set_profile_settings_v1(primaryGoal) error:", res.error);
      return;
    }

    onSaved();
    onClose();
  }, [goal, onSaved, onClose]);

  const opts: Array<{ key: Goal; title: string; desc: string }> = [
    { key: "get_stronger", title: "Get Stronger", desc: "Prioritize strength and progressive overload." },
    { key: "build_muscle", title: "Build Muscle", desc: "Hypertrophy focused training and volume." },
    { key: "lose_fat", title: "Lose Fat", desc: "Support fat loss with training consistency." },
    { key: "improve_endurance", title: "Improve Endurance", desc: "Performance and conditioning focus." },
    { key: "general_fitness", title: "General Fitness", desc: "Balanced approach for overall health." },
  ];

  return (
    <ModalShell visible={open} onClose={onClose} title="Primary Goal" subtitle="Used across plans, insights, and coaching.">
      <View style={styles.wrap}>
        {opts.map((o) => {
          const active = o.key === goal;
          return (
            <Pressable key={o.key} onPress={() => setGoal(o.key)} style={[styles.option, active && styles.optionActive]}>
              <Text style={[styles.title, active && styles.titleActive]}>{o.title}</Text>
              <Text style={[styles.desc, active && { color: "rgba(255,255,255,0.85)" }]}>{o.desc}</Text>
            </Pressable>
          );
        })}

        <Pressable style={styles.btn} onPress={save}>
          {saving ? <ActivityIndicator /> : <Text style={styles.btnText}>Save</Text>}
        </Pressable>
      </View>
    </ModalShell>
  );
}