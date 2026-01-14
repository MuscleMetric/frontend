// ui/badges/PRBadge.tsx
import React from "react";
import { View, Text } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { Icon } from "@/ui/icons/Icon";

export function PRBadge({ label = "PR" }: { label?: string }) {
  const { colors, typography, layout } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: layout.radius.pill,
        backgroundColor: "rgba(245,158,11,0.14)",
        borderWidth: 1,
        borderColor: "rgba(245,158,11,0.22)",
      }}
    >
      <Icon name={"trophy" as any} size={14} color={colors.warning} />
      <Text style={{ color: colors.warning, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.meta }}>
        {label}
      </Text>
    </View>
  );
}
