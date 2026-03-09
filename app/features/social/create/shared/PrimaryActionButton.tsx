// app/features/social/create/shared/PrimaryActionButton.tsx

import React, { useMemo } from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export default function PrimaryActionButton({
  label,
  onPress,
  disabled,
  loading,
}: Props) {
  const { colors, typography } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          backgroundColor: disabled
            ? colors.surface
            : colors.primary,
          paddingVertical: 16,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.6 : 1,
        },
        label: {
          fontSize: typography.size.body,
          fontWeight: "600",
          color: disabled ? colors.textMuted : colors.onPrimary,
        },
      }),
    [colors, typography, disabled]
  );

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}