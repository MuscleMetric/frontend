// live/modals/sections/DropsetToggleRow.tsx
import React from "react";
import { View, Text, Pressable } from "react-native";

export function DropsetToggleRow(props: {
  colors: any;
  typography: any;
  enabled: boolean;
  onToggle: () => void;
}) {
  const { colors, typography } = props;

  return (
    <Pressable
      onPress={props.onToggle}
      style={{
        marginTop: 10,
        marginHorizontal: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface ?? colors.bg,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ color: colors.text, fontFamily: typography.fontFamily.semibold, fontSize: 14 }}>
          Dropset
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 2, fontSize: typography.size.sub }}>
          Perform reps to failure, reduce weight, repeat immediately.
        </Text>
      </View>

      <View
        style={{
          width: 46,
          height: 28,
          borderRadius: 999,
          padding: 3,
          backgroundColor: props.enabled ? colors.primary : colors.border,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            backgroundColor: "#fff",
            alignSelf: props.enabled ? "flex-end" : "flex-start",
          }}
        />
      </View>
    </Pressable>
  );
}
