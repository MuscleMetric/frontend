// app/features/workouts/live/modals/sections/TimedWeightInputs.tsx
import React from "react";
import { View, Text, TextInput, Pressable, Platform } from "react-native";

export function TimedWeightInputs(props: {
  colors: any;
  typography: any;

  weightText: string;
  minutesText: string;
  secondsText: string;

  onChangeWeightText: (t: string) => void;
  onChangeMinutes: (t: string) => void;
  onChangeSeconds: (t: string) => void;
  onStepWeight: (delta: number) => void;

  weightRef: React.RefObject<TextInput>;
}) {
  const { colors, typography } = props;

  return (
    <>
      <Text
        style={{
          color: colors.textMuted,
          marginBottom: 8,
          fontSize: typography.size.sub,
        }}
      >
        Weight (optional)
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 22,
          backgroundColor: colors.surface ?? colors.bg,
          overflow: "hidden",
        }}
      >
        <Pressable
          onPress={() => props.onStepWeight(-2.5)}
          hitSlop={10}
          style={{
            width: 70,
            height: 64,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 28,
              color: colors.text,
              fontFamily: typography.fontFamily.bold,
            }}
          >
            −
          </Text>
        </Pressable>

        <View
          style={{
            flex: 1,
            height: 64,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <TextInput
            ref={props.weightRef}
            value={props.weightText}
            onChangeText={props.onChangeWeightText}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
            inputMode="decimal"
            style={{
              fontFamily: typography.fontFamily.bold,
              fontSize: 34,
              color: colors.text,
              textAlign: "center",
              width: "100%",
              paddingVertical: 0,
            }}
          />
          <Text
            style={{
              color: colors.textMuted,
              marginTop: -4,
              fontSize: typography.size.sub,
            }}
          >
            kilograms
          </Text>
        </View>

        <Pressable
          onPress={() => props.onStepWeight(+2.5)}
          hitSlop={10}
          style={{
            width: 70,
            height: 64,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontSize: 28,
              color: colors.text,
              fontFamily: typography.fontFamily.bold,
            }}
          >
            +
          </Text>
        </Pressable>
      </View>

      <Text
        style={{
          color: colors.textMuted,
          marginBottom: 8,
          marginTop: 14,
          fontSize: typography.size.sub,
        }}
      >
        Time
      </Text>

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 22,
          backgroundColor: colors.surface ?? colors.bg,
          overflow: "hidden",
          paddingVertical: 18,
          paddingHorizontal: 18,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
          }}
        >
          {/* Minutes */}
          <View
            style={{
              flex: 1,
              alignItems: "center",
            }}
          >
            <TextInput
              value={props.minutesText}
              onChangeText={(t) =>
                props.onChangeMinutes(t.replace(/[^\d]/g, ""))
              }
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              textAlign="center"
              style={{
                fontFamily: typography.fontFamily.bold,
                fontSize: 42,
                lineHeight: 48,
                height: 52,
                color: colors.text,
                width: "100%",
                paddingVertical: 0,
                textAlignVertical: "center",
              }}
            />

            <Text
              style={{
                color: colors.textMuted,
                fontSize: 13,
                marginTop: 4,
              }}
            >
              mins
            </Text>
          </View>

          {/* Colon */}
          <Text
            style={{
              color: colors.text,
              fontSize: 36,
              lineHeight: 40,
              marginTop: -6,
              fontFamily: typography.fontFamily.bold,
            }}
          >
            :
          </Text>

          {/* Seconds */}
          <View
            style={{
              flex: 1,
              alignItems: "center",
            }}
          >
            <TextInput
              value={props.secondsText}
              onChangeText={(t) =>
                props.onChangeSeconds(t.replace(/[^\d]/g, ""))
              }
              placeholder="00"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              textAlign="center"
              style={{
                fontFamily: typography.fontFamily.bold,
                fontSize: 42,
                lineHeight: 48,
                height: 52,
                color: colors.text,
                width: "100%",
                paddingVertical: 0,
                textAlignVertical: "center",
              }}
            />

            <Text
              style={{
                color: colors.textMuted,
                fontSize: 13,
                marginTop: 4,
              }}
            >
              secs
            </Text>
          </View>
        </View>
      </View>
    </>
  );
}
