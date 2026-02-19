// app/features/social/feed/modals/CommentsList.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet, FlatList } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { CommentRow } from "./types";
import { fmtTs } from "../utils/format";

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
        wrap: { flex: 1 },

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
          paddingVertical: layout.space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },

        top: { flexDirection: "row", alignItems: "baseline", gap: 8 },
        name: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },
        username: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
        },
        time: {
          marginLeft: "auto",
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
        },

        body: {
          marginTop: 6,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
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
    <FlatList
      data={comments}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => {
        const handle = item.user_username ? `@${item.user_username}` : null;
        return (
          <View style={styles.row}>
            <View style={styles.top}>
              <Text style={styles.name} numberOfLines={1}>
                {item.user_name ?? "User"}
              </Text>
              {!!handle && (
                <Text style={styles.username} numberOfLines={1}>
                  {handle}
                </Text>
              )}
              <Text style={styles.time} numberOfLines={1}>
                {fmtTs(item.created_at)}
              </Text>
            </View>

            <Text style={styles.body}>{item.body}</Text>
          </View>
        );
      }}
    />
  );
}