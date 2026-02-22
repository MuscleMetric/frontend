// app/features/settings/components/SegmentedRow.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

type Opt<T extends string> = { key: T; label: string };

export function SegmentedRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<Opt<T>>;
  onChange: (next: T) => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          paddingHorizontal: layout.space.lg,
          paddingVertical: layout.space.lg,
          gap: 12,
        },
        label: {
          color: colors.text,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.body,
        },
        segWrap: {
          flexDirection: "row",
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 999,
          padding: 4,
          gap: 6,
        },
        segBtn: {
          flex: 1,
          borderRadius: 999,
          paddingVertical: 10,
          alignItems: "center",
          justifyContent: "center",
        },
        segText: {
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },
        hint: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },
      }),
    [colors, typography, layout]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.segWrap}>
        {options.map((o) => {
          const active = o.key === value;
          return (
            <Pressable
              key={o.key}
              onPress={() => onChange(o.key)}
              style={({ pressed }) => [
                styles.segBtn,
                {
                  backgroundColor: active ? colors.primary : "transparent",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.segText,
                  { color: active ? colors.onPrimary : colors.textMuted },
                ]}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.hint}>
        Control who can view your workouts and posts.
      </Text>
    </View>
  );
}