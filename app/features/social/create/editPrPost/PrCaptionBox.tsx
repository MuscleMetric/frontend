// app/features/social/create/editPrPost/PrCaptionBox.tsx

import React, { useMemo } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { MAX_CAPTION_LENGTH } from "../shared/constants";

type Props = {
  value: string;
  onChange: (text: string) => void;
};

export default function PrCaptionBox({ value, onChange }: Props) {
  const { colors, typography } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          marginTop: 16,
        },
        labelRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 8,
        },
        label: {
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "700",
        },
        count: {
          fontSize: typography.size.meta,
          color: colors.textMuted,
          fontWeight: "700",
        },
        input: {
          minHeight: 90,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: typography.size.body,
          color: colors.text,
        },
      }),
    [colors, typography]
  );

  const remaining = Math.max(0, MAX_CAPTION_LENGTH - (value?.length ?? 0));

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Caption</Text>
        <Text style={styles.count}>{remaining}</Text>
      </View>

      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.slice(0, MAX_CAPTION_LENGTH))}
        placeholder="What did this lift mean to you?"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        multiline
      />
    </View>
  );
}