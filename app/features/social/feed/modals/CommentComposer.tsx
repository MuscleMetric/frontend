// app/features/social/feed/modals/CommentComposer.tsx

import React, { useMemo, useState } from "react";
import { View, TextInput, Pressable, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export function CommentComposer({
  disabled,
  placeholder = "Add a comment…",
  onSubmit,
}: {
  disabled?: boolean;
  placeholder?: string;
  onSubmit: (body: string) => Promise<void> | void;
}) {
  const { colors, typography, layout } = useAppTheme();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          paddingHorizontal: layout.space.lg,
          paddingVertical: layout.space.md,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
          flexDirection: "row",
          alignItems: "center",
          gap: layout.space.md,
        },

        input: {
          flex: 1,
          minHeight: 42,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: layout.radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.text,
          fontFamily: typography.fontFamily.regular,
          fontSize: typography.size.body,
        },

        btn: {
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: colors.primary,
          opacity: disabled || sending ? 0.5 : 1,
        },
        btnText: {
          color: "#fff",
          fontFamily: typography.fontFamily.semibold,
          fontSize: typography.size.meta,
        },
      }),
    [colors, typography, layout, disabled, sending]
  );

  const canSend = !disabled && !sending && text.trim().length > 0;

  const submit = async () => {
    if (!canSend) return;
    const body = text.trim();

    setSending(true);
    try {
      await onSubmit(body);
      setText("");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        editable={!disabled && !sending}
        returnKeyType="send"
        onSubmitEditing={submit}
      />

      <Pressable style={styles.btn} onPress={submit} disabled={!canSend}>
        <Text style={styles.btnText}>{sending ? "Sending…" : "Send"}</Text>
      </Pressable>
    </View>
  );
}