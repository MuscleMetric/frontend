import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Pill, Button } from "@/ui";
import type { ProfileOverview } from "../data/profileTypes";

function formatMonthYear(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

function formatLevel(level?: string | null) {
  if (!level) return "Set your level";
  switch (level) {
    case "beginner":
      return "Beginner";
    case "intermediate":
      return "Intermediate";
    case "advanced":
      return "Advanced";
    default:
      return String(level).replace(/_/g, " ");
  }
}

function formatPrimaryGoal(goal?: string | null) {
  if (!goal) return "Set your goal";
  switch (goal) {
    case "build_muscle":
      return "Build muscle";
    case "lose_fat":
      return "Lose fat";
    case "maintain":
      return "Maintain";
    case "get_stronger":
      return "Get stronger";
    case "improve_fitness":
      return "Improve fitness";
    default:
      return String(goal).replace(/_/g, " ");
  }
}

function initialsFromName(name?: string | null) {
  const n = (name ?? "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

export default function ProfileHeaderCard({ data }: { data: ProfileOverview }) {
  const { colors, typography, layout } = useAppTheme();

  const name = data.user.name ?? "User";
  const joinedText = useMemo(() => formatMonthYear(data.user.joined_at), [data.user.joined_at]);
  const initials = useMemo(() => initialsFromName(name), [name]);

  const levelLabel = formatLevel(data.user.level);
  const goalLabel = formatPrimaryGoal(data.user.primary_goal);

  const favs = data.favourite_achievements?.slice(0, 3) ?? [];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cardInner: {
          padding: layout.space.lg,
        },
        topRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: layout.space.md,
        },
        avatar: {
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.trackBg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.trackBorder,
          alignItems: "center",
          justifyContent: "center",
        },
        avatarText: {
          fontFamily: typography.fontFamily.bold,
          fontSize: 26,
          color: colors.text,
        },
        editBtnWrap: {
          alignItems: "flex-end",
          gap: layout.space.xs,
        },
        title: {
          marginTop: layout.space.md,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h2,
          lineHeight: typography.lineHeight.h2,
          color: colors.text,
        },
        meta: {
          marginTop: 2,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.textMuted,
        },
        joined: {
          marginTop: 2,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },
        favWrap: {
          marginTop: layout.space.lg,
          gap: layout.space.sm,
        },
        favTitle: {
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.text,
          opacity: 0.9,
        },
        pillsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: layout.space.sm,
        },
        favEmpty: {
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.textMuted,
        },
        favLink: {
          marginTop: layout.space.xs,
          alignSelf: "flex-start",
        },
      }),
    [colors, typography, layout]
  );

  return (
    <Card>
      <View style={styles.cardInner}>
        <View style={styles.topRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <View style={styles.editBtnWrap}>
            <Button
              variant="secondary"
              onPress={() => router.push("/features/profile/EditProfile")}
              title="Edit profile"
            />
          </View>
        </View>

        <Text style={styles.title}>{name}</Text>
        <Text style={styles.meta}>
          {levelLabel} · {goalLabel}
        </Text>
        <Text style={styles.joined}>Joined {joinedText}</Text>

        <View style={styles.favWrap}>
          <Text style={styles.favTitle}>Favourite achievements</Text>

          {favs.length > 0 ? (
            <>
              <View style={styles.pillsRow}>
                {favs.map((a) => (
                  <Pill key={a.id} tone="neutral" label={a.title} />
                ))}
              </View>

              <Pressable
                style={styles.favLink}
                onPress={() =>
                  router.push("/features/achievements/achievements?fromProfile=1")
                }
              >
                <Pill tone="primary" label="Edit favourites" />
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.favEmpty}>
                Pick up to 3 achievements to pin here.
              </Text>
              <Pressable
                style={styles.favLink}
                onPress={() =>
                  router.push("/features/achievements/achievements?fromProfile=1")
                }
              >
                <Pill tone="primary" label="Pick favourites" />
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Card>
  );
}
