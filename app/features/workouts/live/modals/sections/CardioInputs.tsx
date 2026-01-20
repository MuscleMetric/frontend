// live/modals/sections/CardioInputs.tsx
import React from "react";
import { View, Text, TextInput, Platform } from "react-native";
import { sanitizeDistanceInput, sanitizeTimeSecondsInput } from "../helpers/inputSanitizers";

export function CardioInputs(props: {
  colors: any;
  typography: any;
  distanceText: string;
  timeText: string;
  onChangeDistance: (t: string) => void;
  onChangeTime: (t: string) => void;
}) {
  const { colors, typography } = props;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 20,
        padding: 14,
        backgroundColor: colors.surface ?? colors.bg,
      }}
    >
      <Text style={{ color: colors.textMuted, marginBottom: 8, fontSize: typography.size.sub }}>
        Distance (km)
      </Text>
      <TextInput
        value={props.distanceText}
        onChangeText={(t) => props.onChangeDistance(sanitizeDistanceInput(t))}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        keyboardType={Platform.OS === "ios" ? "default" : "numeric"}
        inputMode="decimal"
        style={{
          fontFamily: typography.fontFamily.bold,
          fontSize: 28,
          color: colors.text,
          paddingVertical: 6,
        }}
      />

      <View style={{ height: 12 }} />

      <Text style={{ color: colors.textMuted, marginBottom: 8, fontSize: typography.size.sub }}>
        Time (seconds)
      </Text>
      <TextInput
        value={props.timeText}
        onChangeText={(t) => props.onChangeTime(sanitizeTimeSecondsInput(t))}
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        keyboardType="numeric"
        style={{
          fontFamily: typography.fontFamily.bold,
          fontSize: 28,
          color: colors.text,
          paddingVertical: 6,
        }}
      />
    </View>
  );
}
