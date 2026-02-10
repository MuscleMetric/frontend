import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../../../../lib/useAppTheme";

export function PrimaryCTA({
  title,
  onPress,
  disabled,
  loading,
  rightIcon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  rightIcon?: React.ReactNode;
}) {
  const { colors, typography } = useAppTheme() as any;
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);

  const isDisabled = !!disabled || !!loading;

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={[styles.btn, isDisabled && { opacity: 0.75 }]}
      >
        {loading ? (
          <ActivityIndicator />
        ) : (
          <View style={styles.inner}>
            <Text style={styles.text}>{title}</Text>
            {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: any, typography: any) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: "transparent" },
    btn: {
      backgroundColor: colors.primary,
      borderRadius: 28,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOpacity: 0.25,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    inner: { flexDirection: "row", alignItems: "center", gap: 10 },
    text: {
      color: colors.onPrimary ?? "#fff",
      fontSize: 16,
      fontFamily: typography?.fontFamily?.bold,
      letterSpacing: 0.2,
    },
    icon: { marginLeft: 2, opacity: 0.95 },
  });
