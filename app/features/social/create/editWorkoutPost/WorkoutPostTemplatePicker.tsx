// app/features/social/create/editWorkoutPost/WorkoutPostTemplatePicker.tsx

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { WorkoutPostTemplateId } from "../state/createPostTypes";

type Option = { id: WorkoutPostTemplateId; title: string; subtitle: string };

const OPTIONS: Option[] = [
  { id: "cinematic", title: "Cinematic", subtitle: "Bold, share-ready" },
  { id: "clean", title: "Clean", subtitle: "Minimal & premium" },
  { id: "stats", title: "Stats", subtitle: "Numbers first" },
];

type Props = {
  value: WorkoutPostTemplateId;
  onChange: (id: WorkoutPostTemplateId) => void;
};

export default function WorkoutPostTemplatePicker({ value, onChange }: Props) {
  const { colors, typography } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginTop: 14,
        },
        label: {
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "700",
          marginBottom: 8,
        },
        row: {
          flexDirection: "row",
        },
        pill: {
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          marginRight: 10,
          minWidth: 140,
        },
        pillActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primary,
        },
        title: {
          fontSize: typography.size.body,
          fontWeight: "700",
          color: colors.text,
          marginBottom: 2,
        },
        titleActive: {
          color: colors.onPrimary,
        },
        sub: {
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "600",
        },
        subActive: {
          color: "rgba(255,255,255,0.85)",
        },
      }),
    [colors, typography]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Template</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {OPTIONS.map((opt) => {
            const active = opt.id === value;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => onChange(opt.id)}
                style={[styles.pill, active && styles.pillActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.title, active && styles.titleActive]}>{opt.title}</Text>
                <Text style={[styles.sub, active && styles.subActive]}>{opt.subtitle}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}