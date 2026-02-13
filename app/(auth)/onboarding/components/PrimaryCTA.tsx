import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../../../lib/useAppTheme";

export function PrimaryCTA({
  title,
  onPress,
  disabled,
  loading,
  variant = "primary",
  rightIcon,
  secondaryText,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "ghost";
  rightIcon?: React.ReactNode; // e.g. arrow
  secondaryText?: string; // optional "Not now"
}) {
  const { colors } = useAppTheme() as any;
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const isDisabled = !!disabled || !!loading;

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={[
          styles.btn,
          variant === "ghost" && styles.btnGhost,
          isDisabled && { opacity: 0.75 },
        ]}
      >
        {loading ? (
          <ActivityIndicator />
        ) : (
          <View style={styles.btnInner}>
            <Text style={styles.btnText}>{title}</Text>
            {rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
          </View>
        )}
      </Pressable>

      {secondaryText ? (
        <Pressable style={styles.secondary} disabled>
          <Text style={styles.secondaryText}>{secondaryText}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: 16,
      paddingTop: 10,
      backgroundColor: "transparent",
    },
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
    btnGhost: {
      backgroundColor: "rgba(255,255,255,0.05)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.10)",
      shadowOpacity: 0,
      elevation: 0,
    },
    btnInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    btnText: {
      color: "#fff",
      fontWeight: "900",
      fontSize: 16,
      letterSpacing: 0.2,
    },
    rightIcon: {
      marginLeft: 2,
      opacity: 0.95,
    },
    secondary: {
      marginTop: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 6,
    },
    secondaryText: {
      color: colors.textMuted,
      fontWeight: "700",
    },
  });
