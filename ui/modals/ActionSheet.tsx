// ui/modals/ActionSheet.tsx
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import { ModalSheet } from "./ModalSheet";
import { Icon } from "@/ui/icons/Icon";

type Action = {
  key: string;
  title: string;
  icon?: string;
  tone?: "default" | "danger" | "primary";
  right?: React.ReactNode;
  onPress: () => void;
};

export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  actions: Action[];
}) {
  const { colors, typography, layout } = useAppTheme();

  const toneColor = (tone?: Action["tone"]) =>
    tone === "primary" ? colors.primary : tone === "danger" ? colors.danger : colors.text;

  return (
    <ModalSheet visible={visible} onClose={onClose} title={title}>
      <View style={{ gap: layout.space.sm }}>
        {actions.map((a) => (
          <Pressable
            key={a.key}
            onPress={() => {
              onClose();
              a.onPress();
            }}
            style={{
              padding: layout.space.md,
              borderRadius: layout.radius.xl,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              flexDirection: "row",
              alignItems: "center",
              gap: layout.space.md,
            }}
          >
            {a.icon ? <Icon name={a.icon as any} size={20} color={toneColor(a.tone)} /> : null}
            <Text style={{ flex: 1, fontFamily: typography.fontFamily.semibold, color: toneColor(a.tone) }}>
              {a.title}
            </Text>
            {a.right ? a.right : <Icon name={"chevron-forward" as any} size={18} color={colors.textMuted} />}
          </Pressable>
        ))}
      </View>
    </ModalSheet>
  );
}
