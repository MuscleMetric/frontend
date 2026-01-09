import React from "react";
import { Modal, Pressable, View, Text, StyleSheet, Image } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { ChristmasConfetti } from "../../../_components/Confetti/ChristmasConfetti";

const logo = require("../../../../assets/icon.png");

export function ChristmasModal({
  visible,
  onClose,
  name,
}: {
  visible: boolean;
  onClose: () => void;
  name: string | null;
}) {
  const { colors, typography, layout } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <ChristmasConfetti active={visible} />

        <Pressable
          onPress={() => {}}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: layout.radius.xl,
            },
          ]}
        >
          <View style={{ alignItems: "center", gap: 16 }}>
            <Text
              style={{
                fontFamily: typography.fontFamily.medium,
                fontSize: typography.size.sub,
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              To {name || "you"},
            </Text>

            <Text
              style={{
                fontFamily: typography.fontFamily.bold,
                fontSize: typography.size.h1,
                lineHeight: typography.lineHeight.h1,
                color: colors.text,
                textAlign: "center",
              }}
            >
              Merry Christmas 🎄
            </Text>

            <Text
              style={{
                fontFamily: typography.fontFamily.medium,
                fontSize: typography.size.body,
                lineHeight: typography.lineHeight.body,
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              Wishing you a peaceful day, great food, and a strong finish to the year.
            </Text>

            <View style={{ alignItems: "center", gap: 6 }}>
              <Text
                style={{
                  fontFamily: typography.fontFamily.medium,
                  fontSize: typography.size.sub,
                  color: colors.textMuted,
                  textAlign: "center",
                }}
              >
                Best Wishes,
              </Text>
              <Text
                style={{
                  fontFamily: typography.fontFamily.bold,
                  fontSize: typography.size.body,
                  color: colors.text,
                  textAlign: "center",
                }}
              >
                The MuscleMetric Team
              </Text>

              <Image
                source={logo}
                style={{ width: 46, height: 46, marginTop: 6, opacity: 0.95 }}
                resizeMode="contain"
              />
            </View>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.cta,
                {
                  borderRadius: layout.radius.md,
                  backgroundColor: pressed ? colors.cardPressed : "rgba(34,197,94,0.14)",
                  borderColor: "rgba(34,197,94,0.25)",
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: typography.fontFamily.semibold,
                  fontSize: typography.size.body,
                  color: colors.success,
                }}
              >
                Let’s go
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  sheet: {
    width: "100%",
    maxWidth: 460,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  cta: {
    alignSelf: "stretch",
    marginTop: 8,
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
