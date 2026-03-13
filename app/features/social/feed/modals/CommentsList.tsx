import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { CommentRow } from "./types";

function getInitials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function CommentsList({
  comments,
  loading,
}: {
  comments: CommentRow[];
  loading: boolean;
}) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {},

        empty: {
          paddingVertical: layout.space.xl,
          alignItems: "center",
          justifyContent: "center",
        },
        emptyText: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.sub,
          textAlign: "center",
        },

        row: {
          flexDirection: "row",
          paddingVertical: layout.space.sm,
          paddingHorizontal: layout.space.sm,
        },

        avatar: {
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          marginRight: layout.space.md,
        },

        avatarText: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },

        content: {
          flex: 1,
        },

        topRow: {
          flexDirection: "row",
          alignItems: "baseline",
        },

        name: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
          flexShrink: 1,
        },

        body: {
          marginTop: 4,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },

        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginLeft: 60,
        },

        loadingText: {
          paddingVertical: layout.space.lg,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          textAlign: "center",
        },
      }),
    [colors, typography, layout]
  );

  if (loading) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.loadingText}>Loading comments…</Text>
      </View>
    );
  }

  if (!comments.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No comments yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {comments.map((item) => {
        const initials = getInitials(item.user_name);

        return (
          <View key={item.id}>
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>

              <View style={styles.content}>
                <View style={styles.topRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.user_name ?? "User"}
                  </Text>
                </View>

                <Text style={styles.body}>{item.body}</Text>
              </View>
            </View>

            <View style={styles.divider} />
          </View>
        );
      })}
    </View>
  );
}