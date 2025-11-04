// components/cards/GreetingHeader.tsx
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";

export function GreetingHeader({
  title,
  colors,
  onPress,
}: {
  title: string;
  colors: any;
  onPress?: () => void;
}) {
  const s = styles(colors);
  const Container: any = onPress ? Pressable : View;

  return (
    <Container style={s.card} onPress={onPress}>
      <Text style={s.title} numberOfLines={3}>
        {title}
      </Text>
      {!!onPress && <Text style={s.hint}>Tap to shuffle</Text>}
    </Container>
  );
}

const styles = (colors: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center", // centers horizontally
      justifyContent: "center", // centers vertically
    },
    title: {
      fontSize: 28,
      fontWeight: "900" as const,
      color: colors.text,
      textAlign: "center", // center text lines
      lineHeight: 26,
    },
    hint: {
      marginTop: 8,
      color: colors.subtle,
      fontSize: 12,
      textAlign: "center",
    },
  });
