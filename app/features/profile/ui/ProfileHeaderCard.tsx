import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";

import { useAppTheme } from "@/lib/useAppTheme";
import { Card, Icon } from "@/ui";
import type { ProfileOverview } from "../data/profileTypes";
import { Pencil } from "lucide-react-native";

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

function formatInt(n: number | null | undefined) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  return String(Math.max(0, Math.trunc(v)));
}

export default function ProfileHeaderCard({ data }: { data: ProfileOverview }) {
  const { colors, typography, layout } = useAppTheme();

  const name = data.user.name ?? "User";
  const joinedText = useMemo(() => formatMonthYear(data.user.joined_at), [data.user.joined_at]);
  const initials = useMemo(() => initialsFromName(name), [name]);

  const levelLabel = formatLevel(data.user.level);
  const goalLabel = formatPrimaryGoal(data.user.primary_goal);

  const workouts = formatInt(data.counts?.workouts_total);
  const followers = formatInt(data.counts?.followers_count);
  const following = formatInt(data.counts?.following_count);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        cardInner: { padding: layout.space.lg },

        topRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: layout.space.md,
        },

        left: { flexDirection: "row", gap: layout.space.md, flex: 1 },

        avatar: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.trackBg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.trackBorder,
          alignItems: "center",
          justifyContent: "center",
        },
        avatarText: {
          fontFamily: typography.fontFamily.bold,
          fontSize: 22,
          color: colors.text,
        },

        nameBlock: { flex: 1, paddingTop: 2 },

        title: {
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
          marginTop: 4,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },

        iconBtn: {
          width: 40,
          height: 40,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },

        statsRow: {
          marginTop: layout.space.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingTop: layout.space.md,
        },

        stat: { flex: 1, alignItems: "center" },

        statValue: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },

        statLabel: {
          marginTop: 2,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },

        divider: {
          width: 1,
          height: 28,
          backgroundColor: colors.border,
          opacity: 0.9,
        },
      }),
    [colors, typography, layout]
  );

  return (
    <Card>
      <View style={styles.cardInner}>
        <View style={styles.topRow}>
          <View style={styles.left}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>

            <View style={styles.nameBlock}>
              <Text style={styles.title} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {levelLabel} · {goalLabel}
              </Text>
              <Text style={styles.joined}>Joined {joinedText}</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            onPress={() => router.push("/features/profile/EditProfile")}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: pressed ? colors.cardPressed : colors.surface },
            ]}
            hitSlop={layout.hitSlop}
          >
            {/* Pick whichever icon name exists in your Icon set */}
            <Icon name="create-outline" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <Pressable style={styles.stat} onPress={() => {}}>
            <Text style={styles.statValue}>{workouts}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable style={styles.stat} onPress={() => {}}>
            <Text style={styles.statValue}>{followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>

          <View style={styles.divider} />

          <Pressable style={styles.stat} onPress={() => {}}>
            <Text style={styles.statValue}>{following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}
