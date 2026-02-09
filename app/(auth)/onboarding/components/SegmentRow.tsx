import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
};

export function SegmentRow<T extends string>({
  value,
  options,
  onChange,
  error,
}: {
  value: T | null;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
  error?: boolean;
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.container, error && styles.containerError]}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.item, active ? styles.itemActive : styles.itemIdle]}
          >
            <Text style={[styles.text, active ? styles.textActive : styles.textIdle]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      borderRadius: 999,
      padding: 6,
      backgroundColor: "rgba(255,255,255,0.05)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.08)",
      gap: 6,
    },
    containerError: {
      borderColor: "rgba(239,68,68,0.65)",
    },
    item: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    itemIdle: {
      backgroundColor: "transparent",
    },
    itemActive: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    text: {
      fontSize: 14,
      fontWeight: "900",
    },
    textIdle: {
      color: colors.subtle,
    },
    textActive: {
      color: "#fff",
    },
  });
