// app/features/social/create/shared/ShareExternallyRow.tsx

import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

type Props = {
  onShare: () => void;
};

export default function ShareExternallyRow({ onShare }: Props) {
  const { colors, typography } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginTop: 16,
          paddingVertical: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
        },
        text: {
          fontSize: typography.size.body,
          color: colors.textMuted,
          fontWeight: "500",
        },
      }),
    [colors, typography]
  );

  return (
    <TouchableOpacity style={styles.container} onPress={onShare}>
      <Text style={styles.text}>Share Externally</Text>
    </TouchableOpacity>
  );
}