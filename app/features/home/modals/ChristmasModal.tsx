import React from "react";
import { Modal, Pressable, View, Text, StyleSheet, Image } from "react-native";
import { ChristmasConfetti } from "../../../_components/Confetti/ChristmasConfetti";

const logo = require("../../../../assets/icon.png");

export function ChristmasModal({
  visible,
  onClose,
  colors,
  name,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
  name: string | null;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <ChristmasConfetti active={visible} />

        <Pressable
          onPress={() => {}}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={{ alignItems: "center", gap: 16 }}>
            <Text style={[styles.kicker, { color: colors.muted ?? colors.subtle }]}>
              To {name || "you"},
            </Text>

            <Text style={[styles.title, { color: colors.text }]}>Merry Christmas 🎄</Text>

            <Text style={[styles.body, { color: colors.text }]}>
              Wishing you a peaceful day, great food, and a strong finish to the year.
            </Text>

            <View style={{ alignItems: "center", gap: 6 }}>
              <Text style={[styles.kicker, { color: colors.muted ?? colors.subtle }]}>
                Best Wishes,
              </Text>
              <Text style={[styles.sign, { color: colors.text }]}>The MuscleMetric Team</Text>

              <Image
                source={logo}
                style={{ width: 46, height: 46, marginTop: 6, opacity: 0.95 }}
                resizeMode="contain"
              />
            </View>

            <Pressable
              onPress={onClose}
              style={[
                styles.cta,
                {
                  backgroundColor: "rgba(34,197,94,0.14)",
                  borderColor: "rgba(34,197,94,0.25)",
                },
              ]}
            >
              <Text style={[styles.ctaText, { color: "#16a34a" }]}>Let’s go</Text>
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
    backgroundColor: "rgba(0,0,0,0.38)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  sheet: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  kicker: { fontWeight: "800", textAlign: "center" },
  title: { fontSize: 24, fontWeight: "900", textAlign: "center" },
  body: { fontWeight: "700", lineHeight: 24, textAlign: "center" },
  sign: { fontWeight: "900", textAlign: "center" },
  cta: {
    alignSelf: "stretch",
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaText: { fontWeight: "900", fontSize: 16 },
});
