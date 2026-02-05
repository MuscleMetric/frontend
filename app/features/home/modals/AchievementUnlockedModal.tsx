// app/features/home/modals/AchievementUnlockedModal.tsx
import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { useAppTheme } from "../../../../lib/useAppTheme";
import { Card, Pill, Icon } from "@/ui";
import { Button } from "@/ui/buttons/Button";

export type UnlockedAchievement = {
  id: string;
  code?: string;
  title: string;
  description?: string | null;
  category?: string | null;
  difficulty?: string | null;
  achieved_at?: string | null;
};

function difficultyTone(d?: string | null) {
  const x = (d ?? "").toLowerCase();
  if (x === "elite") return "warning";
  if (x === "hard") return "danger";
  if (x === "medium") return "success";
  if (x === "easy") return "neutral";
  return "neutral";
}

function prettyDifficulty(d?: string | null) {
  const x = (d ?? "").toLowerCase();
  if (!x) return "Achievement";
  return x.charAt(0).toUpperCase() + x.slice(1);
}

export default function AchievementUnlockedModal({
  visible,
  achievement,
  onClose,
  onViewAll,
}: {
  visible: boolean;
  achievement: UnlockedAchievement | null;
  onClose: () => void;
  onViewAll?: () => void;
}) {
  const { colors, typography, layout } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography, layout), [
    colors,
    typography,
    layout,
  ]);

  const title = achievement?.title ?? "Achievement unlocked";
  const desc = achievement?.description ?? "";
  const diff = prettyDifficulty(achievement?.difficulty);
  const pillTone = difficultyTone(achievement?.difficulty) as any;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === "ios" ? "fade" : "fade"}
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop propagation so tapping the card doesn’t close */}
        <Pressable style={styles.centerWrap} onPress={() => {}}>
          <Card style={styles.card}>
            {/* Accent */}
            <View pointerEvents="none" style={styles.accent} />

            <View style={{ gap: layout.space.md }}>
              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.iconWrap}>
                  <Icon name="trophy-outline" size={22} color={colors.text} />
                </View>

                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.kicker}>Achievement unlocked</Text>
                  <Text style={styles.title} numberOfLines={2}>
                    {title}
                  </Text>
                </View>

                <Pill label={diff} tone={pillTone} />
              </View>

              {!!desc ? (
                <Text style={styles.desc} numberOfLines={4}>
                  {desc}
                </Text>
              ) : null}

              {/* Actions */}
              <View style={styles.actionsRow}>
                {onViewAll ? (
                  <View style={{ flex: 1 }}>
                    <Button
                      title="View"
                      onPress={onViewAll}
                      variant="secondary"
                      tone="neutral"
                      fullWidth
                    />
                  </View>
                ) : null}

                <View style={{ flex: 1 }}>
                  <Button
                    title="Nice"
                    onPress={onClose}
                    variant="primary"
                    tone="primary"
                    fullWidth
                  />
                </View>
              </View>
            </View>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: any, typography: any, layout: any) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "center",
      padding: 16,
    },

    centerWrap: {
      width: "100%",
      alignSelf: "center",
      maxWidth: 520,
    },

    card: {
      borderRadius: layout.radius.xl,
      padding: layout.space.lg,
      overflow: "hidden",
    },

    accent: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 5,
      backgroundColor: "rgba(245,158,11,0.55)", // gold-ish
    },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },

    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(245,158,11,0.16)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(245,158,11,0.35)",
    },

    kicker: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.meta,
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1.1,
    },

    title: {
      fontFamily: typography.fontFamily.bold,
      fontSize: typography.size.h2 ?? 18,
      lineHeight: typography.lineHeight.h2 ?? 22,
      color: colors.text,
      letterSpacing: -0.3,
    },

    desc: {
      fontFamily: typography.fontFamily.medium,
      fontSize: typography.size.body,
      lineHeight: typography.lineHeight.body,
      color: colors.textMuted,
    },

    actionsRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 2,
    },
  });
