// app/features/social/feed/components/UserMetaRow.tsx

import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { fmtTs } from "../utils/format";

type Props = {
  name: string;
  username?: string | null;
  createdAt: string;
  subtitleLeft?: string | null; // e.g. "New Personal Record"
};

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

        left: {
          flex: 1,
          paddingRight: layout.space.md,
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

  return (
    <View style={styles.row}>
      {/* LEFT SIDE */}
      <View style={styles.left}>
        {!!handle && (
          <Text style={styles.username} numberOfLines={1}>
            {handle}
          </Text>
        )}
        <Text style={styles.name} numberOfLines={1}>
          {props.name}
        </Text>
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