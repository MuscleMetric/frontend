// app/features/settings/components/ProfileHeaderCard.tsx
import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ProfileHeaderCard({
  name,
  username,
}: {
  name: string;
  username: string;
}) {
  const { colors, typography, layout } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          borderRadius: layout.radius.xl ?? layout.radius.lg,
          padding: layout.space.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: layout.space.md,
        },
        left: {
          flexDirection: "row",
          alignItems: "center",
          gap: layout.space.md,
          flex: 1,
        },
        avatar: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        avatarText: {
          color: colors.onPrimary,
          fontFamily: typography.fontFamily.bold,
          fontSize: typography.size.body,
        },
        name: {
          color: colors.text,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.body,
          lineHeight: typography.lineHeight.body,
        },
        handle: {
          marginTop: 2,
          color: colors.textMuted,
          fontFamily: typography.fontFamily.medium,
          fontSize: typography.size.meta,
          lineHeight: typography.lineHeight.meta,
        },
        editBtn: {
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bg,
        },
        editText: {
          color: colors.primary,
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },
      }),
    [colors, typography, layout],
  );

  const initials = getInitials(name || "User");

  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>

      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>

      <Text style={styles.handle} numberOfLines={1}>
        @{username}
      </Text>
    </View>
  );
}
