import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../../../../lib/useAppTheme";

export function SecondaryCTA({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  const { colors, typography } = useAppTheme() as any;
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <Pressable onPress={onPress} style={styles.btn}>
        <Text style={styles.text}>{title}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: any, typography: any) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: "transparent" },
    btn: {
      backgroundColor: "rgba(255,255,255,0.05)",
      borderRadius: 28,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
    },
    text: {
      color: colors.text,
      fontSize: 14,
      fontFamily: typography?.fontFamily?.semibold,
    },
  });
