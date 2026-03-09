// app/features/settings/modals/ExperienceModal.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";
import { ModalShell } from "./ModalShell";

type Level = "beginner" | "intermediate" | "advanced";

export function ExperienceModal({
  open,
  onClose,
  initialLevel,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialLevel: Level | null;
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
        optionText: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body, color: colors.text },
        optionTextActive: { color: colors.onPrimary },
        helper: { color: colors.textMuted, fontFamily: typography.fontFamily.regular, fontSize: typography.size.meta, marginTop: 4 },
        btn: { marginTop: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primary, borderRadius: layout.radius.md, paddingVertical: 12, alignItems: "center" },
        btnText: { color: colors.onPrimary, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
      }),
    [colors, typography, layout]
  );

  const [level, setLevel] = useState<Level>(initialLevel ?? "beginner");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLevel(initialLevel ?? "beginner");
    setSaving(false);
  }, [open, initialLevel]);

  const save = useCallback(async () => {
    setSaving(true);
    const res = await supabase.rpc("set_profile_settings_v1", { p_key: "level", p_value: level });
    setSaving(false);

    if (res.error) {
      console.log("set_profile_settings_v1(level) error:", res.error);
      return;
    }

    onSaved();
    onClose();
  }, [level, onSaved, onClose]);

  const opts: Array<{ key: Level; title: string; desc: string }> = [
    { key: "beginner", title: "Beginner", desc: "New to training or returning after time off." },
    { key: "intermediate", title: "Intermediate", desc: "Consistent training, building strength & volume." },
    { key: "advanced", title: "Advanced", desc: "Highly consistent, strong technique & progression." },
  ];

  return (
    <ModalShell visible={open} onClose={onClose} title="Experience Level" subtitle="Used to tailor plans and recommendations.">
      <View style={styles.wrap}>
        {opts.map((o) => {
          const active = o.key === level;
          return (
            <Pressable key={o.key} onPress={() => setLevel(o.key)} style={[styles.option, active && styles.optionActive]}>
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{o.title}</Text>
              <Text style={[styles.helper, active && { color: "rgba(255,255,255,0.85)" }]}>{o.desc}</Text>
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