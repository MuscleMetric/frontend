// app/features/onboarding/previews/Step5StarterPreview.tsx
import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";

type Split = "push" | "pull" | "legs";

export function Step5StarterPreview({
  split,
  setSplit,
}: {
  split: Split;
  setSplit: (s: Split) => void;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const data = useMemo(() => {
    const presets: Record<
      Split,
      {
        title: string;
        note: string;
        rows: { name: string; tag?: string; sets: string }[];
      }
    > = {
      push: {
        title: "Starter Push",
        note: "Warm up shoulders + 2 ramp sets on first press.",
        rows: [
          {
            name: "Barbell Bench Press",
            tag: "Good Form Needed",
            sets: "3×6–8",
          },
          { name: "Incline Dumbbell Press", sets: "3×8–10" },
          { name: "Machine Fly", sets: "2×12–15" },
          { name: "Lateral Raise", sets: "3×12–15" },
          { name: "Triceps Pressdown", sets: "3×10–12" },
        ],
      },
      pull: {
        title: "Starter Pull",
        note: "Focus on control. Add straps if grip limits you.",
        rows: [
          { name: "Lat Pulldown", tag: "Good Form Needed", sets: "3×8–10" },
          { name: "Chest-Supported Row", sets: "3×8–10" },
          { name: "Cable Row", sets: "2×10–12" },
          { name: "Rear Delt Fly", sets: "3×12–15" },
          { name: "Incline Curl", sets: "3×10–12" },
        ],
      },
      legs: {
        title: "Starter Legs",
        note: "Keep reps smooth. Stop 1–2 reps short of failure.",
        rows: [
          { name: "Back Squat", tag: "Good Form Needed", sets: "3×5–8" },
          { name: "Romanian Deadlift", sets: "3×8–10" },
          { name: "Leg Press", sets: "2×10–12" },
          { name: "Leg Curl", sets: "3×10–12" },
          { name: "Calf Raise", sets: "3×12–15" },
        ],
      },
    };

    return presets[split];
  }, [split]);

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={s.h1}>Starter workout preview</Text>

      <View style={s.noteCard}>
        <Text style={s.noteTitle}>Includes</Text>
        <Text style={s.noteLine}>• Set & rep targets</Text>
        <Text style={s.noteLine}>• Warm-up note</Text>
        <Text style={s.noteLine}>• Editable anytime</Text>
      </View>

      <Text style={s.helper}>Choose a split below to preview it.</Text>

      <View style={{ flexDirection: "row", gap: 10 }}>
        {(["push", "pull", "legs"] as const).map((k) => {
          const active = k === split;
          return (
            <Pressable
              key={k}
              onPress={() => setSplit(k)}
              style={[s.splitPill, active ? s.splitPillActive : null]}
            >
              <Text style={s.splitText}>{k.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.previewCard}>
        <Text style={s.previewTitle}>{data.title}</Text>
        <Text style={s.previewSub}>{data.note}</Text>

        <ScrollView
          style={{ marginTop: 10 }}
          contentContainerStyle={{ gap: 10 }}
        >
          {data.rows.map((r) => (
            <View key={r.name} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle} numberOfLines={1}>
                  {r.name}
                </Text>
                {r.tag ? <Text style={s.rowTag}>{r.tag}</Text> : null}
              </View>
              <View style={s.setPill}>
                <Text style={s.setText}>{r.sets}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    h1: { color: colors.text, fontSize: 18, fontWeight: "900" },
    helper: { color: colors.subtle, fontWeight: "700" },

    noteCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 14,
      gap: 6,
    },
    noteTitle: { color: colors.text, fontWeight: "900" },
    noteLine: { color: colors.subtle, fontWeight: "700" },

    splitPill: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    splitPillActive: {
      borderColor: "rgba(14,165,233,0.55)",
      backgroundColor: "rgba(14,165,233,0.14)",
    },
    splitText: { color: colors.text, fontWeight: "900" },

    previewCard: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 14,
      height: 300, // important: keeps layout stable in PhonePreview
    },
    previewTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
    previewSub: { color: colors.subtle, fontWeight: "700", marginTop: 4 },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
      padding: 12,
    },
    rowTitle: { color: colors.text, fontWeight: "900" },
    rowTag: { color: colors.subtle, fontWeight: "800", marginTop: 2 },

    setPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    setText: { color: colors.text, fontWeight: "900" },
  });
