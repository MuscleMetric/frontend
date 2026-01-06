import React, { useMemo } from "react";
import { Modal, Pressable, View, Text, StyleSheet, Image } from "react-native";
import { homeTokens } from "../ui/homeTheme";

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
  colors,
}: {
  visible: boolean;
  transition: Transition;
  onClose: () => void;
  colors: any;
}) {
  const t = useMemo(() => homeTokens(colors), [colors]);

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

    // fallback (shouldn't happen if backend is correct)
    return {
      kicker: "Update",
      title: "You’re all set",
      body: "Your Home screen has been updated.",
      cta: "Continue",
      tone: "neutral" as const,
    };
  }, [transition?.type]);

  const logo = require("../../../../assets/icon.png"); // adjust path if needed

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card ?? colors.surface ?? "#111827",
              borderColor: colors.border ?? t.cardBorder,
            },
          ]}
        >
          <View style={{ alignItems: "center", gap: 14 }}>
            <Text style={[styles.kicker, { color: colors.subtle ?? t.subtle }]}>
              {content.kicker}
            </Text>

            <Text style={[styles.title, { color: colors.text ?? t.text }]}>
              {content.title}
            </Text>

            <Text style={[styles.body, { color: colors.subtle ?? t.subtle }]}>
              {content.body}
            </Text>

            <Image
              source={logo}
              style={{ width: 46, height: 46, opacity: t.isDark ? 0.95 : 0.9, marginTop: 4 }}
              resizeMode="contain"
            />

            <Pressable
              onPress={onClose}
              style={[
                styles.ctaBtn,
                content.tone === "green"
                  ? { backgroundColor: "rgba(34,197,94,0.18)", borderColor: "rgba(34,197,94,0.28)" }
                  : content.tone === "blue"
                  ? { backgroundColor: "rgba(59,130,246,0.18)", borderColor: "rgba(59,130,246,0.28)" }
                  : { backgroundColor: "rgba(255,255,255,0.08)", borderColor: "rgba(255,255,255,0.12)" },
              ]}
            >
              <Text
                style={[
                  styles.ctaText,
                  content.tone === "green"
                    ? { color: t.pill.green.tx }
                    : content.tone === "blue"
                    ? { color: t.pill.blue.tx }
                    : { color: colors.text ?? t.text },
                ]}
              >
                {content.cta}
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
    backgroundColor: "rgba(0,0,0,0.40)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  sheet: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,

    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  kicker: {
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    fontSize: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center",
  },
  ctaBtn: {
    alignSelf: "stretch",
    marginTop: 8,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  ctaText: {
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
