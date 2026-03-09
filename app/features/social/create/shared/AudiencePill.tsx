// app/features/social/create/shared/AudiencePill.tsx

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { AUDIENCE_OPTIONS } from "./constants";
import type { Audience } from "../state/createPostTypes";

type Props = {
  value: Audience;
  onChange: (audience: Audience) => void;
};

export default function AudiencePill({ value, onChange }: Props) {
  const { colors, typography } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flexDirection: "row",
          backgroundColor: colors.surface,
          borderRadius: 20,
          padding: 4,
        },
        option: {
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 16,
        },
        active: {
          backgroundColor: colors.primary,
        },
        label: {
          fontSize: typography.size.body,
          color: colors.textMuted,
        },
        activeLabel: {
          color: colors.onPrimary,
          fontWeight: "600",
        },
      }),
    [colors, typography]
  );

  return (
    <View style={styles.container}>
      {AUDIENCE_OPTIONS.map((opt) => {
        const isActive = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.option, isActive && styles.active]}
          >
            <Text
              style={[
                styles.label,
                isActive && styles.activeLabel,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}