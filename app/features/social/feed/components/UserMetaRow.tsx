// app/features/social/feed/components/UserMetaRow.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { fmtTs } from "../utils/format";

type Props = {
  name: string;
  username?: string | null;
  createdAt: string;
  subtitleLeft?: string | null;
};

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function UserMetaRow(props: Props) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
        },

        leftGroup: {
          flexDirection: "row",
          alignItems: "flex-start",
          flex: 1,
        },

        avatar: {
          width: 44,
          height: 44,
          borderRadius: 22,
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
          fontSize: typography.size.body,
        },

        textWrap: {
          flex: 1,
        },

        username: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
          marginBottom: 2,
        },

        name: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },

        right: {
          alignItems: "flex-end",
          gap: 6,
        },

        pill: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        },

        pillText: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },

        date: {
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },
      }),
    [colors, typography, layout]
  );

  const handle = props.username ? `@${props.username}` : null;
  const initials = getInitials(props.name);

  return (
    <View style={styles.row}>
      {/* LEFT SIDE */}
      <View style={styles.leftGroup}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.textWrap}>
          {!!handle && (
            <Text style={styles.username} numberOfLines={1}>
              {handle}
            </Text>
          )}
          <Text style={styles.name} numberOfLines={1}>
            {props.name}
          </Text>
        </View>
      </View>

      {/* RIGHT SIDE */}
      <View style={styles.right}>
        <Text style={styles.date} numberOfLines={1}>
          {fmtTs(props.createdAt)}
        </Text>
      </View>
    </View>
  );
}