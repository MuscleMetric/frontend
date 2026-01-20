// live/modals/sections/ModalHeaderRow.tsx
import React from "react";
import { View, Text, Pressable, Keyboard } from "react-native";

export function ModalHeaderRow(props: {
  colors: any;
  typography: any;
  title: string;
  subtitle: string;
  onClose: () => void;
  rightLabel?: string; // e.g. "Swap" or "⋯"
  onRightPress?: () => void;
}) {
  const { colors, typography } = props;

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingBottom: 8,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <Pressable
        onPress={() => {
          Keyboard.dismiss();
          props.onClose();
        }}
        hitSlop={12}
        style={{ width: 70 }}
      >
        <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.semibold }}>
          Close
        </Text>
      </Pressable>

      <View style={{ flex: 1, alignItems: "center" }}>
        <Text
          style={{
            fontFamily: typography.fontFamily.bold,
            fontSize: typography.size.h3,
            color: colors.text,
            letterSpacing: -0.2,
            textAlign: "center",
          }}
          numberOfLines={2}
        >
          {props.title}
        </Text>

        <Text style={{ color: colors.textMuted, marginTop: 3, fontSize: typography.size.sub }}>
          {props.subtitle}
        </Text>
      </View>

      <Pressable
        onPress={props.onRightPress}
        hitSlop={12}
        style={{ width: 70, alignItems: "flex-end" }}
      >
        <Text style={{ color: colors.textMuted, fontFamily: typography.fontFamily.semibold }}>
          {props.rightLabel ?? ""}
        </Text>
      </Pressable>
    </View>
  );
}
