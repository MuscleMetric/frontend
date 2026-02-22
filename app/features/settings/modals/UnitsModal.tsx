// app/features/settings/modals/UnitsModal.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { supabase } from "@/lib/supabase";
import { ModalShell } from "./ModalShell";

type UnitWeight = "kg" | "lb";
type UnitHeight = "cm" | "ft_in";

function Seg({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: string; label: string }>;
  value: string;
  onChange: (next: string) => void;
}) {
  const { colors, typography, layout } = useAppTheme();
  const s = useMemo(
    () =>
      StyleSheet.create({
        wrap: { flexDirection: "row", backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 999, padding: 4, gap: 6 },
        btn: { flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
        txt: { fontFamily: typography.fontFamily.semibold, fontSize: typography.size.meta },
      }),
    [colors, typography, layout]
  );

  return (
    <View style={s.wrap}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={({ pressed }) => [
              s.btn,
              { backgroundColor: active ? colors.primary : "transparent", opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[s.txt, { color: active ? colors.onPrimary : colors.textMuted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function UnitsModal({
  open,
  onClose,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initial: { unit_weight: UnitWeight; unit_height: UnitHeight };
  onSaved: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { flex: 1, padding: layout.space.lg, gap: 14 },
        label: { color: colors.textMuted, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.meta, letterSpacing: 0.8, textTransform: "uppercase" },
        btn: { marginTop: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.primary, borderRadius: layout.radius.md, paddingVertical: 12, alignItems: "center" },
        btnText: { color: colors.onPrimary, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.body },
      }),
    [colors, typography, layout]
  );

  const [unitWeight, setUnitWeight] = useState<UnitWeight>(initial.unit_weight);
  const [unitHeight, setUnitHeight] = useState<UnitHeight>(initial.unit_height);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUnitWeight(initial.unit_weight);
    setUnitHeight(initial.unit_height);
    setSaving(false);
  }, [open, initial]);

  const save = useCallback(async () => {
    setSaving(true);

    const a = await supabase.rpc("set_profile_settings_v1", { p_key: "unit_weight", p_value: unitWeight });
    const b = await supabase.rpc("set_profile_settings_v1", { p_key: "unit_height", p_value: unitHeight });

    setSaving(false);

    if (a.error || b.error) {
      console.log("units save error:", a.error ?? b.error);
      return;
    }

    onSaved();
    onClose();
  }, [unitWeight, unitHeight, onSaved, onClose]);

  return (
    <ModalShell visible={open} onClose={onClose} title="Units" subtitle="Choose how you measure progress.">
      <View style={styles.wrap}>
        <Text style={styles.label}>Weight</Text>
        <Seg
          value={unitWeight}
          onChange={(v) => setUnitWeight(v as UnitWeight)}
          options={[
            { key: "kg", label: "KG" },
            { key: "lb", label: "LB" },
          ]}
        />

        <Text style={styles.label}>Height</Text>
        <Seg
          value={unitHeight}
          onChange={(v) => setUnitHeight(v as UnitHeight)}
          options={[
            { key: "cm", label: "CM" },
            { key: "ft_in", label: "FT/IN" },
          ]}
        />

        <Pressable style={styles.btn} onPress={save}>
          {saving ? <ActivityIndicator /> : <Text style={styles.btnText}>Save</Text>}
        </Pressable>
      </View>
    </ModalShell>
  );
}