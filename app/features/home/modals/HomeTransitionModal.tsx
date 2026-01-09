import React, { useMemo } from "react";
import { Modal, Pressable, View, Text, StyleSheet, Image } from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { Button } from "@/ui";

type Transition =
  | {
      id: string;
      type: "unlock_experienced_home" | "welcome_back";
      created_at: string;
      payload?: Record<string, any>;
    }
  | null
  | undefined;

export function HomeTransitionModal({
  visible,
  transition,
  onClose,
}: {
  visible: boolean;
  transition: Transition;
  onClose: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();

  const content = useMemo(() => {
    const type = transition?.type;

    if (type === "unlock_experienced_home") {
      return {
        kicker: "Unlocked",
        title: "You’ve levelled up 💪",
        body:
          "Nice work — you’ve logged 5 workouts. Your Home screen will now show deeper progress insights like PRs, streaks, and trends.",
        cta: "Show me",
        tone: "blue" as const,
      };
    }

    if (type === "welcome_back") {
      return {
        kicker: "Welcome back",
        title: "Let’s build momentum 🔥",
        body:
          "Good to see you again. Your progress is saved — today is about getting back into rhythm. We’ll keep Home focused on what matters next.",
        cta: "Let’s go",
        tone: "green" as const,
      };
    }

    return {
      kicker: "Update",
      title: "You’re all set",
      body: "Your Home screen has been updated.",
      cta: "Continue",
      tone: "neutral" as const,
    };
  }, [transition?.type]);

  const logo = require("../../../../assets/icon.png");

  const ctaVariant =
    content.tone === "green"
      ? "secondary"
      : content.tone === "blue"
      ? "secondary"
      : "secondary";

  // subtle tinted container color for CTA
  const ctaBg =
    content.tone === "green"
      ? "rgba(34,197,94,0.14)"
      : content.tone === "blue"
      ? "rgba(37,99,235,0.14)"
      : colors.cardPressed;

  const ctaBorder =
    content.tone === "green"
      ? "rgba(34,197,94,0.25)"
      : content.tone === "blue"
      ? "rgba(37,99,235,0.25)"
      : colors.border;

  const ctaText =
    content.tone === "green"
      ? colors.success
      : content.tone === "blue"
      ? colors.primary
      : colors.text;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose}>
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
          <View style={{ alignItems: "center", gap: 14 }}>
            <Text
              style={{
                fontFamily: typography.fontFamily.bold,
                letterSpacing: 1.1,
                textTransform: "uppercase",
                fontSize: typography.size.meta,
                color: colors.textMuted,
              }}
            >
              {content.kicker}
            </Text>

            <Text
              style={{
                fontFamily: typography.fontFamily.bold,
                fontSize: typography.size.h1,
                lineHeight: typography.lineHeight.h1,
                color: colors.text,
                textAlign: "center",
                letterSpacing: -0.4,
              }}
            >
              {content.title}
            </Text>

            <Text
              style={{
                fontFamily: typography.fontFamily.medium,
                fontSize: typography.size.sub,
                lineHeight: typography.lineHeight.sub,
                color: colors.textMuted,
                textAlign: "center",
              }}
            >
              {content.body}
            </Text>

            <Image
              source={logo}
              style={{ width: 46, height: 46, opacity: 0.95, marginTop: 4 }}
              resizeMode="contain"
            />

            {/* CTA */}
            <View style={{ alignSelf: "stretch", marginTop: 8 }}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.ctaBtn,
                  {
                    borderRadius: layout.radius.md,
                    backgroundColor: pressed ? colors.cardPressed : ctaBg,
                    borderColor: ctaBorder,
                    opacity: pressed ? 0.92 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: typography.fontFamily.semibold,
                    fontSize: typography.size.body,
                    lineHeight: typography.lineHeight.body,
                    color: ctaText,
                  }}
                >
                  {content.cta}
                </Text>
              </Pressable>
            </View>
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
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  ctaBtn: {
    alignSelf: "stretch",
    paddingVertical: 13,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
