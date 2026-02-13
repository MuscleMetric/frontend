import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";

export function UnitToggle<T extends string>({
  value,
  left,
  right,
  onChange,
}: {
  value: T;
  left: { value: T; label: string };
  right: { value: T; label: string };
  onChange: (v: T) => void;
}) {
  const { colors } = useAppTheme() as any;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const leftActive = value === left.value;
  const rightActive = value === right.value;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => onChange(left.value)}
        style={[styles.pill, leftActive && styles.pillActive]}
      >
        <Text style={[styles.text, leftActive && styles.textActive]}>
          {left.label}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onChange(right.value)}
        style={[styles.pill, rightActive && styles.pillActive]}
      >
        <Text style={[styles.text, rightActive && styles.textActive]}>
          {right.label}
        </Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      borderRadius: 999,
      padding: 3,
      backgroundColor: colors.trackBg ?? "rgba(0,0,0,0.06)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.trackBorder ?? "rgba(0,0,0,0.10)",
      gap: 3,
    },

    pill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 46,
      backgroundColor: "transparent",
    },

    pillActive: {
      backgroundColor: colors.primary,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.onPrimaryBorder ?? "rgba(255,255,255,0.25)",

      // textMuted elevation / glow
      shadowColor: colors.primary,
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },

    text: {
      color: colors.textMuted ?? colors.textMuted,
      fontWeight: "900",
      fontSize: 12,
      letterSpacing: 0.4,
    },

    textActive: {
      color: colors.onPrimary ?? "#fff",
    },
  });
