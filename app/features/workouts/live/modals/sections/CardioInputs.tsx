// live/modals/sections/CardioInputs.tsx
import React from "react";
import { View, Text, TextInput, Platform } from "react-native";
import { sanitizeDistanceInput } from "../helpers/inputSanitizers";

export function CardioInputs(props: {
  colors: any;
  typography: any;

  distanceText: string;

  minutesText: string;
  secondsText: string;

  onChangeDistance: (t: string) => void;
  onChangeMinutes: (t: string) => void;
  onChangeSeconds: (t: string) => void;
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
      {/* Distance */}
      <Text
        style={{
          color: colors.textMuted,
          marginBottom: 8,
          fontSize: typography.size.sub,
        }}
      >
        Distance (km)
      </Text>

      <TextInput
        value={props.distanceText}
        onChangeText={(t) =>
          props.onChangeDistance(sanitizeDistanceInput(t))
        }
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

      {/* Spacer */}
      <View style={{ height: 16 }} />

      {/* Time */}
      <Text
        style={{
          color: colors.textMuted,
          marginBottom: 8,
          fontSize: typography.size.sub,
        }}
      >
        Time
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Minutes */}
        <View style={{ flex: 1 }}>
          <TextInput
            value={props.minutesText}
            onChangeText={(t) =>
              props.onChangeMinutes(t.replace(/[^\d]/g, ""))
            }
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
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            mins
          </Text>
        </View>

        {/* Divider */}
        <Text
          style={{
            color: colors.text,
            fontSize: 24,
            fontFamily: typography.fontFamily.bold,
          }}
        >
          :
        </Text>

        {/* Seconds */}
        <View style={{ flex: 1 }}>
          <TextInput
            value={props.secondsText}
            onChangeText={(t) =>
              props.onChangeSeconds(t.replace(/[^\d]/g, ""))
            }
            placeholder="00"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            style={{
              fontFamily: typography.fontFamily.bold,
              fontSize: 28,
              color: colors.text,
              paddingVertical: 6,
            }}
          />
          <Text
            style={{
              color: colors.textMuted,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            secs
          </Text>
        </View>
      </View>
    </View>
  );
}