import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  FlatList,
} from "react-native";

import {
  getProfileConnections,
  type ProfileConnectionKind,
  type ProfileConnectionRow,
} from "../data/getProfileConnections";
import { useAppTheme } from "@/lib/useAppTheme";
import { Card } from "@/ui";
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
  return (
    parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)
  ).toUpperCase();
}

function formatInt(n: number | null | undefined) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0";
  return String(Math.max(0, Math.trunc(v)));
}

type ConnectionsModalType = "followers" | "following" | null;

export default function ProfileHeaderCard({ data }: { data: ProfileOverview }) {
  const { colors, typography, layout } = useAppTheme();

  const [connectionsType, setConnectionsType] =
    useState<ConnectionsModalType>(null);
  const [connectionsOpen, setConnectionsOpen] = useState(false);

  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [connectionsData, setConnectionsData] = useState<
    ProfileConnectionRow[]
  >([]);

  const name = data.user.name ?? "User";
  const handle = data.user.username ? `@${data.user.username}` : null;
  const joinedText = useMemo(
    () => formatMonthYear(data.user.joined_at),
    [data.user.joined_at],
  );
  const initials = useMemo(() => initialsFromName(name), [name]);

  const levelLabel = formatLevel(data.user.level);
  const goalLabel = formatPrimaryGoal(data.user.primary_goal);

  const workouts = formatInt(data.counts?.workouts_total);
  const followers = formatInt(data.counts?.followers_count);
  const following = formatInt(data.counts?.following_count);

  const modalTitle =
    connectionsType === "followers"
      ? "Followers"
      : connectionsType === "following"
        ? "Following"
        : "";

  const emptyText =
    connectionsType === "followers"
      ? "No followers yet."
      : "Not following anyone yet.";

  async function openConnections(type: ProfileConnectionKind) {
    setConnectionsType(type);
    setConnectionsOpen(true);
    setConnectionsLoading(true);
    setConnectionsError(null);
    setConnectionsData([]);

    try {
      const rows = await getProfileConnections(data.user.id, type);
      setConnectionsData(rows);
    } catch (error: any) {
      setConnectionsError(error?.message ?? "Failed to load connections.");
    } finally {
      setConnectionsLoading(false);
    }
  }

  function closeConnections() {
    setConnectionsOpen(false);
    setConnectionsType(null);
    setConnectionsLoading(false);
    setConnectionsError(null);
    setConnectionsData([]);
  }

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

        username: {
          marginTop: 2,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.sub,
          lineHeight: typography.lineHeight.sub,
          color: colors.textMuted,
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

        statPressable: {
          flex: 1,
          alignItems: "center",
          paddingVertical: 4,
          borderRadius: 12,
        },

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

        modalBackdrop: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          padding: layout.space.lg,
        },

        modalCard: {
          backgroundColor: colors.surface,
          borderRadius: layout.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          maxHeight: "70%",
          overflow: "hidden",
        },

        modalHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: layout.space.lg,
          paddingVertical: layout.space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },

        modalTitle: {
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.h3,
          lineHeight: typography.lineHeight.h3,
          color: colors.text,
        },

        modalClose: {
          paddingHorizontal: layout.space.sm,
          paddingVertical: layout.space.xs,
          borderRadius: 999,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },

        modalCloseText: {
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.text,
        },

        modalBody: {
          paddingHorizontal: layout.space.lg,
          paddingVertical: layout.space.md,
        },

        stateText: {
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
          color: colors.textMuted,
        },

        row: {
          paddingVertical: layout.space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },

        rowName: {
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
          color: colors.text,
        },

        rowUsername: {
          marginTop: 2,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          color: colors.textMuted,
        },
      }),
    [colors, typography, layout],
  );

  return (
    <>
      <Card>
        <View style={styles.cardInner}>
          <View style={styles.topRow}>
            <View style={styles.left}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>

              <View style={styles.nameBlock}>
                {handle ? (
                  <Text style={styles.username} numberOfLines={1}>
                    {handle}
                  </Text>
                ) : null}

                <Text style={styles.title} numberOfLines={1}>
                  {name}
                </Text>

                <Text style={styles.meta} numberOfLines={1}>
                  {levelLabel} · {goalLabel}
                </Text>
                <Text style={styles.joined}>Joined {joinedText}</Text>
              </View>
            </View>

            {/* Want to add a qr code icon here in the future for sharing profile */}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{workouts}</Text>
              <Text style={styles.statLabel}>Workouts</Text>
            </View>

            <View style={styles.divider} />

            <Pressable
              style={styles.statPressable}
              onPress={() => openConnections("followers")}
            >
              <Text style={styles.statValue}>{followers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              style={styles.statPressable}
              onPress={() => openConnections("following")}
            >
              <Text style={styles.statValue}>{following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </Pressable>
          </View>
        </View>
      </Card>

      <Modal
        visible={connectionsOpen}
        transparent
        animationType="fade"
        onRequestClose={closeConnections}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeConnections}>
          <Pressable onPress={() => {}} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>

              <Pressable style={styles.modalClose} onPress={closeConnections}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              {connectionsLoading ? (
                <Text style={styles.stateText}>Loading...</Text>
              ) : connectionsError ? (
                <Text style={styles.stateText}>{connectionsError}</Text>
              ) : connectionsData.length === 0 ? (
                <Text style={styles.stateText}>{emptyText}</Text>
              ) : (
                <FlatList
                  data={connectionsData}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.row}>
                      <Text style={styles.rowName}>
                        {item.name?.trim() || "Unnamed user"}
                      </Text>
                      {item.username ? (
                        <Text style={styles.rowUsername}>@{item.username}</Text>
                      ) : null}
                    </View>
                  )}
                />
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
